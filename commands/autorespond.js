const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autorespond',
    category: 'auto',
    aliases: [],
    description: 'Toggle auto-respond',
    toggleKey: 'autorespond',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'autorespond', scope, config.aiChatEnabled === true);
            return conn.sendMessage(from, { text: fancy(`🤖 Auto-Respond: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autorespond on|off`) });
        await autoToggles.set(userId, 'autorespond', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Auto-Respond ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};