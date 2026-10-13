const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autosave',
    category: 'auto',
    aliases: [],
    description: 'Toggle auto-save',
    toggleKey: 'autosave',
    enabled: () => true,
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        const scope = isGroup ? from : null;
        if (action === '') {
            const on = await autoToggles.get(userId, 'autosave', scope, config.autoSave === true);
            return conn.sendMessage(from, { text: fancy(`💾 Auto-Save: ${on ? '✅ ON' : '❌ OFF'}`) });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autosave on|off`) });
        await autoToggles.set(userId, 'autosave', scope, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Auto-Save ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) });
    }
};