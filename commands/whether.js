// commands/weather.js
const axios = require('axios');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'weather',
    aliases: ['climate', 'forecast'],
    category: 'tools',
    description: 'Get the current weather for a city',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const city = args.join(' ').trim();

        if (!city) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Please provide a city name.\nExample: .weather Nairobi') 
            }, { quoted: msg });
        }

        // Get the key from .env
        const apiKey = process.env.WEATHER_API_KEY;
        if (!apiKey) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Weather API key is missing in the server .env file.') 
            }, { quoted: msg });
        }

        try {
            // Call WeatherAPI
            const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no`;
            const { data } = await axios.get(url);

            // Format the reply
            const weatherText = `
🌍 *Weather for ${data.location.name}, ${data.location.country}*

🌡️ *Temperature:* ${data.current.temp_c}°C (${data.current.temp_f}°F)
☁️ *Condition:* ${data.current.condition.text}
💨 *Wind:* ${data.current.wind_kph} km/h (${data.current.wind_dir})
💧 *Humidity:* ${data.current.humidity}%
👁️ *Visibility:* ${data.current.vis_km} km

_Last updated: ${data.current.last_updated}_
            `.trim();

            await conn.sendMessage(from, { text: weatherText }, { quoted: msg });

        } catch (error) {
            console.error('[weather command] Error:', error.message);
            
            // Handle city not found error nicely
            if (error.response && error.response.status === 400) {
                return conn.sendMessage(from, { 
                    text: fancy(`❌ Could not find a city named "${city}".`) 
                }, { quoted: msg });
            }

            await conn.sendMessage(from, { 
                text: fancy('❌ Failed to fetch weather data. Please try again later.') 
            }, { quoted: msg });
        }
    }
};