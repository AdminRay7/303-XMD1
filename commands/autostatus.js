const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'autostatus',
    category: 'auto',
    aliases: ['autolist'],
    description: 'Show all auto-module states for this chat',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const states = await autoToggles.getAll(userId, isGroup ? from : null, {
            antilink:     config.antilink === true,
            antidelete:   config.antidelete === true,
            antispam:     config.antispam === true,
            antibug:      config.antibug === true,
            antimedia:    config.antimedia || 'off',
            anticall:     config.anticall === true,
            statusview:   config.autoStatusView === true,
            statuslike:   config.autoStatusLike === true,
            statusreply:  config.autoStatusReply === true,
            welcome:      config.welcomeMessage === true,
            goodbye:      config.goodbyeMessage === true,
            autoread:     config.autoRead === true,
            autoreact:    config.autoReact === true,
            autosave:     config.autoSave === true,
            autoblock:    false,
            autogreet:    config.autoGreet === true,
            autorespond:  config.aiChatEnabled === true
        });

        let text = `╭─〔 ⚙️ ᴀᴜᴛᴏ sᴛᴀᴛᴜs 〕\n│\n`;
        for (const [name, info] of Object.entries(states)) {
            const v = info.value;
            const label = typeof v === 'boolean'
                ? (v ? '✅ ON ' : '❌ OFF')
                : `⚙️ ${String(v).padEnd(6)}`;
            const scope = info.scope === 'group' ? '📌' : info.scope === 'session' ? '🌐' : '💠';
            text += `│ ${scope} ${name.padEnd(12)} ${label}\n`;
        }
        text += `│\n╰──────────────────────\n`;
        text += `\n📌 group · 🌐 session · 💠 default`;

        return conn.sendMessage(from, { text }, { quoted: msg });
    }
};
