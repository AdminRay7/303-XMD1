// commands/statusreply.js
// Auto-reply to incoming WhatsApp statuses using AI.
// Toggle: .statusreply on | off | (no args = show state)
// Scope: session-wide.
//
// Flow:
//   1. Status arrives (status@broadcast)
//   2. Extract caption text (or note it's media-only)
//   3. Send to AI with a short prompt: "React to this status casually"
//   4. Reply back to the status

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');
const aiChat = require('../lib/aiChat');

function extractStatusText(msg) {
    const m = msg.message || {};
    const inner =
        m.imageMessage ||
        m.videoMessage ||
        m.extendedTextMessage ||
        m.conversation ||
        null;

    if (typeof inner === 'string') return inner;
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
            return conn.sendMessage(from, {
                text: fancy(`💬 Status Reply (AI): ${on ? '✅ ON' : '❌ OFF'}`)
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statusreply on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'statusreply', null, value);
        return conn.sendMessage(from, { text: fancy(`✅ Status Reply ${value ? 'ENABLED' : 'DISABLED'}.`) }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const from = msg.key.remoteJid;
        if (from !== 'status@broadcast') return false;
        if (msg.key.fromMe) return false;

        const text = extractStatusText(msg);
        const sender = msg.key.participant || msg.key.remoteJid;

        // Build a prompt for the AI
        const userMsg = text
            ? `Someone posted this status: "${text.slice(0, 300)}". Reply to it like a friend would — short, casual, 1 sentence.`
            : `Someone posted a photo/video status with no caption. React to it casually — short, 1 sentence.`;

        const sysPrompt =
            "You are a casual WhatsApp user replying to someone's status. " +
            "Keep it very short (under 15 words). Warm, human, use an emoji sometimes. " +
            "Never mention you are a bot or AI. Never say 'nice status'. Just react naturally.";

        let reply;
        try {
            reply = await aiChat.askAI(userMsg, `status_${sender}`, sysPrompt);
        } catch (e) {
            console.error('[statusreply] AI error:', e.message);
            return false;
        }

        if (!reply) return false;

        // Reply TO the status (WhatsApp treats this as a status reply)
        try {
            await conn.sendMessage('status@broadcast', {
                text: reply
            }, { statusJidList: [sender] });
        } catch (e) {
            console.error('[statusreply] reply failed:', e.message);
        }

        return false;
    }
};