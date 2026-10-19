// commands/mode.js
// Switch the bot between public and private mode.
// Usage: .mode public  OR  .mode private

const { fancy } = require('../lib/font');
const config = require('../config');
const mongoose = require('mongoose');

// We use the Setting model to save the mode in MongoDB
let Setting;
try { ({ Setting } = require('../database/models')); } catch (_) {}

if (!Setting) {
    const settingSchema = new mongoose.Schema({
        key: { type: String, unique: true, index: true },
        value: mongoose.Schema.Types.Mixed,
        updatedAt: { type: Date, default: Date.now }
    });
    Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
}

module.exports = {
    name: 'mode',
    category: 'owner',
    aliases: ['workmode'],
    description: 'Switch bot between public and private mode',
    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;
        
        // Only the owner can change the mode
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        // Show current mode if no arguments
        if (!action) {
            // Check DB first, then fallback to .env
            let currentMode = config.workMode || 'public';
            try {
                const doc = await Setting.findOne({ key: 'work_mode' }).lean();
                if (doc) currentMode = doc.value;
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
            // 1. Save to Database
            await Setting.updateOne(
                { key: 'work_mode' },
                { $set: { value: action, updatedAt: new Date() } },
                { upsert: true }
            );

            // 2. Update runtime memory (so it works instantly without restart)
            config.workMode = action;

            // 3. Reply
            const emoji = action === 'private' ? '🔒' : '🌐';
            const text = `${emoji} *Mode Updated*\n\nBot is now in *${action.toUpperCase()}* mode.\n\n` +
                         (action === 'private' 
                            ? 'Only the owner can use commands.' 
                            : 'Everyone can use commands.');
            
            await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });

        } catch (e) {
            console.error('[mode] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed to update mode: ${e.message}`) }, { quoted: msg });
        }
    }
};