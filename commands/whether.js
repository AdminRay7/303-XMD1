// commands/weather.js
// Get the weather for a city.
// Usage: .weather Nairobi

const axios = require('axios');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'weather',
    category: 'tools',
    aliases: ['temp'],
    description: 'Get weather for a city',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const city = args.join(' ');

        if (!city) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}weather <city>`) }, { quoted: msg });
        }

        try {
            // wttr.in is a free weather API. format=j1 returns JSON.
            const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
            const { data } = await axios.get(url, { timeout: 10000 });

            const current = data.current_condition[0];
            const temp = current.temp_C;
            const feelsLike = current.FeelsLikeC;
            const desc = current.weatherDesc[0].value;
            const humidity = current.humidity;
            const wind = current.windspeedKmph;

            const text = `🌍 *Weather in ${city.toUpperCase()}*\n\n` +
                         `🌡️ *Temp:* ${temp}°C (Feels like ${feelsLike}°C)\n` +
                         `☁️ *Condition:* ${desc}\n` +
                         `💧 *Humidity:* ${humidity}%\n` +
                         `💨 *Wind:* ${wind} km/h`;

            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
        } catch (e) {
            console.error('[weather] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Could not get weather for "${city}". Check the spelling.`) }, { quoted: msg });
        }
    }
};