const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autoread',
    category: 'auto',
    aliases: [],
    description: 'Toggle auto-read',
    toggleKey: 'autoread',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'autoread', scope, config.autoRead === true);
            return conn.sendMessage(from, { text: fancy(`👀 Auto-Read: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autoread on|off`) });
        await autoToggles.set(userId, 'autoread', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Auto-Read ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};