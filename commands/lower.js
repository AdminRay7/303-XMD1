const { fancy } = require('../lib/font');
module.exports = {
    name: 'lower',
    category: 'text',
    aliases: ['lowercase'],
    description: 'Convert text to lowercase',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ');
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .lower HELLO') }, { quoted: msg });
        await conn.sendMessage(from, {
            text: `╭─〔 🔡 ʟᴏᴡᴇʀ 〕\n│\n│ ${text.toLowerCase()}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
