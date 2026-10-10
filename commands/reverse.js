const { fancy } = require('../lib/font');
module.exports = {
    name: 'reverse',
    category: 'text',
    aliases: ['rev'],
    description: 'Reverse any text',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ');
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .reverse hello world') }, { quoted: msg });
        const out = text.split('').reverse().join('');
        await conn.sendMessage(from, {
            text: `╭─〔 🔄 ʀᴇᴠᴇʀꜱᴇ 〕\n│\n│ ${out}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
