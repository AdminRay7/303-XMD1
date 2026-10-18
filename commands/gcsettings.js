// commands/gcsettings.js
// Change who can edit group settings or send messages.
// Usage:
//   .gcsettings edit admins   (only admins can change group info)
//   .gcsettings edit all      (everyone can change group info)
//   .gcsettings send admins   (equivalent to .mute)
//   .gcsettings send all      (equivalent to .mute off)
const { fancy } = require('../lib/font');

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
    name: 'gcsettings',
    category: 'admin',
    aliases: ['groupsetting', 'lock'],
    description: 'Lock/unlock group info edit or send message permissions',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;
        if (!isGroup) return;
        if (!isOwner && !(await isAdmin(conn, from, sender))) return;
        if (!(await isBotAdmin(conn, from))) return;

        const type = (args[0] || '').toLowerCase();
        const mode = (args[1] || '').toLowerCase();

        if (!['edit', 'send'].includes(type) || !['admins', 'all'].includes(mode)) {
            return conn.sendMessage(from, { text: fancy('Usage: .gcsettings <edit|send> <admins|all>') }, { quoted: msg });
        }

        // Map to Baileys groupSettingUpdate
        let setting;
        if (type === 'edit') {
            setting = mode === 'admins' ? 'locked' : 'unlocked';
        } else {
            setting = mode === 'admins' ? 'announcement' : 'not_announcement';
        }

        try {
            await conn.groupSettingUpdate(from, setting);
            const text = type === 'edit'
                ? (mode === 'admins' ? '🔒 Group info locked (admins only).' : '🔓 Group info unlocked.')
                : (mode === 'admins' ? '🔇 Group muted.' : '🔊 Group opened.');
            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
        } catch (e) {
            console.error('[gcsettings]', e.message);
            await conn.sendMessage(from, { text: fancy('❌ Failed to update group settings.') }, { quoted: msg });
        }
    }
};