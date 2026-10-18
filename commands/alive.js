// commands/alive.js
// Check if the bot is alive. Shows uptime, RAM, and a dynamic greeting.
// Usage: .alive

const fs = require('fs-extra');
const path = require('path');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'alive',
    category: 'general',
    aliases: ['bot', 'status'],
    description: 'Check if bot is alive and see its status',
    async execute(conn, msg, args, ctx) {
        const { from, pushname } = ctx;

        // 1. Calculate Uptime
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);

        // 2. Calculate Memory
        const mem = process.memoryUsage();
        const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
        const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

        // 3. Dynamic Greeting based on time
        const hour = new Date().getHours();
        let greeting = 'Hello';
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        // 4. Build the message
        const text = 
`╭─〔 🔑 ${fancy(config.botName || '303-XMD')} 〕
│
│ ${greeting}, ${pushname || 'User'}! 👋
│
│ 🤖 *Status* : 🟢 ALIVE & ONLINE
│ ⏱️ *Uptime* : ${h}h ${m}m ${s}s
│ 💾 *RAM*    : ${heapMB} MB (Heap)
│ 🧠 *RSS*    : ${rssMB} MB
│ 📦 *Version*: v${config.version}
│
╰──────────────────────

_${fancy(config.footer || '303-XMD — THE LAST KEY')}_`;

        // 5. Try to attach an image (bot avatar or menu image)
        const imgPath = path.join(__dirname, '..', 'Assets', 'menu.png');
        
        try {
            if (fs.existsSync(imgPath)) {
                const buffer = fs.readFileSync(imgPath);
                await conn.sendMessage(from, { image: buffer, caption: text }, { quoted: msg });
            } else {
                await conn.sendMessage(from, { text }, { quoted: msg });
            }
        } catch (e) {
            console.error('[alive] image error:', e.message);
            await conn.sendMessage(from, { text }, { quoted: msg });
        }
    }
};