// commands/imagine.js
// Generate an AI image from text.
// Usage: .imagine a futuristic city at sunset

const axios = require('axios');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'imagine',
    category: 'ai',
    aliases: ['img', 'gen'],
    description: 'Generate an AI image from a prompt',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const prompt = args.join(' ');

        if (!prompt) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}imagine <prompt>`) }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('🎨 Generating image... (this takes 5-10s)') }, { quoted: msg });

        try {
            // Pollinations AI is completely free and requires no API key
            const encoded = encodeURIComponent(prompt);
            const url = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true`;
            
            // Fetch the image as a buffer
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
            const buffer = Buffer.from(res.data, 'binary');

            await conn.sendMessage(from, { 
                image: buffer, 
                caption: fancy(`🎨 *Generated:* ${prompt}`) 
            }, { quoted: msg });

            // Delete the "Generating..." message
            try { await conn.sendMessage(from, { delete: wait.key }); } catch {}

        } catch (e) {
            console.error('[imagine] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to generate image: ${e.message}`), edit: wait.key });
        }
    }
};