const axios = require('axios');
const { fancy } = require('../lib/font');
module.exports = {
    name: 'joke',
    category: 'fun',
    aliases: ['funny'],
    description: 'Get a random joke',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        try {
            const r = await axios.get('https://official-joke-api.appspot.com/random_joke', { timeout: 8000 });
            const { setup, punchline } = r.data;
            const text = `╭─〔 😂 ᴊᴏᴋᴇ 〕\n│\n│ ${setup}\n│\n│ 🥁 ${punchline}\n│\n╰──────────────────────`;
            await conn.sendMessage(from, { text }, { quoted: msg });
        } catch (e) { await conn.sendMessage(from, { text: fancy('❌ Could not fetch a joke.') }, { quoted: msg }); }
    }
};
