// commands/tagall.js
// Tags every member in the group.
// Usage: .tagall [message]

const { fancy } = require('../lib/font');

function bareNum(jid) { return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
async function isAdmin(conn, jid, sender) {
    const meta = await conn.groupMetadata(jid);
    return meta.participants.some(p => bareNum(p.id) === bareNum(sender) && (p.admin === 'admin' || p.admin === 'superadmin'));
}

module.exports = {
    name: 'tagall',
    category: 'admin',
    aliases: ['everyone', 'hidetag'],
    description: 'Mention all group members',
    async execute(conn, msg, args, ctx) {
        const { from, sender, isGroup, isOwner } = ctx;
        if (!isGroup) return;
        if (!isOwner && !(await isAdmin(conn, from, sender))) return;

        const meta = await conn.groupMetadata(from);
        const participants = meta.participants.map(p => p.id);
        const text = args.join(' ') || 'Attention everyone!';

        let message = `📢 *${fancy(text)}*\n\n`;
        participants.forEach(jid => { message += `@${bareNum(jid)}\n`; });

        await conn.sendMessage(from, { text: message, mentions: participants }, { quoted: msg });
    }
};