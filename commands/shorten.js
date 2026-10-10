const { fancy } = require('../lib/font');
const axios = require('axios');

module.exports = {
    name: 'shorten',
    category: 'misc',
    aliases: ['short', 'tinyurl'],
    description: 'Shorten any URL',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const url = (args[0] || '').trim();
        if (!/^https?:\/\//.test(url)) {
            return conn.sendMessage(from, { text: fancy('❌ Usage: .shorten https://example.com/long') }, { quoted: msg });
        }
        try {
            const r = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 8000 });
            const short = String(r.data || '').trim();
            if (!short.startsWith('http')) throw new Error('bad response');
            await conn.sendMessage(from, {
                text:
                    `╭─〔 🔗 ꜱʜᴏʀᴛᴇɴ 〕\n│\n` +
                    `│ 📎 Original:\n│ ${url}\n│\n` +
                    `│ ✨ Short:\n│ ${short}\n│\n` +
                    `╰──────────────────────`
            }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
