const crypto = require('crypto');
const { fancy } = require('../lib/font');
module.exports = {
    name: 'password',
    category: 'tools',
    aliases: ['genpass', 'passgen'],
    description: 'Generate a strong random password',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const len = Math.max(8, Math.min(parseInt(args[0]) || 16, 128));
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let pwd = '';
        const bytes = crypto.randomBytes(len);
        for (let i = 0; i < len; i++) pwd += chars[bytes[i] % chars.length];
        await conn.sendMessage(from, {
            text: `╭─〔 🔑 ᴘᴀꜱꜱᴡᴏʀᴅ 〕\n│\n│ ${pwd}\n│\n│ Length: ${len}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
