const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autoreact',
    category: 'auto',
    aliases: [],
    description: 'Toggle auto-react',
    toggleKey: 'autoreact',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'autoreact', scope, config.autoReact === true);
            return conn.sendMessage(from, { text: fancy(`💫 Auto-React: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autoreact on|off`) });
        await autoToggles.set(userId, 'autoreact', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Auto-React ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};