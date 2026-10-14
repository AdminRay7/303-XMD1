// commands/autoread.js
// Marks incoming DMs as read (blue ticks).
// Toggle: .autoread on | off | (no args = show state)
// Scope: session-wide.
//
// Note: DMs only. Group messages are NOT affected.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autoread',
    category: 'auto',
    aliases: ['ar'],
    description: 'Auto-mark DMs as read',
    toggleKey: 'autoread',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'autoread', null, config.autoRead === true);
            return conn.sendMessage(from, {
                text: fancy(`👀 Auto-Read (DMs): ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autoread on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'autoread', null, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Auto-Read ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — mark DMs as read
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { isGroup, isChannel, isStatus } = ctx;

        // DM only
        if (isGroup) return false;
        if (isChannel) return false;
        if (isStatus) return false;
        if (msg.key.fromMe) return false;

        try {
            await conn.readMessages([msg.key]);
            console.log(`[autoread] marked read from ${msg.key.remoteJid}`);
        } catch (e) {
            console.error('[autoread] read failed:', e.message);
        }
        return false;
    }
};