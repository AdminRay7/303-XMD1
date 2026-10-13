const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'statuslike',
    category: 'auto',
    aliases: ['autolike'],
    description: 'Toggle auto-like of statuses',
    toggleKey: 'statuslike',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        if (action === '') {
            const on = await autoToggles.get(userId, 'statuslike', null, config.autoStatusLike === true);
            return conn.sendMessage(from, { text: fancy(`❤️ Status Like: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statuslike on|off`) });
        await autoToggles.set(userId, 'statuslike', null, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Status Like ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};