// commands/statuslike.js
// Auto-react to incoming WhatsApp statuses with a random emoji.
// Toggle: .statuslike on | off | (no args = show state)
// Scope: session-wide.
//
// Fixed: uses the ORIGINAL msg.key (with participant) + statusJidList.
// This is the only format Baileys 6.7.x accepts for status reactions.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const EMOJIS = ['🔥', '❤️', '💯', '👏', '😂', '😮', '✨', '👌', '🙌', '💫'];

module.exports = {
    name: 'statuslike',
    category: 'auto',
    aliases: ['autolike', 'sl'],
    description: 'Auto-react to WhatsApp statuses',
    toggleKey: 'statuslike',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'statuslike', null, config.autoStatusLike === true);
            return conn.sendMessage(from, {
                text: fancy(`❤️ Status Like: ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statuslike on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'statuslike', null, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Status Like ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — react on every incoming status
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const from = msg.key.remoteJid;
        if (from !== 'status@broadcast') return false;
        if (msg.key.fromMe) return false;

        const posterJid = msg.key.participant || msg.participant;
        if (!posterJid) {
            console.log('[statuslike] no participant in key');
            return false;
        }

        const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

        // Baileys 6.7.x — the reaction on a status requires:
        //   - the ORIGINAL message key (which already includes participant)
        //   - statusJidList containing the poster's JID
        try {
            const result = await conn.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: msg.key
                    }
                },
                { statusJidList: [posterJid] }
            );
            console.log(`[statuslike] reacted ${emoji} to ${posterJid}`, result?.key?.id || '');
        } catch (e) {
            console.error('[statuslike] react failed:', e.message);
        }

        return false;
    }
};