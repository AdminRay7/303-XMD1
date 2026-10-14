// commands/autoreact.js
// Reacts to incoming DMs with a random emoji.
// Toggle: .autoreact on | off | (no args = show state)
// Scope: session-wide.
//
// Note: DMs only. Group messages are NOT affected.

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const EMOJIS = [
    '❤️','🧡','💛','💚','🩵','💙','💜','🤎','🖤','🩶','🤍','🩷',
    '⭐','🌟','✨','⚡','💫','💯','🔥','👏','🙌','😍','😎','🤩',
    '😂','😁','🥰','😊','👍','👌','🤝'
];

module.exports = {
    name: 'autoreact',
    category: 'auto',
    aliases: ['arc'],
    description: 'Auto-react to incoming DMs',
    toggleKey: 'autoreact',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'autoreact', null, config.autoReact === true);
            return conn.sendMessage(from, {
                text: fancy(`💫 Auto-React (DMs): ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autoreact on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'autoreact', null, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Auto-React ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — react to DMs
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { isGroup, isChannel, isStatus } = ctx;

        // DM only
        if (isGroup) return false;
        if (isChannel) return false;
        if (isStatus) return false;
        if (msg.key.fromMe) return false;

        const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

        try {
            await conn.sendMessage(msg.key.remoteJid, {
                react: { text: emoji, key: msg.key }
            });
            console.log(`[autoreact] reacted ${emoji} in DM`);
        } catch (e) {
            console.error('[autoreact] react failed:', e.message);
        }
        return false;
    }
};