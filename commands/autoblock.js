const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autoblock',
    category: 'auto',
    aliases: [],
    description: 'Toggle auto-block',
    toggleKey: 'autoblock',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'autoblock', scope, false);
            return conn.sendMessage(from, { text: fancy(`🚫 Auto-Block: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autoblock on|off`) });
        await autoToggles.set(userId, 'autoblock', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Auto-Block ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};