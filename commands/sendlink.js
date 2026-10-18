// commands/sendlink.js
// Gets the current group invite link.
// Usage: .sendlink

const { fancy } = require('../lib/font');

function bareNum(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
async function isBotAdmin(conn, jid) {
    const meta = await conn.groupMetadata(jid);
    const b = bareNum(conn.user?.id), bl = bareNum(conn.user?.lid);
    const me = meta.participants.find(p => bareNum(p.id) === b || (bl && bareNum(p.id) === bl));
    return me && (me.admin === 'admin' || me.admin === 'superadmin');
}

module.exports = {
    name: 'sendlink',
    category: 'admin',
    aliases: ['linkgroup', 'getlink'],
    description: 'Get the current group invite link',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup } = ctx;
        if (!isGroup) return;
        if (!(await isBotAdmin(conn, from))) return;

        try {
            const code = await conn.groupInviteCode(from);
            const link = `https://chat.whatsapp.com/${code}`;
            await conn.sendMessage(from, { text: fancy(`🔗 *Group Link:*\n${link}`) }, { quoted: msg });
        } catch (e) { console.error('[sendlink]', e.message); }
    }
};