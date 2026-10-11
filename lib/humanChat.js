// lib/humanChat.js
// Makes the AI behave like a real group participant.
// Random typing delays, random skips, human-length replies, context memory.

// Per-group rolling buffer of recent messages (for context)
const groupContext = new Map(); // groupJid -> [{sender, text, ts}, ...]
const MAX_CONTEXT = 15;

// Per-group reply timestamps (for rate limit)
const replyLog = new Map();

function pushContext(groupJid, senderName, text) {
    let list = groupContext.get(groupJid);
    if (!list) { list = []; groupContext.set(groupJid, list); }
    list.push({ sender: senderName, text: String(text).slice(0, 200), ts: Date.now() });
    if (list.length > MAX_CONTEXT) list.splice(0, list.length - MAX_CONTEXT);
}

function getContext(groupJid) {
    const list = groupContext.get(groupJid) || [];
    return list
        .filter(m => Date.now() - m.ts < 5 * 60 * 1000)   // last 5 min only
        .map(m => `${m.sender}: ${m.text}`)
        .join("\n");
}

function clearContext(groupJid) {
    groupContext.delete(groupJid);
}

// Rate limit: max N replies per minute per group
function canReply(groupJid, maxPerMin = 3) {
    const now = Date.now();
    const list = (replyLog.get(groupJid) || []).filter(t => now - t < 60000);
    if (list.length >= maxPerMin) return false;
    list.push(now);
    replyLog.set(groupJid, list);
    return true;
}

// Random human-like delay (2–7 seconds)
function humanDelay() {
    return 2000 + Math.floor(Math.random() * 5000);
}

// Should the bot skip this message? (simulate human inattention)
function shouldSkip(text, skipChance = 0.15) {
    // Shorter messages more likely to be skipped
    if (!text || text.length < 4) return Math.random() < 0.5;
    return Math.random() < skipChance;
}

// Convert AI reply to human-like text
function humanize(text) {
    if (!text) return text;
    let out = String(text).trim();

    // Strip markdown headers/bullets that AI loves
    out = out.replace(/^#+\s*/gm, "");
    out = out.replace(/^\*\s+/gm, "");
    out = out.replace(/^\-\s+/gm, "");
    out = out.replace(/\*\*(.+?)\*\*/g, "$1");   // bold
    out = out.replace(/\*(.+?)\*/g, "$1");       // italic
    out = out.replace(/`(.+?)`/g, "$1");         // code

    // Collapse multiple newlines
    out = out.replace(/\n{2,}/g, "\n");

    // If too long, trim to first couple sentences
    if (out.length > 220) {
        const sentences = out.split(/(?<=[.!?])\s+/);
        out = sentences.slice(0, 2).join(" ");
        if (out.length > 280) out = out.slice(0, 280).trim() + "...";
    }

    // Remove trailing AI flourishes
    out = out.replace(/\s*(I hope (this|that) helps?\.?|Let me know if.*|Feel free to.*|If you have any.*)$/i, "").trim();

    return out;
}

module.exports = {
    pushContext,
    getContext,
    clearContext,
    canReply,
    humanDelay,
    shouldSkip,
    humanize
};