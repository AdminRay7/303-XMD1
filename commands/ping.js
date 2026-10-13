// commands/ping.js
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'ping',
    category: 'general',
    aliases: ['p'],
    description: 'Check bot speed and status',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const t0 = Date.now();

        const sent = await conn.sendMessage(from, { text: fancy('🏓 Pinging...') }, { quoted: msg });

        const latency = Date.now() - t0;
        const uptime = process.uptime();
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = Math.floor(uptime % 60);

        const mem = process.memoryUsage();

        const text =
`╭─〔 🏓 ᴘᴏɴɢ 〕
│
│ ⚡ sᴘᴇᴇᴅ  : ${latency} ms
│ ⏱️ ᴜᴘᴛɪᴍᴇ : ${h}h ${m}m ${s}s
│ 💾 ʜᴇᴀᴘ   : ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB
│ 🔧 ɴᴏᴅᴇ   : ${process.version}
│ 📦 ᴠᴇʀsɪᴏɴ: v${config.version}
│
╰──────────────────────

_${fancy(config.footer || '303-XMD — THE LAST KEY')}_`;

        try {
            await conn.sendMessage(from, { text, edit: sent.key });
        } catch (e) {
            // If edit fails, send as new message
            await conn.sendMessage(from, { text }, { quoted: msg });
        }
    }
};