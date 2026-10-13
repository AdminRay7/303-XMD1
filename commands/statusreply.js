const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'statusreply',
    category: 'auto',
    aliases: [],
    description: 'Toggle auto-reply to statuses',
    toggleKey: 'statusreply',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        if (action === '') {
            const on = await autoToggles.get(userId, 'statusreply', null, config.autoStatusReply === true);
            return conn.sendMessage(from, { text: fancy(`💬 Status Reply: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statusreply on|off`) });
        await autoToggles.set(userId, 'statusreply', null, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Status Reply ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};