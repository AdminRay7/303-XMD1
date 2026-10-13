// commands/statusreply.js
// Auto-reply to WhatsApp statuses with AI.
// - Text statuses → text AI
// - Image statuses → vision AI (describePhoto)
// - Video statuses → replies based on caption only (no frame extraction)

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');
const aiChat = require('../lib/aiChat');
const aiVision = require('../lib/aiVision');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

function unwrap(msg) {
    let inner = msg.message || {};
    let guard = 0;
    while (guard++ < 5) {
        if (inner.ephemeralMessage?.message) { inner = inner.ephemeralMessage.message; continue; }
        if (inner.viewOnceMessage?.message)  { inner = inner.viewOnceMessage.message; continue; }
        if (inner.viewOnceMessageV2?.message) { inner = inner.viewOnceMessageV2.message; continue; }
        if (inner.editedMessage?.message)    { inner = inner.editedMessage.message; continue; }
        break;
    }
    return inner;
}

async function downloadStatusImage(msg) {
    const inner = unwrap(msg);
    if (!inner.imageMessage) return null;
    try {
        const stream = await downloadContentFromMessage(inner.imageMessage, 'image');
        const chunks = [];
        let total = 0;
        const MAX = 5 * 1024 * 1024;
        for await (const c of stream) {
            total += c.length;
            if (total > MAX) throw new Error('image > 5MB');
            chunks.push(c);
        }
        return Buffer.concat(chunks);
    } catch (e) {
        console.error('[statusreply] image download failed:', e.message);
        return null;
    }
}

module.exports = {
    name: 'statusreply',
    category: 'auto',
    aliases: ['sreply'],
    description: 'Auto-reply to WhatsApp statuses with AI (vision-aware)',
    toggleKey: 'statusreply',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'statusreply', null, config.autoStatusReply === true);
            return conn.sendMessage(from, { text: fancy(`💬 Status Reply (AI, vision): ${on ? '✅ ON' : '❌ OFF'}`) }, { quoted: msg });
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

        const inner = unwrap(msg);
        const caption =
            inner.imageMessage?.caption ||
            inner.videoMessage?.caption ||
            inner.extendedTextMessage?.text ||
            (typeof inner.conversation === 'string' ? inner.conversation : '') || '';

        // ============================================================
        //   SYSTEM PROMPT — longer, descriptive replies
        // ============================================================
        const sysPrompt =
            "You are a warm, chatty WhatsApp user replying to someone's status. " +
            "Write 1 to 3 natural sentences (up to ~40 words). " +
            "Describe what you actually see in the image or read in the text, then react to it. " +
            "Sound like a real friend — curious, complimentary, casual, with a light emoji. " +
            "Ask a small follow-up question sometimes (e.g. 'Where is this?' or 'Looks fun, what's the occasion?'). " +
            "Never mention you are a bot or AI. Never use bullet points, headers, or lists. " +
            "Never say 'nice status' or 'cool photo'. Just react naturally like a person would.";

        let reply = null;

        // ---------- IMAGE STATUS → vision ----------
        if (inner.imageMessage) {
            const buffer = await downloadStatusImage(msg);
            if (buffer) {
                try {
                    reply = await aiVision.describePhoto(buffer, 'image/jpeg', caption, sysPrompt);
                    console.log('[statusreply] vision reply:', reply);
                } catch (e) {
                    console.error('[statusreply] vision error:', e.message);
                }
            }
        }

        // ---------- TEXT STATUS → text AI ----------
        if (!reply && caption) {
            try {
                reply = await aiChat.askAI(
                    `Someone posted this status: "${caption.slice(0, 500)}". ` +
                    `Reply with 1-3 casual sentences about it — mention the content and add a small friendly comment or question.`,
                    `status_${posterJid}`,
                    sysPrompt
                );
                console.log('[statusreply] text reply:', reply);
            } catch (e) {
                console.error('[statusreply] text AI error:', e.message);
            }
        }

        // ---------- FALLBACK for media-only with no vision ----------
        if (!reply && (inner.imageMessage || inner.videoMessage)) {
            try {
                reply = await aiChat.askAI(
                    `Someone posted a ${inner.imageMessage ? 'photo' : 'video'} status with no caption. ` +
                    `Reply with 1-3 casual sentences — react warmly and ask a small follow-up question.`,
                    `status_${posterJid}`,
                    sysPrompt
                );
            } catch (e) {
                console.error('[statusreply] fallback AI error:', e.message);
            }
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
            console.log(`[statusreply] sent to ${posterJid}: ${reply}`);
        } catch (e) {
            console.error('[statusreply] reply send failed:', e.message);
        }
        return false;
    }
};