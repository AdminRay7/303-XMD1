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

function scanAll() {
    if (!fs.existsSync(COMMANDS_DIR)) return { commands: [], auto: [] };
    const seen = new Set();
    const commands = [];
    const auto = [];

    const walk = (dir) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) walk(itemPath);
            else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(itemPath)];
                    const mod = require(itemPath);
                    if (!mod || seen.has(mod)) continue;
                    seen.add(mod);

                    const name = (mod.name || path.basename(itemPath, '.js')).toLowerCase();
                    const category = (mod.category || 'general').toLowerCase();

                    // Auto-detection module (has a hook but no execute)
                    const isAuto = typeof mod.execute !== 'function' &&
                        (typeof mod.onMessage === 'function' ||
                         typeof mod.onCall === 'function' ||
                         typeof mod.onGroupJoin === 'function' ||
                         typeof mod.onGroupLeave === 'function');

                    if (typeof mod.execute === 'function') {
                        commands.push({ name, category });
                    } else if (isAuto) {
                        auto.push({ name, category });
                    }
                } catch (e) {
                    console.error(`scan: ${itemPath}:`, e.message);
                }
            }
        }
    };
    walk(COMMANDS_DIR);
    return { commands, auto };
}

function buildMenuText(commands, auto, ctx) {
    const groups = {};
    for (const c of [...commands, ...auto]) {
        const cat = c.category || 'general';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(c.name);
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
        const { commands, auto } = scanAll();
        if (!commands.length && !auto.length) {
            return conn.sendMessage(from, { text: 'No commands found.' }, { quoted: msg });
        }
        const text = buildMenuText(commands, auto, ctx);
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