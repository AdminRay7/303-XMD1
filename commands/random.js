const { fancy } = require('../lib/font');
module.exports = {
    name: 'random',
    category: 'misc',
    aliases: ['rand', 'randnum'],
    description: 'Generate a random number between two values',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        let min = parseInt(args[0]);
        let max = parseInt(args[1]);
        if (isNaN(min) || isNaN(max)) {
            min = 1; max = 100;
        }
        if (min > max) [min, max] = [max, min];
        const n = Math.floor(Math.random() * (max - min + 1)) + min;
        await conn.sendMessage(from, {
            text: `╭─〔 🎲 ʀᴀɴᴅᴏᴍ 〕\n│\n│ Range: ${min} – ${max}\n│ 🎯 ${n}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
