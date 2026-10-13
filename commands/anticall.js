const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'anticall',
    category: 'auto',
    aliases: [],
    description: 'Toggle anti-call',
    toggleKey: 'anticall',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'anticall', scope, config.anticall === true);
            return conn.sendMessage(from, { text: fancy(`📞 Anti-Call: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}anticall on|off`) });
        await autoToggles.set(userId, 'anticall', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Anti-Call ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};