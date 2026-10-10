const { fancy } = require('../lib/font');
module.exports = {
    name: 'upper',
    category: 'text',
    aliases: ['uppercase'],
    description: 'Convert text to uppercase',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ');
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .upper hello') }, { quoted: msg });
        await conn.sendMessage(from, {
            text: `╭─〔 🔠 ᴜᴘᴘᴇʀ 〕\n│\n│ ${text.toUpperCase()}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
