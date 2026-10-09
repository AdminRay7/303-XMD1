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
    category: 'general',
    aliases: ['p', 'speed'],
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;

        const start = Date.now();
        const sent = await conn.sendMessage(from, { text: fancy('🏓 ᴘɪɴɢɪɴɢ...') });
        const latency = Date.now() - start;

        const memUsed = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
        const uptime = fmtUptime(process.uptime());

        const text =
            `╭─── • 🏓 • ───╮\n` +
            `   ᴘ ᴏ ɴ ɢ\n` +
            `╰─── • 🏓 • ───╯\n\n` +
            `⚡ *Latency*   : ${latency} ms\n` +
            `⏱️ *Uptime*    : ${uptime}\n` +
            `💾 *Memory*    : ${memUsed} MB\n` +
            `🖥️ *Platform*  : ${os.platform()} ${os.arch()}\n` +
            `🔢 *Node*      : ${process.version}\n` +
            `📦 *Version*   : ${config.version}\n\n` +
            `_${fancy(config.footer)}_`;

        // Edit placeholder into info card
        try {
            await conn.sendMessage(from, { text, edit: sent.key });
        } catch {}

        // ---- Fake "Forwarded from Channel" wrapper ----
        const channelJid  = config.newsletterJid || '120363430114825309@newsletter';
        const channelName = config.botName || '303-XMD';

        const contextInfo = {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: channelJid,
                newsletterName: channelName,
                serverMessageId: -1
            }
        };

        try {
            await conn.sendMessage(from, {
                text,
                contextInfo
            }, { quoted: msg });
        } catch (e) {
            console.error('Ping newsletter-tag failed:', e.message);
            await conn.sendMessage(from, {
                text: text + `\n\n📢 *View Channel:*\n${config.channelLink}`
            }, { quoted: msg });
        }
    }
};