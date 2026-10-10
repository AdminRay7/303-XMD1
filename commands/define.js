const { fancy } = require('../lib/font');
const axios = require('axios');
module.exports = {
    name: 'define',
    category: 'misc',
    aliases: ['dict', 'meaning'],
    description: 'Look up the definition of a word',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const word = args.join(' ').trim();
        if (!word) return conn.sendMessage(from, { text: fancy('❌ Usage: .define hello') }, { quoted: msg });
        try {
            const r = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, { timeout: 8000 });
            const entry = r.data?.[0];
            if (!entry) throw new Error('Word not found');
            const meaning = entry.meanings?.[0];
            const def = meaning?.definitions?.[0]?.definition || 'no definition';
            const text =
                `╭─〔 📖 ᴅᴇꜰɪɴᴇ 〕\n│\n` +
                `│ 📝 ${word}\n` +
                `│ 🔤 ${meaning?.partOfSpeech || '—'}\n│\n` +
                `│ ${def}\n│\n` +
                `╰──────────────────────`;
            await conn.sendMessage(from, { text }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
