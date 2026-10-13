const config = require('../config');
const { fancy } = require('../lib/font');
const autoToggles = require('../lib/autoToggles');

module.exports = {
    name: 'auto',
    category: 'admin',
    aliases: ['toggle', 'set'],
    description: 'Turn auto-detection features on/off',

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, prefix } = ctx;
        if (!isOwner) {
            return conn.sendMessage(from, { text: fancy('❌ Owner only.') }, { quoted: msg });
        }

        const sub = (args[0] || '').toLowerCase().trim();
        const action = (args[1] || '').toLowerCase().trim();

        // ---------- LIST ----------
        if (!sub || sub === 'list') {
            const status = await autoToggles.getStatus();
            let text = `╭─〔 ⚙️ ᴀᴜᴛᴏ ᴛᴏɢɢʟᴇꜱ 〕\n│\n`;
            for (const [name, on] of Object.entries(status)) {
                text += `│ ${name.padEnd(16)} ${on ? '✅ ON' : '❌ OFF'}\n`;
            }
            text += `│\n╰──────────────────────\n\n`;
            text += `_Usage: ${prefix}auto <name> <on|off>_`;
            return conn.sendMessage(from, { text }, { quoted: msg });
        }

        // ---------- TOGGLE ----------
        if (!autoToggles.FEATURES.includes(sub)) {
            return conn.sendMessage(from, {
                text: fancy(`❌ Unknown: ${sub}\n\nUse ${prefix}auto list`)
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, {
                text: fancy(`❌ Usage: ${prefix}auto ${sub} <on|off>`)
            }, { quoted: msg });
        }

        const enabled = action === 'on';
        await autoToggles.setEnabled(sub, enabled);

        return conn.sendMessage(from, {
            text: fancy(`✅ ${sub} → ${enabled ? 'ON' : 'OFF'}`)
        }, { quoted: msg });
    }
};