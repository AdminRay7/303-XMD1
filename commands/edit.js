// commands/edit.js
// Advanced Image Editing using ModelsLab (img2img)
// Usage: Reply to a photo with .edit <prompt>

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
        
        if (!prompt) {
            return conn.sendMessage(from, { text: fancy('❌ Please provide a prompt (e.g., .edit red suit)') }, { quoted: msg });
        }

        const apiKey = config.modelslabKey;
        if (!apiKey) {
            return conn.sendMessage(from, { text: fancy('❌ ModelsLab API key is missing.') }, { quoted: msg });
        }

        // --- FIX: Safely find the replied message context ---
        const msgContext = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = msgContext?.quotedMessage;

        if (!quoted || !quoted.imageMessage) {
            return conn.sendMessage(from, { text: fancy('❌ Please *swipe/reply* directly to a photo and type .edit <prompt>') }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('🎨 Editing image with AI... (20-30s)') }, { quoted: msg });

        try {
            const quotedMsg = {
                key: { 
                    remoteJid: from, 
                    fromMe: false, 
                    id: msgContext.stanzaId, // Safely grabbed above
                    participant: msgContext.participant 
                },
                message: quoted
            };
            
            // Download the image
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: console });
            const base64Image = buffer.toString('base64');

            // Send to ModelsLab
            const payload = {
                key: apiKey,
                model_id: "sdxl",
                prompt: `photorealistic, high quality, 8k, ${prompt}`,
                negative_prompt: "deformed, distorted, ugly, bad anatomy, extra limbs, bad hands, low quality",
                init_image: base64Image,
                strength: 0.55, // 0.55 keeps the face identical but changes the clothes
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

            // Get and send the edited image
            const outputUrl = response.data.output[0];
            const imageRes = await axios.get(outputUrl, { responseType: 'arraybuffer' });
            const editedBuffer = Buffer.from(imageRes.data, 'binary');

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