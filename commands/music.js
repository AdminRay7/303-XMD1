const axios = require('axios');

module.exports = {
    name: 'play',
    aliases: ['song', 'music', 'audio'],
    category: 'download',
    description: 'Search and download songs using Toosii Tech API',
    async execute(conn, msg, args, ctx) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');

        if (!query) {
            return conn.sendMessage(from, { text: '❌ Please provide a song name.\nExample: `.play Faded Alan Walker`' }, { quoted: msg });
        }

        await conn.sendMessage(from, { react: { text: '🔍', key: msg.key } });
        
        try {
            const apiKey = process.env.TOOSII_TOKEN;
            if (!apiKey) throw new Error("TOOSII_TOKEN is missing from .env");
            
            const headers = { 'Authorization': `Bearer ${apiKey}` };
            const baseUrl = 'https://toosiitechdevelopertools.zone.id';

            // 1. SEARCH YOUTUBE for the song URL
            // (Note: We are guessing the exact parameter name is 'query' or 'q' based on standard APIs)
            let searchUrl = `${baseUrl}/api/search/youtube?query=${encodeURIComponent(query)}`;
            let searchRes = await axios.get(searchUrl, { headers });
            
            let videoUrl = null;
            let title = query;

            // Attempt to extract the URL from the search response
            const searchData = searchRes.data;
            if (searchData && searchData.result) {
                // Adjust this based on how the API returns the search results
                videoUrl = searchData.result.url || searchData.result[0]?.url || searchData.result[0]?.link;
                title = searchData.result.title || searchData.result[0]?.title || query;
            } else if (searchData && searchData.data) {
                videoUrl = searchData.data.url || searchData.data[0]?.url || searchData.data[0]?.link;
                title = searchData.data.title || searchData.data[0]?.title || query;
            }

            // If the search failed to find a URL, stop here
            if (!videoUrl) {
                throw new Error("Could not find a YouTube URL for that song. The API response format might be different.");
            }

            await conn.sendMessage(from, { react: { text: '⬇️', key: msg.key } });

            // 2. DOWNLOAD AUDIO using the videoUrl
            let downloadUrl = `${baseUrl}/api/download/audio?url=${encodeURIComponent(videoUrl)}`;
            let downloadRes = await axios.get(downloadUrl, { headers });

            const downloadData = downloadRes.data;
            
            // Extract the direct MP3 link
            let audioUrl = downloadData.url || downloadData.download_url || downloadData.result?.url || downloadData.audio;

            if (!audioUrl) {
                throw new Error("API did not return an audio download link.");
            }

            // 3. SEND AUDIO TO WHATSAPP
            await conn.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: 'audio/mp4',
                fileName: `${title}.mp3`,
                ptt: false // Set to true if you want it as a voice note
            }, { quoted: msg });

            await conn.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error("Music API Error:", error.message);
            await conn.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await conn.sendMessage(from, { 
                text: `❌ Failed to download song.\nError: ${error.message}` 
            }, { quoted: msg });
        }
    }
};