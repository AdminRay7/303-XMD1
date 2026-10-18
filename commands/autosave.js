// commands/autosave.js
// Tracks user activity (messages sent, last seen) in MongoDB.
// Toggle: .autosave on | off | (no args = show state)
// Scope: session-wide.
//
// Note: Basic saving is already hardcoded into handler.js. This command
// updates the runtime toggle so you can turn it off if the database
// is getting too large.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autosave',
    category: 'auto',
    aliases: ['save'],
    description: 'Track user activity in database',
    toggleKey: 'autosave',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'autosave', null, config.autoSave === true);
            return conn.sendMessage(from, {
                text: fancy(
                    `💾 Auto-Save: ${on ? '✅ ON' : '❌ OFF'}\n` +
                    `Tracks message counts and last-seen times.`
                )
            }, { quoted: msg });
        }
        
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autosave on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'autosave', null, value);
        
        return conn.sendMessage(from, {
            text: fancy(`✅ Auto-Save ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isOwner, pushname, userId } = ctx;

        if (isOwner) return false;
        if (msg.key.fromMe) return false;

        // Import User model directly to keep this independent of handler.js
        const { User } = require('../database/models');

        try {
            // Use findOneAndUpdate to avoid race conditions
            await User.findOneAndUpdate(
                { jid: sender },
                { 
                    $set: { 
                        name: pushname || "Unknown",
                        sessionId: userId,
                        lastActive: new Date()
                    },
                    $inc: { messageCount: 1 }
                },
                { upsert: true, new: true }
            );
        } catch (e) {
            console.error('[autosave] save failed:', e.message);
        }

        return false; // don't consume
    }
};