// commands/sos.js
// Send an emergency alert to the owner.
// Usage: .sos <message>

const mongoose = require('mongoose');
const { fancy } = require('../lib/font');
const config = require('../config');

// 1. Database Model
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
    description: 'Send an emergency alert to the owner',
    async execute(conn, msg, args, ctx) {
        const { from, sender, pushname, isGroup } = ctx;
        const sosMessage = args.join(' ');

        if (!sosMessage) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}sos <your emergency message>`) }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('🚨 Sending emergency alert...') }, { quoted: msg });

        try {
            // 1. Save to DB
            await SosLog.create({
                senderJid: sender,
                senderName: pushname,
                message: sosMessage,
                chatJid: from,
                isGroup
            });

            // 2. Format the alert for the owner
            const ownerJid = String(config.ownerNumber).replace(/\D/g, '') + '@s.whatsapp.net';
            
            const alertText = 
                `🚨 *EMERGENCY ALERT* 🚨\n\n` +
                `👤 *From:* ${pushname} (${sender.split('@')[0]})\n` +
                `📍 *Chat:* ${isGroup ? 'Group' : 'DM'}\n` +
                `💬 *Message:* ${sosMessage}\n\n` +
                `⏱️ *Time:* ${new Date().toLocaleString()}\n\n` +
                `_Reply to this user immediately._`;

            // 3. Send to Owner
            try {
                await conn.sendMessage(ownerJid, { text: alertText });
            } catch (e) {
                console.error("[sos] Failed to DM owner:", e.message);
            }

            // 4. Confirm to the user
            await conn.sendMessage(from, {
                text: fancy(`✅ *Alert Sent*\n\nThe owner has been notified and is being alerted right now. Please stay where you are and keep your phone on.`),
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