// commands/statusview.js
// Auto-view incoming WhatsApp statuses.
// Toggle: .statusview on | off | (no args = show state)

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'statusview',
    category: 'auto',
    aliases: ['autoview', 'sv'],
    description: 'Auto-view WhatsApp statuses',
    toggleKey: 'statusview',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'statusview', null, config.autoStatusView === true);
            return conn.sendMessage(from, {
                text: fancy(`👁️ Status View: ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statusview on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'statusview', null, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Status View ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    async onMessage(conn, msg, ctx) {
        const from = msg.key.remoteJid;
        if (from !== 'status@broadcast') return false;
        if (msg.key.fromMe) return false;

        try {
            await conn.readMessages([msg.key]);
            console.log(`[statusview] viewed ${msg.key.participant || msg.participant}`);
        } catch (e) {
            console.error('[statusview] read failed:', e.message);
        }
        return false;
    }
};