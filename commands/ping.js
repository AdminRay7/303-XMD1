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

        // Try to edit the placeholder into the info card
        try {
            await conn.sendMessage(from, { text, edit: sent.key });
        } catch {}

        // ---- WhatsApp Channel (Newsletter) button ----
        const newsletterJid = config.newsletterJid || '120363430114825309@newsletter';

        const payload = {
            text,
            footer: fancy('ᴛᴀᴘ ᴛᴏ ᴠɪᴇᴡ ᴏᴜʀ ᴄʜᴀɴɴᴇʟ'),
            interactiveButtons: [
                {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: '📢 View Channel',
                        url: `https://whatsapp.com/channel/${newsletterJid.split('@')[0]}`,
                        merchant_url: `https://whatsapp.com/channel/${newsletterJid.split('@')[0]}`
                    })
                }
            ]
        };

        try {
            await conn.sendMessage(from, payload, { quoted: msg });
        } catch (e) {
            console.error('Ping channel button failed:', e.message);
            // Fallback: plain text with channel link
            await conn.sendMessage(from, {
                text: text + `\n\n📢 *View Channel:*\n${config.channelLink}`
            }, { quoted: msg });
        }
    }
};