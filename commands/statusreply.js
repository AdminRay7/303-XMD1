// commands/statusreply.js
const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');
const aiChat = require('../lib/aiChat');

function extractStatusText(msg) {
    const m = msg.message || {};
    const inner = m.imageMessage || m.videoMessage || m.extendedTextMessage || null;
    if (typeof m.conversation === 'string') return m.conversation;
    if (inner?.caption) return inner.caption;
    if (inner?.text) return inner.text;
    return '';
}

module.exports = {
    name: 'statusreply',
    category: 'auto',
    aliases: ['sreply'],
    description: 'Auto-reply to WhatsApp statuses with AI',
    toggleKey: 'statusreply',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        if (action === '') {
            const on = await autoToggles.get(userId, 'statusreply', null, config.autoStatusReply === true);
            return conn.sendMessage(from, { text: fancy(`💬 Status Reply (AI): ${on ? '✅ ON' : '❌ OFF'}`) }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statusreply on|off`) });
        await autoToggles.set(userId, 'statusreply', null, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Status Reply ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) }, { quoted: msg });
    },

    async onMessage(conn, msg, ctx) {
        const from = msg.key.remoteJid;
        if (from !== 'status@broadcast') return false;
        if (msg.key.fromMe) return false;

        const posterJid = msg.key.participant || msg.participant;
        if (!posterJid) return false;

        const text = extractStatusText(msg);

        const userMsg = text
            ? `Someone posted this status: "${text.slice(0, 300)}". Reply to it like a friend — short, casual, 1 sentence.`
            : `Someone posted a photo/video status with no caption. React casually — short, 1 sentence.`;

        const sysPrompt =
            "You are a casual WhatsApp user replying to someone's status. " +
            "Keep it very short (under 15 words). Warm, human, use an emoji sometimes. " +
            "Never mention you are a bot or AI. Never say 'nice status'. Just react naturally.";

        let reply;
        try {
            reply = await aiChat.askAI(userMsg, `status_${posterJid}`, sysPrompt);
        } catch (e) {
            console.error('[statusreply] AI error:', e.message);
            return false;
        }
        if (!reply) return false;

        try {
            await conn.sendMessage(posterJid, { text: reply }, {
                quoted: {
                    key: {
                        remoteJid: 'status@broadcast',
                        fromMe: false,
                        id: msg.key.id,
                        participant: posterJid
                    },
                    message: msg.message
                }
            });
            console.log(`[statusreply] replied to ${posterJid}: ${reply}`);
        } catch (e) {
            console.error('[statusreply] reply failed:', e.message);
        }
        return false;
    }
};