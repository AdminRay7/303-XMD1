const { fancy } = require('../lib/font');
const config = require('../config');
function fmt(s) {
    const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
    const p = [];
    if (d) p.push(d+'d'); if (h) p.push(h+'h'); if (m) p.push(m+'m'); p.push(sec+'s');
    return p.join(' ');
}
module.exports = {
    name: 'runtime',
    category: 'tools',
    aliases: ['up', 'uptime'],
    description: 'Show bot uptime and stats',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const mem = process.memoryUsage();
        const text =
            `╭─〔 ⏱ ᴜᴘᴛɪᴍᴇ 〕\n│\n` +
            `│ ⏱ Uptime: ${fmt(process.uptime())}\n` +
            `│ 💾 RSS:    ${(mem.rss/1024/1024).toFixed(1)} MB\n` +
            `│ 📦 Heap:   ${(mem.heapUsed/1024/1024).toFixed(1)} MB\n` +
            `│ 🖥️ Node:   ${process.version}\n` +
            `│ 🐧 OS:     ${process.platform} ${process.arch}\n` +
            `│ 📌 Version: ${config.version}\n│\n` +
            `╰──────────────────────`;
        await conn.sendMessage(from, { text }, { quoted: msg });
    }
};
