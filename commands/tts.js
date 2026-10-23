// commands/tts.js
const axios = require('axios');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'tts',
    aliases: ['say', 'speak'],
    category: 'tools',
    description: 'Convert text to a voice note',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();

        if (!text) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Please provide text.\nExample: .tts Hello') 
            }, { quoted: msg });
        }

        try {
            try { await conn.sendPresenceUpdate('recording', from); } catch {}

            // Using a free, reliable TTS endpoint (Google Translate TTS)
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                },
                responseType: 'arraybuffer',
                timeout: 15000
            });

            const audioBuffer = Buffer.from(response.data, "binary");

            // Send as a WhatsApp Voice Note
            await conn.sendMessage(from, { 
                audio: audioBuffer, 
                mimetype: 'audio/mp4', 
                ptt: true 
            }, { quoted: msg });

        } catch (error) {
            console.error('[tts command] Error:', error.message);
            await conn.sendMessage(from, { 
                text: fancy('❌ Failed to generate audio.') 
            }, { quoted: msg });
        }
    }
};