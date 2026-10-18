// commands/resetlink.js
// Resets the group invite link (old link stops working).
// Usage: .resetlink

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
    name: 'resetlink',
    category: 'admin',
    aliases: ['revoke'],
    description: 'Reset the group invite link',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;
        if (!isGroup) return;
        if (!isOwner && !(await isAdmin(conn, from, sender))) return;
        if (!(await isBotAdmin(conn, from))) return;

        try {
            const newCode = await conn.groupRevokeInvite(from);
            const newLink = `https://chat.whatsapp.com/${newCode}`;
            await conn.sendMessage(from, { text: fancy(`🔄 *Group link reset!*\n\nNew link:\n${newLink}`) }, { quoted: msg });
        } catch (e) { console.error('[resetlink]', e.message); }
    }
};