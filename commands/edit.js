// commands/edit.js
// Advanced Image Editing using ModelsLab (img2img)
// Usage: (reply to a photo) .edit make it wear a red suit

const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'edit',
    category: 'ai',
    aliases: ['img2img', 'transform', 'swap'],
    description: 'Advanced AI image editor',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const prompt = args.join(' ');
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

        // Get key from config
        const apiKey = config.modelslabKey;

        if (!apiKey) {
            return conn.sendMessage(from, { text: fancy('❌ ModelsLab API key is missing.') }, { quoted: msg });
        }

        if (!quoted || !quoted.imageMessage) {
            return conn.sendMessage(from, { text: fancy('❌ Reply to a photo with .edit <prompt>') }, { quoted: msg });
        }
        if (!prompt) {
            return conn.sendMessage(from, { text: fancy('❌ Please provide a prompt (e.g., .edit red suit)') }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('🎨 Editing image with AI... (20-30s)') }, { quoted: msg });

        try {
            // 1. Download the replied image
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
            const base64Image = buffer.toString('base64');

            // 2. Send to ModelsLab Img2Img API
            const payload = {
                key: apiKey,
                model_id: "sdxl", // SDXL is very good at clothing and detail
                prompt: `photorealistic, high quality, 8k, ${prompt}`,
                negative_prompt: "deformed, distorted, ugly, bad anatomy, extra limbs, bad hands, low quality",
                init_image: base64Image,
                strength: 0.6, // 0.6 keeps the face mostly the same but changes clothes
                width: "1024",
                height: "1024",
                samples: "1",
                num_inference_steps: "30",
                safety_checker: "no",
                enhance_prompt: "yes"
            };

            const response = await axios.post("https://modelslab.com/api/v6/images/img2img", payload, {
                headers: { "Content-Type": "application/json" },
                timeout: 90000
            });

            if (response.data.status === 'error') {
                throw new Error(response.data.message || "ModelsLab API Error");
            }

            // 3. Get the generated image URL and download it
            const outputUrl = response.data.output[0];
            const imageRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
            const editedBuffer = Buffer.from(imageRes.data, 'binary');

            // 4. Send result back to WhatsApp
            await conn.sendMessage(from, { 
                image: editedBuffer, 
                caption: fancy(`🎨 *Edited:* ${prompt}`) 
            }, { quoted: msg });

            try { await conn.sendMessage(from, { delete: wait.key }); } catch {}

        } catch (e) {
            console.error('[edit] error:', e.message);
            await conn.sendMessage(from, { 
                text: fancy(`❌ Failed to edit image.\n\n_Reason: ${e.message}_`), 
                edit: wait.key 
            });
        }
    }
};