// commands/menu2.js
// Generates a menu with the exact frame layout from the screenshot.
// Usage: .menu2

const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

module.exports = {
    name: 'menu2',
    category: 'general',
    aliases: ['m2'],
    description: 'Alternative styled menu',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        
        // ---- 1. Calculate Runtime ----
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);
        const runtimeStr = `${h}h ${m}m ${s}s`;

        // ---- 2. Count Commands ----
        let cmdCount = 0;
        const cmdDir = path.join(__dirname);
        const walk = (dir) => {
            for (const item of fs.readdirSync(dir)) {
                const full = path.join(dir, item);
                if (fs.statSync(full).isDirectory()) { walk(full); continue; }
                if (item.endsWith('.js')) cmdCount++;
            }
        };
        try { walk(cmdDir); } catch {}

        // ---- 3. Get Bot Info ----
        const ownerName = config.ownerName || "mr presenter";
        const prefix = config.prefix || ".";
        const mode = config.workMode || "public";
        const version = config.version || "2.0.0";

        // ---- 4. Build the Header Frame ----
        // Matches the exact header from the screenshot
        let text = `◆ ──── ✦ 303-XMD MULTI-DEVICE ✦ ──── ◆\n\n`;
        
        text += `┏━━━━━━━━━━━━━━━「 👑 USER INFO 」━━━━━━━━━━━━━━━◇\n`;
        text += `┃ 🚀 OWNER: ${ownerName.toUpperCase()}\n`;
        text += `┃ 📂 COMMANDS: ${cmdCount}\n`;
        text += `┃ ⏱️ RUNTIME: ${runtimeStr}\n`;
        text += `┃ ⚡ PREFIX: [ ${prefix} ]\n`;
        text += `┃ 🔒 MODE: ${mode}\n`;
        text += `┃ 🏷️ VERSION: ${version} BETA\n`;
        text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◇\n\n`;

        // ---- 5. Build Categories ----
        const grouped = {};
        
        const load = (dir) => {
            for (const item of fs.readdirSync(dir)) {
                const full = path.join(dir, item);
                if (fs.statSync(full).isDirectory()) { load(full); continue; }
                if (!item.endsWith('.js') || item === 'menu.js' || item === 'menu2.js') continue;
                try {
                    delete require.cache[require.resolve(full)];
                    const mod = require(full);
                    if (!mod || typeof mod.execute !== 'function') continue;
                    const cat = (mod.category || 'general').toLowerCase();
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(mod.name);
                } catch {}
            }
        };
        load(cmdDir);

        const displayOrder = ['general', 'admin', 'group', 'fun', 'tools', 'media', 'download', 'auto'];

        for (const cat of displayOrder) {
            const items = grouped[cat];
            if (!items || !items.length) continue;

            items.sort();
            const catTitle = cat.toUpperCase();

            text += `┏━━━━━━━━━━━━━━━「 ⚡ ${catTitle} 」━━━━━━━━━━━━━━━◇\n`;
            for (const cmd of items) {
                // Uses the exact diamond bullet and UPPERCASE from screenshot
                text += `┃ ◇ ${cmd.toUpperCase()}\n`;
            }
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◇\n\n`;
        }

        // Any other categories
        for (const cat of Object.keys(grouped)) {
            if (displayOrder.includes(cat)) continue;
            const items = grouped[cat];
            if (!items || !items.length) continue;
            
            items.sort();
            text += `┏━━━━━━━━━━━━━━━「 ⚡ ${cat.toUpperCase()} 」━━━━━━━━━━━━━━━◇\n`;
            for (const cmd of items) {
                text += `┃ ◇ ${cmd.toUpperCase()}\n`;
            }
            text += `┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━◇\n\n`;
        }

        // ---- 6. Send ----
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};