const { fancy } = require('../lib/font');
const axios = require('axios');
module.exports = {
    name: 'weather',
    category: 'misc',
    aliases: ['w'],
    description: 'Get current weather for a city',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const city = args.join(' ').trim();
        if (!city) return conn.sendMessage(from, { text: fancy('❌ Usage: .weather Nairobi') }, { quoted: msg });
        try {
            const geo = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
                params: { name: city, count: 1 }, timeout: 8000
            });
            if (!geo.data.results?.length) throw new Error('City not found');
            const { latitude, longitude, name, country } = geo.data.results[0];

            const w = await axios.get('https://api.open-meteo.com/v1/forecast', {
                params: {
                    latitude, longitude,
                    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code'
                }, timeout: 8000
            });
            const cur = w.data.current;
            const text =
                `╭─〔 🌤 ᴡᴇᴀᴛʜᴇʀ 〕\n│\n` +
                `│ 📍 ${name}, ${country}\n` +
                `│ 🌡 Temp:   ${cur.temperature_2m}°C\n` +
                `│ 💧 Humid:  ${cur.relative_humidity_2m}%\n` +
                `│ 💨 Wind:   ${cur.wind_speed_10m} km/h\n│\n` +
                `╰──────────────────────`;
            await conn.sendMessage(from, { text }, { quoted: msg });
        } catch (e) {
            await conn.sendMessage(from, { text: fancy(`❌ ${e.message}`) }, { quoted: msg });
        }
    }
};
