const { fancy } = require('../lib/font');
module.exports = {
    name: 'id',
    category: 'tools',
    aliases: ['whoami', 'jid'],
    description: 'Show your WhatsApp JID and info',
    async execute(conn, msg, args, ctx) {
        const { from, sender, pushname, isGroup, isOwner } = ctx;
        const text =
            `╭─〔 🆔 ɪᴅ 〕\n│\n` +
            `│ 📛 Name:  ${pushname}\n` +
            `│ 🆔 JID:   ${sender}\n` +
            `│ 💬 Chat:  ${from}\n` +
            `│ 👥 Group: ${isGroup ? 'yes' : 'no'}\n` +
            `│ 👑 Owner: ${isOwner ? 'yes' : 'no'}\n│\n` +
            `╰──────────────────────`;
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};
