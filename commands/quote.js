const axios = require('axios');
const { fancy } = require('../lib/font');
module.exports = {
    name: 'quote',
    category: 'fun',
    aliases: ['q'],
    description: 'Get a random inspirational quote',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        try {
            const r = await axios.get('https://api.quotable.io/random', { timeout: 8000 });
            const { content, author } = r.data;
            const text = `╭─〔 💬 ǫᴜᴏᴛᴇ 〕\n│\n│ "${content}"\n│\n│ — ${author}\n│\n╰──────────────────────`;
            await conn.sendMessage(from, { text }, { quoted: msg });
        } catch (e) { await conn.sendMessage(from, { text: fancy('❌ Could not fetch a quote.') }, { quoted: msg }); }
    }
};
