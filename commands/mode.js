// commands/mode.js
// Switch the bot between public and private mode (Per Session).
// Usage: .mode public  OR  .mode private

const { fancy } = require('../lib/font');
const config = require('../config');
const mongoose = require('mongoose');

// 1. Create a standalone model for session modes
const SessionModeSchema = new mongoose.Schema({
    sessionId: { type: String, unique: true, index: true },
    mode: { type: String, default: 'public' }, // 'public' or 'private'
    updatedAt: { type: Date, default: Date.now }
});
const SessionMode = mongoose.models.SessionMode || mongoose.model('SessionMode', SessionModeSchema);

module.exports = {
    name: 'mode',
    category: 'owner',
    aliases: ['workmode'],
    description: 'Switch bot mode for THIS session only',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        
        // Only the session owner can change the mode for their bot
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        // Show current mode
        if (!action) {
            let currentMode = config.workMode || 'public';
            try {
                const doc = await SessionMode.findOne({ sessionId: userId }).lean();
                if (doc) currentMode = doc.mode;
            } catch {}

            const text = `⚙️ *Bot Mode*\n\n` +
                         `Current: *${currentMode.toUpperCase()}*\n\n` +
                         `Usage:\n` +
                         `${config.prefix}mode public\n` +
                         `${config.prefix}mode private`;
            return conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
        }

        if (!['public', 'private'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`❌ Invalid mode. Use ${config.prefix}mode public or private.`) });
        }

        try {
            // Save to Database for THIS session only
            await SessionMode.updateOne(
                { sessionId: userId },
                { $set: { mode: action, updatedAt: new Date() } },
                { upsert: true }
            );

            const emoji = action === 'private' ? '🔒' : '🌐';
            const text = `${emoji} *MODE UPDATED*\n\n` +
                         `This bot is now in *${action.toUpperCase()}* mode.\n\n` +
                         (action === 'private' 
                            ? 'Only the owner can use commands on this session.' 
                            : 'Everyone can use commands on this session.');
            
            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });

        } catch (e) {
            console.error('[mode] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to update mode: ${e.message}`) }, { quoted: msg });
        }
    }
};