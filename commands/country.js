const { fancy } = require('../lib/font');
const axios = require('axios');
module.exports = {
    name: 'country',
    category: 'misc',
    aliases: ['cinfo'],
    description: 'Get info about a country',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const name = args.join(' ').trim();
        if (!name) return conn.sendMessage(from, { text: fancy('❌ Usage: .country Kenya') }, { quoted: msg });
        try {
            const r = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`, { timeout: 8000 });
            const c = r.data?.[0];
            if (!c) throw new Error('Country not found');
            const capital = c.capital?.[0] || '—';
            const region = c.region || '—';
            const pop = (c.population || 0).toLocaleString();
            const curr = Object.values(c.currencies || {})[0]?.name || '—';
            const lang = Object.values(c.languages || {}).join(', ') || '—';
            const text =
                `╭─〔 🌍 ᴄᴏᴜɴᴛʀʏ 〕\n│\n` +
                `│ 🌐 ${c.name?.common || name}\n` +
                `│ 🏛 Capital: ${capital}\n` +
                `│ 📍 Region:  ${region}\n` +
                `│ 👥 Pop:     ${pop}\n` +
                `│ 💰 Currency: ${curr}\n` +
                `│ 🗣 Lang:    ${lang}\n│\n` +
                `╰──────────────────────`;
            await conn.sendMessage(from, { text }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
