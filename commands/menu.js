const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const { fancy } = require('../lib/font');

const ASSETS_DIR = path.join(__dirname, '..', 'Assets');
const COMMANDS_DIR = path.join(__dirname, '..', 'commands');

function findMenuImage() {
    if (!fs.existsSync(ASSETS_DIR)) return null;
    const files = fs.readdirSync(ASSETS_DIR);
    const img = files.find(f => /^menu\.(png|jpe?g|webp|gif)$/i.test(f));
    return img ? path.join(ASSETS_DIR, img) : null;
}

function scanCommands() {
    if (!fs.existsSync(COMMANDS_DIR)) return [];
    const seen = new Set();
    const list = [];

    for (const item of fs.readdirSync(COMMANDS_DIR)) {
        if (!item.endsWith('.js')) continue;
        const itemPath = path.join(COMMANDS_DIR, item);
        try {
            delete require.cache[require.resolve(itemPath)];
            const mod = require(itemPath);
            if (!mod || typeof mod.execute !== 'function') continue;
            if (seen.has(mod)) continue;
            seen.add(mod);

            list.push({
                name: (mod.name || path.basename(item, '.js')).toLowerCase(),
                category: (mod.category || 'general').toLowerCase()
            });
        } catch (e) {
            console.error(`menu scan: ${itemPath}:`, e.message);
        }
    }
    return list;
}

function buildMenuText(cmds, ctx) {
    const groups = {};
    for (const c of cmds) {
        if (!groups[c.category]) groups[c.category] = [];
        groups[c.category].push(c.name);
    }

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
        text += `╭─〔 📌 ${cat.toUpperCase()} 〕\n│\n`;
        for (const n of groups[cat].sort()) text += `│ ◇ ${config.prefix}${n}\n`;
        text += `│\n╰──────────────────────\n\n`;
    }

    text += `_${fancy(config.footer)}_`;
    return text;
}

module.exports = {
    name: 'menu',
    category: 'general',
    aliases: ['help', 'commands', 'cmds'],
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const cmds = scanCommands();
        if (!cmds.length) return conn.sendMessage(from, { text: 'No commands found.' }, { quoted: msg });

        const text = buildMenuText(cmds, ctx);
        const imgPath = findMenuImage();
        if (imgPath) {
            try {
                const buffer = await fs.readFile(imgPath);
                return conn.sendMessage(from, { image: buffer, caption: text }, { quoted: msg });
            } catch (e) { console.error('Menu image:', e.message); }
        }
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};