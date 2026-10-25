const axios = require('axios');

module.exports = {
    name: 'play',
    aliases: ['song', 'music', 'audio'],
    category: 'download',
    description: 'Download songs using Toosii Tech API',
    async execute(conn, msg, args, ctx) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');

        if (!query) {
            return conn.sendMessage(from, { text: '❌ Please provide a song name.\nExample: `.music yatapita`' }, { quoted: msg });
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: msg.key } });
        
        try {
            const apiKey = process.env.TOOSII_TOKEN;
            if (!apiKey) throw new Error("TOOSII_TOKEN is missing from .env");
            
            const headers = { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };

            // We will use a temporary valid YouTube link just to test if the API works.
            // Since the search API is failing, we can't search by text yet.
            const testYouTubeUrl = 'https://www.youtube.com/watch?v=60ItHLz5WEA'; // Alan Walker - Faded

            // 1. TRY POST REQUEST (Since GET gave a 405 error)
            let downloadRes;
            try {
                // Attempt POST with the link in the body
                downloadRes = await axios.post(`https://toosiitechdevelopertools.zone.id/api/download/audio`, { url: testYouTubeUrl }, { headers });
            } catch (postErr) {
                // If POST fails, try GET one more time with a 'link' parameter instead of 'url'
                downloadRes = await axios.get(`https://toosiitechdevelopertools.zone.id/api/download/audio?link=${encodeURIComponent(testYouTubeUrl)}`, { headers });
            }

            const downloadData = downloadRes.data;
            console.log("API Response:", downloadData); // This will print in your bot terminal

            // Extract the direct MP3 link
            let audioUrl = downloadData.url || downloadData.download_url || downloadData.result?.url || downloadData.audio || downloadData.link;

            if (!audioUrl) {
                throw new Error(`API returned success but no audio link. Check console logs.`);
            }

            // 3. SEND AUDIO TO WHATSAPP
            await conn.sendMessage(from, {
                audio: { url: audioUrl },
                mimetype: 'audio/mp4',
                fileName: `${query}.mp3`,
                ptt: false
            }, { quoted: msg });

            await conn.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error("Music API Error:", error.message);
            
            let errorMsg = error.message;
            if (error.response && error.response.data) {
                errorMsg = JSON.stringify(error.response.data);
            }

            await conn.sendMessage(from, { react: { text: '❌', key: msg.key } });
            await conn.sendMessage(from, { 
                text: `❌ Failed to download song.\nError: ${errorMsg}` 
            }, { quoted: msg });
        }
    }
};