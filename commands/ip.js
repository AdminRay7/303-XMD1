const { fancy } = require('../lib/font');
const axios = require('axios');
module.exports = {
    name: 'ip',
    category: 'misc',
    aliases: ['iplookup'],
    description: 'Look up info about an IP address',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const target = (args[0] || '').trim();
        if (!target) return conn.sendMessage(from, { text: fancy('❌ Usage: .ip 8.8.8.8') }, { quoted: msg });
        try {
            const r = await axios.get(`http://ip-api.com/json/${encodeURIComponent(target)}`, { timeout: 8000 });
            if (r.data?.status !== 'success') throw new Error(r.data?.message || 'Lookup failed');
            const d = r.data;
            const text =
                `╭─〔 🌐 ɪᴘ ɪɴꜰᴏ 〕\n│\n` +
                `│ 🖥 IP:      ${d.query}\n` +
                `│ 🌍 Country: ${d.country} (${d.countryCode})\n` +
                `│ 🏙 City:    ${d.city}\n` +
                `│ 📍 Region:  ${d.regionName}\n` +
                `│ 🕐 Timezone:${d.timezone}\n` +
                `│ 📡 ISP:     ${d.isp}\n│\n` +
                `╰──────────────────────`;
            await conn.sendMessage(from, { text }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
