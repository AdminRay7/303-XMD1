const { fancy } = require('../lib/font');
module.exports = {
    name: 'color',
    category: 'tools',
    aliases: ['hex', 'rgb'],
    description: 'Show info about a random or given color',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        let hex = (args[0] || '').trim().replace('#', '');
        if (!/^[0-9a-f]{6}$/i.test(hex)) {
            // Generate random
            hex = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
        }
        const r = parseInt(hex.slice(0,2), 16);
        const g = parseInt(hex.slice(2,4), 16);
        const b = parseInt(hex.slice(4,6), 16);
        const text =
            `╭─〔 🎨 ᴄᴏʟᴏʀ 〕\n│\n` +
            `│ HEX: #${hex.toUpperCase()}\n` +
            `│ RGB: rgb(${r}, ${g}, ${b})\n│\n` +
            `╰──────────────────────`;
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};
