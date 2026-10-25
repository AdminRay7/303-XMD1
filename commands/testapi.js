const axios = require('axios');

module.exports = {
    name: 'testapi',
    category: 'admin',
    description: 'Debug Toosii API',
    async execute(conn, msg, args, ctx) {
        const from = msg.key.remoteJid;
        
        if (!ctx.isOwner) {
            return conn.sendMessage(from, { text: '❌ Owner only command.' }, { quoted: msg });
        }

        const apiKey = process.env.TOOSII_TOKEN;
        if (!apiKey) {
            return conn.sendMessage(from, { text: '❌ Missing TOOSII_TOKEN in .env' }, { quoted: msg });
        }

        await conn.sendMessage(from, { text: '⏳ Testing Toosii API...' }, { quoted: msg });

        const testUrl = 'https://www.youtube.com/watch?v=60ItHLz5WEA'; // Faded
        const endpoint = `https://toosiitechdevelopertools.zone.id/api/download/audio?url=${encodeURIComponent(testUrl)}`;

        try {
            const res = await axios.get(endpoint, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                timeout: 20000 // Wait max 20 seconds
            });

            // If it works, show the JSON data
            const result = JSON.stringify(res.data, null, 2);
            await conn.sendMessage(from, { text: `✅ *API RESPONSE:*\n\n\`\`\`json\n${result}\n\`\`\`` }, { quoted: msg });

        } catch (error) {
            // If it fails, show the exact error from their server
            let errorDetails = error.message;
            if (error.response) {
                errorDetails = JSON.stringify(error.response.data, null, 2);
            }
            
            await conn.sendMessage(from, { 
                text: `❌ *API ERROR:*\n\n\`\`\`json\n${errorDetails}\n\`\`\`` 
            }, { quoted: msg });
        }
    }
};