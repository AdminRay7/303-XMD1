// commands/runtime.js
// Shows how long the bot has been running + basic stats.
// Usage: .runtime

const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'runtime',
    category: 'general',
    aliases: ['uptime', 'stats'],
    description: 'Bot uptime and system stats',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);
        
        const mem = process.memoryUsage();
        const heapMB = (mem.heapUsed / 1024 / 1024).toFixed(1);
        const rssMB = (mem.rss / 1024 / 1024).toFixed(1);

        const text = `🤖 *BOT RUNTIME*\n\n` +
                     `⏱️ Uptime: ${h}h ${m}m ${s}s\n` +
                     `📦 Node: ${process.version}\n` +
                     `💾 Heap: ${heapMB} MB\n` +
                     `🧠 RSS: ${rssMB} MB\n` +
                     `🔧 Platform: ${process.platform}\n` +
                     `🏷️ Version: ${config.version}`;

        await conn.sendMessage(from, { text: fancy(text) }, { quoted: msg });
    }
};