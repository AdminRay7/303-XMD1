// commands/help.js
// Detailed help for a specific command.
// Usage: .help <command>

const fs = require('fs-extra');
const path = require('path');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'help',
    category: 'general',
    aliases: ['h'],
    description: 'Get detailed help for a command',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const target = (args[0] || '').toLowerCase();

        if (!target) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}help <command>`) }, { quoted: msg });
        }

        // Find command file
        const cmdDir = path.join(__dirname);
        let found = null;

        const walk = (dir) => {
            for (const item of fs.readdirSync(dir)) {
                const full = path.join(dir, item);
                if (fs.statSync(full).isDirectory()) { walk(full); continue; }
                if (!item.endsWith('.js')) continue;
                try {
                    delete require.cache[require.resolve(full)];
                    const mod = require(full);
                    if (mod.name === target || (Array.isArray(mod.aliases) && mod.aliases.includes(target))) {
                        found = mod;
                        break;
                    }
                } catch {}
            }
        };
        walk(cmdDir);

        if (!found) {
            return conn.sendMessage(from, { text: fancy(`❌ Command "${target}" not found.`) }, { quoted: msg });
        }

        let text = `📖 *COMMAND INFO*\n\n`;
        text += `📌 Name: ${config.prefix}${found.name}\n`;
        if (found.aliases && found.aliases.length) text += `🔗 Aliases: ${found.aliases.map(a => config.prefix + a).join(', ')}\n`;
        text += `📁 Category: ${found.category || 'general'}\n`;
        text += `📝 Desc: ${found.description || 'No description'}\n`;

        await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
    }
};