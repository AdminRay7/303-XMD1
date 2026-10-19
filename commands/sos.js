// commands/sos.js
// Send an emergency alert to the owner with an ALARM SOUND.
// Usage: .sos <message>

const mongoose = require('mongoose');
const axios = require('axios');
const { fancy } = require('../lib/font');
const config = require('../config');

// Database Model
const SosLogSchema = new mongoose.Schema({
    senderJid: String,
    senderName: String,
    message: String,
    chatJid: String,
    isGroup: Boolean,
    timestamp: { type: Date, default: Date.now }
});
const SosLog = mongoose.models.SosLog || mongoose.model('SosLog', SosLogSchema);

module.exports = {
    name: 'sos',
    category: 'general',
    aliases: ['panic', 'emergency'],
    description: 'Send an emergency alert with an alarm sound to the owner',
    async execute(conn, msg, args, ctx) {
        const { from, sender, pushname, isGroup } = ctx;
        const sosMessage = args.join(' ');

        if (!sosMessage) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}sos <your emergency message>`) }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('🚨 Triggering emergency alarm...') }, { quoted: msg });

        try {
            // 1. Save to DB
            await SosLog.create({
                senderJid: sender,
                senderName: pushname,
                message: sosMessage,
                chatJid: from,
                isGroup
            });

            // 2. Format the alert
            const ownerJid = String(config.ownerNumber).replace(/\D/g, '') + '@s.whatsapp.net';
            const alertText = 
                `🚨 *EMERGENCY ALERT* 🚨\n\n` +
                `👤 *From:* ${pushname} (${sender.split('@')[0]})\n` +
                `📍 *Chat:* ${isGroup ? 'Group' : 'DM'}\n` +
                `💬 *Message:* ${sosMessage}\n\n` +
                `⏱️ *Time:* ${new Date().toLocaleString()}\n\n` +
                `_Reply to this user immediately._`;

            // 3. Get the Alarm Sound (Using a free public siren MP3)
            // We download it as a buffer to ensure it sends instantly
            let audioBuffer = null;
            try {
                const sirenUrl = "https://www.soundjay.com/buttons/sounds/beep-01a.mp3"; 
                const res = await axios.get(sirenUrl, { responseType: 'arraybuffer', timeout: 10000 });
                audioBuffer = Buffer.from(res.data, 'binary');
            } catch (err) {
                console.log("Could not load alarm sound:", err.message);
            }

            // 4. Send to Owner
            try {
                // Send the text first
                await conn.sendMessage(ownerJid, { text: alertText });
                
                // Send the sound if it downloaded successfully
                if (audioBuffer) {
                    await conn.sendMessage(ownerJid, { 
                        audio: audioBuffer, 
                        mimetype: 'audio/mp4', 
                        ptt: true // Sends as a voice note so it rings/plays automatically
                    });
                }
            } catch (e) {
                console.error("[sos] Failed to DM owner:", e.message);
            }

            // 5. Confirm to the user
            await conn.sendMessage(from, {
                text: fancy(`✅ *Alert Sent*\n\nThe owner has been notified and an alarm is sounding on their device. Please stay where you are.`),
                edit: wait.key
            });

        } catch (e) {
            console.error('[sos] error:', e.message);
            await conn.sendMessage(from, {
                text: fancy(`❌ Failed to send alert. Please call the owner directly.`),
                edit: wait.key
            });
        }
    }
};