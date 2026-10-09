const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { fancy } = require('../lib/font');

// Resolve /Assets folder at project root
const ASSETS_DIR = path.join(__dirname, '..', 'Assets');

function findMenuImage() {
    if (!fs.existsSync(ASSETS_DIR)) return null;
    const files = fs.readdirSync(ASSETS_DIR);
    const img = files.find(f => /^menu\.(png|jpe?g|webp|gif)$/i.test(f));
    return img ? path.join(ASSETS_DIR, img) : null;
}

// Scan commands fresh every call — always reflects the real folder
function scanCommands() {
    const cmdPath = path.join(__dirname, '..', 'commands');
    if (!fs.existsSync(cmdPath)) return [];

    const seen = new Set();
    const list = [];

    const walk = (dir, baseDir) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                walk(itemPath, baseDir);
            } else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(itemPath)];
                    const mod = require(itemPath);
                    if (!mod || typeof mod.execute !== 'function') continue;
                    if (seen.has(mod)) continue;
                    seen.add(mod);

                    // Category = subfolder name, or "general" if directly in commands/
                    const rel = path.relative(baseDir, dir);
                    const category = rel === '' ? 'general' : rel.split(path.sep)[0].toLowerCase();

                    list.push({
                        name: (mod.name || path.basename(itemPath, '.js')).toLowerCase(),
                        category
                    });
                } catch (e) {
                    console.error(`menu scan: ${itemPath}:`, e.message);
                }
            }
        }
    };

    walk(cmdPath, cmdPath);
    return list;
}

function buildMenuText(cmds, ctx) {
    const groups = {};
    for (const c of cmds) {
        if (!groups[c.category]) groups[c.category] = [];
        groups[c.category].push(c.name);
    }

    // Sort categories, put "general" first if it exists
    const catOrder = Object.keys(groups).sort((a, b) => {
        if (a === 'general') return -1;
        if (b === 'general') return 1;
        return a.localeCompare(b);
    });

    const username = ctx?.pushname || 'User';

    let text =
        `╭─〔 🔑 ${config.botName} 〕\n` +
        `│\n` +
        `│ 👤 USER   : ${username}\n` +
        `│ 🎯 PREFIX : ${config.prefix}\n` +
        `│\n` +
        `╰──────────────────────\n\n`;

    for (const cat of catOrder) {
        const names = groups[cat].sort();
        text += `╭─〔 📌 ${cat.toUpperCase()} 〕\n`;
        text += `│\n`;
        for (const n of names) {
            text += `│ ◇ ${config.prefix}${n}\n`;
        }
        text += `│\n`;
        text += `╰──────────────────────\n\n`;
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

        if (!cmds.length) {
            return conn.sendMessage(from, { text: 'No commands found.' }, { quoted: msg });
        }

        const text = buildMenuText(cmds, ctx);
        const imgPath = findMenuImage();

        if (imgPath) {
            try {
                const buffer = await fs.readFile(imgPath);
                return conn.sendMessage(from, {
                    image: buffer,
                    caption: text
                }, { quoted: msg });
            } catch (e) {
                console.error('Menu image send failed:', e.message);
            }
        }

        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};