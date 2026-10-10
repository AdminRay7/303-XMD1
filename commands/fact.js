const axios = require('axios');
const { fancy } = require('../lib/font');
module.exports = {
    name: 'fact',
    category: 'fun',
    aliases: ['randomfact'],
    description: 'Get a random interesting fact',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        try {
            const r = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 8000 });
            const text = `╭─〔 🧠 ꜰᴀᴄᴛ 〕\n│\n│ ${r.data.text}\n│\n╰──────────────────────`;
            await conn.sendMessage(from, { text }, { quoted: msg });
        } catch (e) { await conn.sendMessage(from, { text: fancy('❌ Could not fetch a fact.') }, { quoted: msg }); }
    }
};
