const { fancy } = require('../lib/font');
module.exports = {
    name: 'roll',
    category: 'fun',
    aliases: ['dice', 'd6'],
    description: 'Roll a dice (default 6-sided)',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const sides = Math.max(2, Math.min(parseInt(args[0]) || 6, 1000));
        const n = Math.floor(Math.random() * sides) + 1;
        await conn.sendMessage(from, {
            text: `╭─〔 🎲 ʀᴏʟʟ ᴅ${sides} 〕\n│\n│ 🎯 ${n}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
