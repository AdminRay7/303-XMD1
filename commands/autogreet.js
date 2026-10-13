const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autogreet',
    category: 'auto',
    aliases: [],
    description: 'Toggle auto-greet',
    toggleKey: 'autogreet',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'autogreet', scope, config.autoGreet === true);
            return conn.sendMessage(from, { text: fancy(`🙋 Auto-Greet: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autogreet on|off`) });
        await autoToggles.set(userId, 'autogreet', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Auto-Greet ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};