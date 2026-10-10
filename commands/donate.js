const { fancy } = require('../lib/font');
const config = require('../config');
module.exports = {
    name: 'donate',
    category: 'misc',
    aliases: ['support'],
    description: 'Support the bot',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text =
            `╭─〔 💚 ꜱᴜᴘᴘᴏʀᴛ 〕\n│\n` +
            `│ Thanks for using ${config.botName}!\n` +
            `│ Support the dev:\n` +
            `│ 📱 https://wa.me/${config.ownerNumber}\n│\n` +
            `╰──────────────────────`;
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};
