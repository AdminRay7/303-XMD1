// lib/humanChat.js
// Makes the AI behave like a real group participant.
// No rate limits, no random skips — replies to every message.
// Keeps rolling context so the AI can follow the story.

// Per-group rolling buffer of recent messages
const groupContext = new Map(); // groupJid -> [{sender, text, ts}, ...]
const MAX_CONTEXT = 25;

// Track recently replied message IDs to prevent double replies
const repliedIds = new Map(); // msgId -> ts
const ID_TTL = 60000;

function pushContext(groupJid, senderName, text) {
    let list = groupContext.get(groupJid);
    if (!list) { list = []; groupContext.set(groupJid, list); }
    list.push({ sender: senderName, text: String(text).slice(0, 200), ts: Date.now() });
    if (list.length > MAX_CONTEXT) list.splice(0, list.length - MAX_CONTEXT);
}

function getContext(groupJid, minutes = 10) {
    const list = groupContext.get(groupJid) || [];
    const now = Date.now();
    return list
        .filter(m => now - m.ts < minutes * 60 * 1000)
        .map(m => `${m.sender}: ${m.text}`)
        .join("\n");
}

function clearContext(groupJid) {
    groupContext.delete(groupJid);
}

// Prevent double-processing the same message
function hasReplied(msgId) {
    const now = Date.now();
    for (const [id, ts] of repliedIds) {
        if (now - ts > ID_TTL) repliedIds.delete(id);
    }
    if (repliedIds.has(msgId)) return true;
    repliedIds.set(msgId, now);
    return false;
}

// Convert AI reply to human-style text
function humanize(text) {
    if (!text) return text;
    let out = String(text).trim();

    // Strip markdown
    out = out.replace(/^#+\s*/gm, "");
    out = out.replace(/^\*\s+/gm, "");
    out = out.replace(/^\-\s+/gm, "");
    out = out.replace(/\*\*(.+?)\*\*/g, "$1");
    out = out.replace(/\*(.+?)\*/g, "$1");
    out = out.replace(/`(.+?)`/g, "$1");
    out = out.replace(/^>\s*/gm, "");

    // Collapse newlines
    out = out.replace(/\n{2,}/g, "\n");

    // Trim overly long replies (only for groups)
    if (out.length > 300) {
        const sentences = out.split(/(?<=[.!?])\s+/);
        out = sentences.slice(0, 3).join(" ");
        if (out.length > 350) out = out.slice(0, 350).trim() + "…";
    }

    // Remove trailing AI flourishes
    out = out.replace(
        /\s*(I hope (this|that) helps?\.?|Let me know if.*|Feel free to.*|If you have any.*|Is there anything else.*)$/i,
        ""
    ).trim();

    return out;
}

module.exports = {
    pushContext,
    getContext,
    clearContext,
    hasReplied,
    humanize
};