// commands/play.js
const axios = require('axios');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'play',
    aliases: ['song', 'audio'],
    category: 'downloads',
    description: 'Search and download a song as MP3',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const query = args.join(' ').trim();

        if (!query) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Please provide a song name.\nExample: .play Fada Fada') 
            }, { quoted: msg });
        }

        const apiKey = process.env.TOOSII_API_KEY;
        if (!apiKey) {
            return conn.sendMessage(from, { 
                text: fancy('❌ TOOSII_API_KEY is missing in the .env file.') 
            }, { quoted: msg });
        }

        try {
            await conn.sendMessage(from, { react: { text: '🔍', key: msg.key } });

            // Step 1: Search YouTube
            const searchUrl = `https://toosiitechdevelopertools.zone.id/api/search/youtube?query=${encodeURIComponent(query)}`;
            const searchRes = await axios.get(searchUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 15000
            });

            // We need to figure out the exact structure of the response. 
            // It's usually data.results[0].url or data.results[0].id
            let videoUrl = '';
            if (searchRes.data && searchRes.data.data && searchRes.data.data.length > 0) {
                videoUrl = searchRes.data.data[0].url || `https://www.youtube.com/watch?v=${searchRes.data.data[0].videoId}`;
            } else if (searchRes.data && searchRes.data.results && searchRes.data.results.length > 0) {
                videoUrl = searchRes.data.results[0].url || `https://www.youtube.com/watch?v=${searchRes.data.results[0].videoId}`;
            } else {
                throw new Error("No search results found.");
            }

            await conn.sendMessage(from, { react: { text: '⬇️', key: msg.key } });

            // Step 2: Download Audio
            // Assuming the API takes the URL to download
            const downloadUrl = `https://toosiitechdevelopertools.zone.id/api/download/audio?url=${encodeURIComponent(videoUrl)}`;
            const downloadRes = await axios.get(downloadUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 30000
            });

            // Usually, download APIs return a direct link to the MP3
            const mp3Url = downloadRes.data.downloadUrl || downloadRes.data.url || downloadRes.data.link;

            if (!mp3Url) {
                throw new Error("API did not return a download link.");
            }

            // Send the audio to WhatsApp
            await conn.sendMessage(from, {
                audio: { url: mp3Url },
                mimetype: 'audio/mp4',
                ptt: false
            }, { quoted: msg });

            await conn.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[play command] Error:', error.response?.data || error.message);
            await conn.sendMessage(from, { 
                text: fancy(`❌ Failed to download song. Error: ${error.message}`) 
            }, { quoted: msg });
            await conn.sendMessage(from, { react: { text: '❌', key: msg.key } });
        }
    }
};