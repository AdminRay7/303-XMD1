const crypto = require('crypto');
const { fancy } = require('../lib/font');
module.exports = {
    name: 'hash',
    category: 'tools',
    aliases: ['md5', 'sha256'],
    description: 'Generate MD5, SHA-1 and SHA-256 hashes of text',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .hash mysecrettext') }, { quoted: msg });
        const md5 = crypto.createHash('md5').update(text).digest('hex');
        const sha1 = crypto.createHash('sha1').update(text).digest('hex');
        const sha256 = crypto.createHash('sha256').update(text).digest('hex');
        await conn.sendMessage(from, {
            text:
                `╭─〔 🔐 ʜᴀꜱʜ 〕\n│\n` +
                `│ 📝 Input: ${text}\n│\n` +
                `│ MD5:    ${md5}\n` +
                `│ SHA-1:  ${sha1}\n` +
                `│ SHA-256: ${sha256}\n│\n` +
                `╰──────────────────────`
        }, { quoted: msg });
    }
};
