// commands/tts.js
const axios = require('axios');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'tts',
    aliases: ['say', 'speak'],
    category: 'tools',
    description: 'Convert text to a voice note using Groq',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();

        if (!text) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Please provide text to speak.\nExample: .tts Hello, I am 303-XMD') 
            }, { quoted: msg });
        }

        if (text.length > 200) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Text is too long. Please keep it under 200 characters.') 
            }, { quoted: msg });
        }

        const apiKey = (process.env.AI_API_KEY || "").trim();
        if (!apiKey) {
            return conn.sendMessage(from, { 
                text: fancy('❌ AI_API_KEY is missing in the .env file.') 
            }, { quoted: msg });
        }

        try {
            // Show recording presence
            try { await conn.sendPresenceUpdate('recording', from); } catch {}

            // Call Groq Audio API
            const response = await axios.post("https://api.groq.com/openai/v1/audio/speech", {
                model: "canopylabs/orpheus-v1-english",
                input: text,
                voice: "troy", // Options: troy, diana, hannah, autumn, austin, daniel
                response_format: "mp3"
            }, {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                responseType: "arraybuffer",
                timeout: 30000
            });

            const audioBuffer = Buffer.from(response.data, "binary");

            // Send as WhatsApp Voice Note (ptt: true)
            await conn.sendMessage(from, { 
                audio: audioBuffer, 
                mimetype: 'audio/mp4', 
                ptt: true 
            }, { quoted: msg });

        } catch (error) {
            console.error('[tts command] Error:', error.response?.data || error.message);
            await conn.sendMessage(from, { 
                text: fancy('❌ Failed to generate audio. Please try again.') 
            }, { quoted: msg });
        }
    }
};