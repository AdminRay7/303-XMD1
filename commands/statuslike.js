// commands/statuslike.js
// Auto-react to incoming WhatsApp statuses with a random heart/emoji.
// Toggle: .statuslike on | off | (no args = show state)
// Scope: session-wide.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

// Reaction palette
const EMOJIS = [
    '❤️','🧡','💛','💚','🩵','💙','💜','🤎','🖤','🩶','🤍','🩷',
    '⭐','🌟','✨','⚡','💫','💔','♥️','❣️','👀','👁️'
];

module.exports = {
    name: 'statuslike',
    category: 'auto',
    aliases: ['sl'],
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
                text: fancy(`💖 Status Like: ${on ? '✅ ON' : '❌ OFF'}`)
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

        // Try method 1 — pass original msg.key + statusJidList
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
            console.log(`[statuslike] reacted ${emoji} to ${posterJid} (method 1 OK)`);
            return false;
        } catch (e) {
            console.error('[statuslike] method 1 failed:', e.message);
        }

        // Try method 2 — explicit key with participant field
        try {
            await conn.sendMessage(
                'status@broadcast',
                {
                    react: {
                        text: emoji,
                        key: {
                            remoteJid: 'status@broadcast',
                            fromMe: false,
                            id: msg.key.id,
                            participant: posterJid
                        }
                    }
                },
                { statusJidList: [posterJid] }
            );
            console.log(`[statuslike] reacted ${emoji} to ${posterJid} (method 2 OK)`);
            return false;
        } catch (e) {
            console.error('[statuslike] method 2 failed:', e.message);
        }

        return false;
    }
};