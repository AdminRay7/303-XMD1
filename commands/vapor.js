const { fancy } = require('../lib/font');
module.exports = {
    name: 'vapor',
    category: 'text',
    aliases: ['aesthetic2', 'vaporwave'],
    description: 'Convert text to ｖａｐｏｒｗａｖｅ',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .vapor hello world') }, { quoted: msg });
        const out = text.split('').map(c => {
            const code = c.charCodeAt(0);
            if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xFF00 - 0x20);
            return c;
        }).join(' ').replace(/\s+/g, ' ');
        await conn.sendMessage(from, {
            text: `╭─〔 🌸 ᴠᴀᴘᴏʀᴡᴀᴠᴇ 〕\n│\n│ ${out}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
