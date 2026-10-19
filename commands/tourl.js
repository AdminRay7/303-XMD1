// commands/tourl.js
// Upload media (reply to photo/video) and get a direct URL.
// Usage: (reply to media) .tourl

const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'tourl',
    category: 'tools',
    aliases: ['upload', 'url'],
    description: 'Upload replied media and get a URL',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        if (!quoted) {
            return conn.sendMessage(from, { text: fancy('❌ Reply to a photo, video, or audio with .tourl') }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('📤 Uploading...') }, { quoted: msg });

        try {
            // 1. Download the media
            const quotedMsg = {
                key: {
                    remoteJid: from,
                    fromMe: false,
                    id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                    participant: msg.message.extendedTextMessage.contextInfo.participant
                },
                message: quoted
            };
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: console });

            // 2. Upload to Catbox (Free, no key, max 200MB)
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', buffer, { filename: 'upload.bin' });

            const res = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: form.getHeaders(),
                timeout: 60000
            });

            const url = res.data.trim();

            if (!url.startsWith('http')) throw new Error('Upload failed');

            await conn.sendMessage(from, { 
                text: fancy(`✅ *Uploaded Successfully*\n\n🔗 ${url}`),
                edit: wait.key 
            });

        } catch (e) {
            console.error('[tourl] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
        }
    }
};