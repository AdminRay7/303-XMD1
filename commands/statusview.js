const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'statusview',
    category: 'auto',
    aliases: ['autoview'],
    description: 'Toggle auto-view of statuses',
    toggleKey: 'statusview',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        if (action === '') {
            const on = await autoToggles.get(userId, 'statusview', null, config.autoStatusView === true);
            return conn.sendMessage(from, { text: fancy(`👁️ Status View: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statusview on|off`) });
        await autoToggles.set(userId, 'statusview', null, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Status View ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};