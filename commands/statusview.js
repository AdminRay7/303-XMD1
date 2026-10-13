// commands/statusview.js
// Auto-view AND auto-like incoming WhatsApp statuses.
// Toggle: .statusview on | off | (no args = show state)
// Scope: session-wide.
// When ON: every incoming status is marked as viewed AND gets a random emoji reaction.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const EMOJIS = ['🔥', '❤️', '💯', '👏', '😂', '😮', '✨', '👌', '🙌', '💫'];

module.exports = {
    name: 'statusview',
    category: 'auto',
    aliases: ['autoview', 'sv'],
    description: 'Auto-view + auto-like WhatsApp statuses',
    toggleKey: 'statusview',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'statusview', null, config.autoStatusView === true);
            return conn.sendMessage(from, {
                text: fancy(`👁️ Status View + Like: ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statusview on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'statusview', null, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Status View + Like ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — view + react on every incoming status
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const from = msg.key.remoteJid;
        if (from !== 'status@broadcast') return false;
        if (msg.key.fromMe) return false;

        const posterJid = msg.key.participant || msg.participant;
        if (!posterJid) return false;

        // ---- 1. MARK AS VIEWED ----
        try {
            await conn.readMessages([msg.key]);
            console.log(`[statusview] viewed status from ${posterJid}`);
        } catch (e) {
            console.error('[statusview] read failed:', e.message);
        }

        // ---- 2. REACT WITH RANDOM EMOJI ----
        const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
        try {
            await conn.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: msg.key
                    }
                },
                { statusJidList: [posterJid] }
            );
            console.log(`[statusview] reacted ${emoji} to ${posterJid}`);
        } catch (e) {
            console.error('[statusview] react failed:', e.message);
        }

        return false;
    }
};