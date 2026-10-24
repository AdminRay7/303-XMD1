// commands/livetv.js
const axios = require('axios');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'livetv',
    aliases: ['tv', 'channels'],
    category: 'general',
    description: 'Get live TV channels for a country',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const country = args[0] ? args[0].toUpperCase() : 'KE';
        const limit = args[1] || 5;

        const apiKey = 'TSK_109_d0945231743c61dfd9036a32b70e558378e82424c049a927';

        try {
            const url = `https://toosiitechdevelopertools.zone.id/api/v1/live-tv?country=${country}&limit=${limit}`;
            
            const { data } = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                },
                timeout: 15000
            });

            if (!data || !data.data || data.data.length === 0) {
                return conn.sendMessage(from, { 
                    text: fancy(`❌ No live TV channels found for ${country}.`) 
                }, { quoted: msg });
            }

            let text = `📺 *Live TV (${country})*\n\n`;

            data.data.forEach((channel, i) => {
                text += `*${i + 1}. ${channel.name || 'Unknown Channel'}*\n`;
                if (channel.category) text += `Category: ${channel.category}\n`;
                if (channel.url) text += `🔗 ${channel.url}\n`;
                text += `\n`;
            });

            await conn.sendMessage(from, { text }, { quoted: msg });

        } catch (error) {
            console.error('[livetv command] Error:', error.response?.data || error.message);
            await conn.sendMessage(from, { 
                text: fancy('❌ Failed to fetch TV channels. The API might be down or the token expired.') 
            }, { quoted: msg });
        }
    }
};