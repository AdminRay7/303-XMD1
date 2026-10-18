// commands/mute.js
// Mutes the group (only admins can send messages).
// Usage: .mute  OR  .mute 10m  OR  .mute 1h  OR  .mute off
const { fancy } = require('../lib/font');
const config = require('../config');

function bareNum(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
async function isBotAdmin(conn, jid) {
    const meta = await conn.groupMetadata(jid);
    const b = bareNum(conn.user?.id), bl = bareNum(conn.user?.lid);
    const me = meta.participants.find(p => bareNum(p.id) === b || (bl && bareNum(p.id) === bl));
    return me && (me.admin === 'admin' || me.admin === 'superadmin');
}
async function isAdmin(conn, jid, sender) {
    const meta = await conn.groupMetadata(jid);
    return meta.participants.some(p => bareNum(p.id) === bareNum(sender) && (p.admin === 'admin' || p.admin === 'superadmin'));
}

module.exports = {
    name: 'mute',
    category: 'admin',
    aliases: ['close'],
    description: 'Mute group (only admins can send)',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;
        if (!isGroup) return;
        if (!isOwner && !(await isAdmin(conn, from, sender))) return;
        if (!(await isBotAdmin(conn, from))) return;

        const arg = (args[0] || '').toLowerCase();
        
        // Turn off mute
        if (arg === 'off') {
            try {
                await conn.groupSettingUpdate(from, 'not_announcement');
                await conn.sendMessage(from, { text: fancy('🔊 Group opened. Everyone can send messages.') }, { quoted: msg });
            } catch (e) { console.error('[mute]', e.message); }
            return;
        }

        // Turn on mute
        try {
            await conn.groupSettingUpdate(from, 'announcement');
            await conn.sendMessage(from, { text: fancy('🔇 Group muted. Only admins can send messages.') }, { quoted: msg });
        } catch (e) { console.error('[mute]', e.message); }

        // Optional: timed unmute
        if (arg && arg !== 'off') {
            let ms = 0;
            if (arg.endsWith('m')) ms = parseInt(arg) * 60 * 1000;
            if (arg.endsWith('h')) ms = parseInt(arg) * 60 * 60 * 1000;
            if (arg.endsWith('s')) ms = parseInt(arg) * 1000;

            if (ms > 0) {
                conn.sendMessage(from, { text: fancy(`⏱️ Group will open in ${arg}.`) });
                setTimeout(async () => {
                    try {
                        await conn.groupSettingUpdate(from, 'not_announcement');
                        await conn.sendMessage(from, { text: fancy('🔊 Group opened automatically.') });
                    } catch (e) {}
                }, ms);
            }
        }
    }
};