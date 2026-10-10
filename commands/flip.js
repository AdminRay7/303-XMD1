const { fancy } = require('../lib/font');
module.exports = {
    name: 'flip',
    category: 'fun',
    aliases: ['coin', 'cointoss'],
    description: 'Flip a coin',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const r = Math.random() < 0.5 ? 'Heads 🪙' : 'Tails 🪙';
        await conn.sendMessage(from, {
            text: `╭─〔 🪙 ꜰʟɪᴘ 〕\n│\n│ ${r}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
