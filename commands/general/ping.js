const os = require('os');
const config = require('../config');
const { fancy } = require('../lib/font');

function fmtUptime(sec) {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const parts = [];
    if (d) parts.push(`${d}d`);
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
}

module.exports = {
    name: 'ping',
    aliases: ['p', 'speed'],
    async execute(conn, msg, args, ctx) {
        const { from, fancy } = ctx;

        const start = Date.now();

        // Send "measuring" placeholder
        const sent = await conn.sendMessage(from, { text: fancy('🏓 ᴘɪɴɢɪɴɢ...') });

        // Latency = time between send + server ack
        const latency = Date.now() - start;

        const uptime = process.uptime();
        const mem = process.memoryUsage();
        const memUsed = (mem.rss / 1024 / 1024).toFixed(1);

        const text =
            `╭─── • 🏓 • ───╮\n` +
            `   ᴘ ᴏ ɴ ɢ\n` +
            `╰─── • 🏓 • ───╯\n\n` +
            `⚡ *Latency:*   ${latency} ms\n` +
            `⏱️ *Uptime:*    ${fmtUptime(uptime)}\n` +
            `💾 *Memory:*    ${memUsed} MB\n` +
            `🖥️ *Platform:*  ${os.platform()} ${os.arch()}\n` +
            `🔢 *Node:*      ${process.version}\n` +
            `📦 *Version:*   ${config.version}\n` +
            `\n_${fancy(config.footer)}_`;

        // Edit the placeholder (Baileys supports edit)
        try {
            await conn.sendMessage(from, { text, edit: sent.key });
        } catch {
            // Fallback: just send a new message
            await conn.sendMessage(from, { text });
        }
    }
};