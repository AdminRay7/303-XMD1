const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { fancy } = require('../lib/font');

// Resolve /Assets folder at project root
const ASSETS_DIR = path.join(__dirname, '..', 'Assets');

function findMenuImage() {
    if (!fs.existsSync(ASSETS_DIR)) return null;
    const files = fs.readdirSync(ASSETS_DIR);
    // Look for any file starting with "menu" (png/jpg/jpeg/webp/gif)
    const img = files.find(f =>
        /^menu\.(png|jpe?g|webp|gif)$/i.test(f)
    );
    return img ? path.join(ASSETS_DIR, img) : null;
}

// Reload commands fresh from disk (so menu is always accurate)
function scanCommands() {
    const cmdPath = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(cmdPath)) return [];

    const seenModules = new Set();
    const list = [];

    const walk = (dir) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                walk(itemPath);
            } else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(itemPath)];
                    const mod = require(itemPath);
                    if (!mod || typeof mod.execute !== 'function') continue;
                    if (seenModules.has(mod)) continue;
                    seenModules.add(mod);

                    const category = path.basename(path.dirname(itemPath)) === 'commands'
                        ? 'general'
                        : path.basename(path.dirname(itemPath));

                    list.push({
                        name: mod.name || path.basename(itemPath, '.js'),
                        aliases: Array.isArray(mod.aliases) ? mod.aliases : [],
                        category,
                        file: item
                    });
                } catch (e) {
                    console.error(`menu scan: ${itemPath}:`, e.message);
                }
            }
        }
    };

    walk(cmdPath);
    return list;
}

function buildMenuText(cmds) {
    // Group by category
    const groups = {};
    for (const c of cmds) {
        const cat = c.category || 'general';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(c);
    }

    let text =
        `╭─── • 🔑 • ───╮\n` +
        `   ${fancy(config.botName)} ᴠ${config.version}\n` +
        `╰─── • 🔑 • ───╯\n\n` +
        `👤 *Owner:*  ${config.ownerName}\n` +
        `📡 *Prefix:* ${config.prefix}\n` +
        `📦 *Total:*  ${cmds.length} command${cmds.length === 1 ? '' : 's'}\n\n`;

    for (const cat of Object.keys(groups).sort()) {
        text += `┌─── • ${fancy(cat.toUpperCase())} • ───┐\n`;
        for (const c of groups[cat].sort((a, b) => a.name.localeCompare(b.name))) {
            text += `│ ${config.prefix}${c.name}`;
            if (c.aliases.length) text += `  (${c.aliases.map(a => config.prefix + a).join(', ')})`;
            text += `\n`;
        }
        text += `└────────────────────┘\n\n`;
    }

    text += `_${fancy(config.footer)}_`;
    return text;
}

module.exports = {
    name: 'menu',
    aliases: ['help', 'commands', 'cmds'],
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const cmds = scanCommands();
        const text = buildMenuText(cmds);

        const imgPath = findMenuImage();

        if (imgPath) {
            try {
                const buffer = await fs.readFile(imgPath);
                await conn.sendMessage(from, {
                    image: buffer,
                    caption: text
                }, { quoted: msg });
                return;
            } catch (e) {
                console.error('Menu image send failed:', e.message);
                // fall through to text
            }
        }

        // No image → send text
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};