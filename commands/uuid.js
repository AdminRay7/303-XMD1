const crypto = require('crypto');
const { fancy } = require('../lib/font');
module.exports = {
    name: 'uuid',
    category: 'tools',
    aliases: ['guid', 'genid'],
    description: 'Generate a random UUID v4',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const count = Math.max(1, Math.min(parseInt(args[0]) || 1, 10));
        const lines = [];
        for (let i = 0; i < count; i++) lines.push(`│ ${crypto.randomUUID()}`);
        await conn.sendMessage(from, {
            text: `╭─〔 🆔 ᴜᴜɪᴅ 〕\n│\n${lines.join('\n')}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
