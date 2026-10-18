// commands/autorespond.js
// Master toggle for AI auto-replies (DMs + groups).
// Toggle: .autorespond on | off | (no args = show state)
// Works alongside .autogreet (greetings reply first, then AI if no match).
// Scope: session-wide.

const aiSettings = require('../lib/aiSettings');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autorespond',
    category: 'auto',
    aliases: ['ar', 'ai'],
    description: 'Turn AI auto-replies ON/OFF session-wide',
    toggleKey: 'autorespond',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        // Show status
        if (action === '') {
            const enabled = aiSettings.isEnabledCached();
            const groupsEnabled = aiSettings.isGroupsEnabledCached();
            return conn.sendMessage(from, {
                text: fancy(
                    `🤖 AI Auto-Respond\n\n` +
                    `Master: ${enabled ? '✅ ON' : '❌ OFF'}\n` +
                    `Groups: ${groupsEnabled ? '✅ ON' : '❌ OFF'}\n\n` +
                    `Usage: ${config.prefix}autorespond on|off`
                )
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autorespond on|off`) });
        }

        const value = action === 'on';
        
        try {
            await aiSettings.setAiEnabled(value);
            await aiSettings.refreshCache();
            
            return conn.sendMessage(from, {
                text: fancy(`✅ AI Auto-Respond ${value ? 'ENABLED' : 'DISABLED'} (all chats).`)
            }, { quoted: msg });
        } catch (e) {
            console.error('[autorespond] error:', e.message);
            return conn.sendMessage(from, {
                text: fancy(`❌ Failed to toggle AI: ${e.message}`)
            }, { quoted: msg });
        }
    }
};