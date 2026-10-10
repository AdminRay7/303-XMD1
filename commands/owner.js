const { fancy } = require('../lib/font');
const config = require('../config');
module.exports = {
    name: 'owner',
    category: 'misc',
    aliases: ['contact', 'dev'],
    description: 'Show the bot owner contact',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const phone = config.ownerNumber;
        const name = config.ownerName || 'Owner';
        const text =
            `╭─〔 👑 ᴏᴡɴᴇʀ 〕\n│\n` +
            `│ 📛 Name:  ${name}\n` +
            `│ 📱 Phone: +${phone}\n` +
            `│ 💬 Chat:  https://wa.me/${phone}\n│\n` +
            `╰──────────────────────`;
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};
