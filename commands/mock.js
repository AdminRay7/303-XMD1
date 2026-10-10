const { fancy } = require('../lib/font');
module.exports = {
    name: 'mock',
    category: 'text',
    aliases: ['spongebob', 'alternate'],
    description: 'mOcK tExT lIkE tHiS',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .mock hello world') }, { quoted: msg });
        const out = text.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
        await conn.sendMessage(from, {
            text: `╭─〔 🧽 ᴍᴏᴄᴋ 〕\n│\n│ ${out}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
