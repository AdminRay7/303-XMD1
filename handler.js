// ============================================================
//   303-XMD — handler.js
//   Auto-detects + analytics + AI auto-reply (DM + group, no limits)
// ============================================================
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber, ChannelPost } = require('./database/models');
const messageStore = require('./lib/messageStore');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const analytics = require('./lib/analytics');
const aiChat = require('./lib/aiChat');
const humanChat = require('./lib/humanChat');

// ================= HOT-RELOAD COMMAND LOADER =================
const COMMANDS_DIR = path.join(__dirname, 'commands');
const commandCache = new Map();
const autoCache = new Map();
let folderSignature = '';
let lastScan = 0;
const RESCAN_DEBOUNCE_MS = 2000;

function computeFolderSignature(dir) {
    if (!fs.existsSync(dir)) return '';
    const parts = [];
    const walk = (d) => {
        for (const item of fs.readdirSync(d)) {
            const full = path.join(d, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) walk(full);
            else if (item.endsWith('.js')) parts.push(`${item}:${stat.mtimeMs}`);
        }
    };
    walk(dir);
    return parts.sort().join('|');
}

function loadCommands(force = false) {
    const now = Date.now();
    if (!force && now - lastScan < RESCAN_DEBOUNCE_MS) return false;
    lastScan = now;

    if (!fs.existsSync(COMMANDS_DIR)) return false;

    const sig = computeFolderSignature(COMMANDS_DIR);
    if (!force && sig === folderSignature) return false;
    folderSignature = sig;

    commandCache.clear();
    autoCache.clear();

    const walk = (dir) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) walk(itemPath);
            else if (item.endsWith('.js')) {
                try {
                    delete require.cache[require.resolve(itemPath)];
                    const mod = require(itemPath);
                    if (!mod) continue;

                    const hasExecute = typeof mod.execute === 'function';
                    const hasHook = typeof mod.onMessage === 'function' ||
                                    typeof mod.onCall === 'function' ||
                                    typeof mod.onGroupJoin === 'function' ||
                                    typeof mod.onGroupLeave === 'function';

                    if (hasExecute) {
                        const names = [mod.name, ...(Array.isArray(mod.aliases) ? mod.aliases : [])]
                            .filter(Boolean).map(s => String(s).toLowerCase());
                        for (const n of names) commandCache.set(n, mod);
                    }
                    if (hasHook) {
                        autoCache.set(mod.name || itemPath, mod);
                    }
                } catch (e) {
                    console.error(`⚠️ Load ${itemPath}:`, e.message);
                }
            }
        }
    };
    walk(COMMANDS_DIR);
    console.log(fancy(`♻️  Loaded ${commandCache.size} command(s) · ${autoCache.size} auto module(s).`));
    return true;
}
loadCommands(true);
setInterval(() => { try { loadCommands(false); } catch {} }, 3000).unref();

// ================= DEBOUNCED USER SAVES =================
const pendingUserSaves = new Map();
function scheduleUserSave(user) { pendingUserSaves.set(user.jid, user); }
setInterval(async () => {
    for (const [, user] of pendingUserSaves) { try { await user.save(); } catch {} }
    pendingUserSaves.clear();
}, 30000).unref();

// ================= SUBSCRIBER CACHE =================
const subscriberCache = new Set();
let subscriberCacheLastRefresh = 0;
async function isSubscribed(jid) {
    if (Date.now() - subscriberCacheLastRefresh > 10 * 60 * 1000) {
        subscriberCache.clear();
        subscriberCacheLastRefresh = Date.now();
    }
    if (subscriberCache.has(jid)) return true;
    const sub = await ChannelSubscriber.findOne({ jid, isActive: true });
    if (sub) subscriberCache.add(jid);
    return !!sub;
}

// ================= BUTTON ROUTER =================
async function routeButtonInteraction(conn, msg, ctx) {
    const buttonId =
        msg.message?.buttonsResponseMessage?.selectedButtonId ||
        msg.message?.templateButtonReplyMessage?.selectedId ||
        msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (!buttonId) return false;
    const seen = new Set();
    for (const [, mod] of commandCache) {
        if (seen.has(mod)) continue;
        seen.add(mod);
        if (typeof mod.handleButton === 'function') {
            try {
                const handled = await mod.handleButton(conn, msg, buttonId, ctx);
                if (handled === true || handled === undefined) return true;
            } catch (e) { console.error("handleButton:", e.message); }
        }
    }
    return false;
}

// ================= MAIN HANDLER =================
module.exports = async (conn, m, userId = "default") => {
    try {
        if (!m.messages || !m.messages[0]) return;
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const sender = msg.key.participant || msg.key.remoteJid;
        const pushname = msg.pushName || "Unknown";

        const body = (type === 'conversation') ? msg.message.conversation :
                    (type === 'extendedTextMessage') ? msg.message.extendedTextMessage.text :
                    (type === 'imageMessage') ? msg.message.imageMessage.caption :
                    (type === 'videoMessage') ? msg.message.videoMessage.caption : '';

        const isGroup   = from.endsWith('@g.us');
        const isChannel = from.endsWith('@newsletter');
        const isStatus  = from === 'status@broadcast';
        const isOwner   = String(config.ownerNumber).includes(sender.split('@')[0]) || msg.key.fromMe;
        const prefix    = config.prefix;
        const isCmd     = body && body.startsWith(prefix);
        const command   = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args      = body ? body.trim().split(/ +/).slice(1) : [];

        try { loadCommands(false); } catch {}

        // ================= CONTEXT =================
        const cmdCtx = {
            from, sender, fancy, isOwner, pushname, config, conn, msg,
            userId, isGroup, isChannel, isStatus, body, args, command, prefix, isCmd
        };

        // ============================================================
        //   LIVE FEED: INCOMING
        // ============================================================
        try {
            if (!msg.key.fromMe && !isChannel && !isStatus) {
                const liveFeed = require('./lib/liveFeed');
                const senderPhone = sender.split('@')[0].replace(/\D/g, "");
                const isGroupChat = isGroup;

                let chatName = pushname || sender.split('@')[0];
                if (isGroupChat) {
                    try {
                        const meta = await conn.groupMetadata(from);
                        chatName = meta.subject || chatName;
                    } catch {}
                }

                const botPhone = (conn.user?.id || "").split(":")[0]?.split("@")[0]?.replace(/\D/g, "") || null;

                await liveFeed.push({
                    sessionId: userId,
                    type: "message",
                    chatJid: from,
                    chatName,
                    isGroup: isGroupChat,
                    senderJid: sender,
                    senderName: pushname,
                    senderPhone,
                    recipientJid: conn.user?.id || null,
                    recipientName: config.botName || "Bot",
                    recipientPhone: botPhone,
                    fromMe: false,
                    text: body || `[${type}]`,
                    mediaType: ["imageMessage","videoMessage","audioMessage","stickerMessage","documentMessage"].includes(type)
                        ? type.replace("Message","").toLowerCase() : null,
                    extra: { direction: "incoming", messageId: msg.key.id }
                });
            }
        } catch (e) { console.error("liveFeed incoming:", e.message); }
        // ============================================================

        // ================= RUN AUTO HOOKS =================
        for (const [, mod] of autoCache) {
            if (typeof mod.enabled === 'function' && !mod.enabled(config)) continue;
            if (typeof mod.onMessage !== 'function') continue;
            try {
                const r = await mod.onMessage(conn, msg, cmdCtx);
                if (r === true) return;
            } catch (e) {
                console.error(`auto/${mod.name}:`, e.message);
            }
        }

        // ================= CHANNEL / NEWSLETTER =================
        if (isChannel) {
            const isTarget = config.newsletterJid && from === config.newsletterJid;
            if (isTarget) {
                const postText =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.videoMessage?.caption || '';

                if (config.logChannelPosts) {
                    try {
                        await ChannelPost.create({
                            msgId: msg.key.id, serverId: msg.key.server_id, jid: from,
                            text: postText, type,
                            timestamp: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000),
                            raw: msg
                        });
                    } catch (e) { console.error("ChannelPost log:", e.message); }
                }

                if (config.autoReactChannel) {
                    try {
                        let emoji = null;
                        const lower = (postText || '').toLowerCase();
                        for (const [word, react] of Object.entries(config.channelKeywordReactions || {})) {
                            if (lower.includes(word)) { emoji = react; break; }
                        }
                        if (!emoji && config.channelEmojis?.length) {
                            emoji = config.channelEmojis[Math.floor(Math.random() * config.channelEmojis.length)];
                        }
                        await conn.sendMessage(from, { react: { text: emoji || '🔥', key: msg.key } });
                    } catch (e) { console.error("Channel react:", e.message); }
                }

                const targets = [...(config.forwardChannelTo || [])];
                if (config.ownerNumber) targets.push(config.ownerNumber + '@s.whatsapp.net');
                for (const t of targets) {
                    try {
                        const jid = t.includes('@') ? t : t.replace(/\D/g, '') + '@s.whatsapp.net';
                        await conn.sendMessage(jid, { forward: msg, force: true });
                    } catch (e) { console.error(`Forward → ${t}:`, e.message); }
                }

                if (config.crossPostWebhook) {
                    try {
                        await axios.post(config.crossPostWebhook, {
                            text: postText || '[media post]',
                            channel: from,
                            timestamp: msg.messageTimestamp
                        }, { timeout: 8000 });
                    } catch (e) { console.error("Cross-post:", e.message); }
                }
            }
            return;
        }

        // ================= BUTTON ROUTER =================
        if (await routeButtonInteraction(conn, msg, cmdCtx)) return;

        // ================= STATUS =================
        if (isStatus) return;

        // ================= WORK MODE =================
        if (config.workMode === 'private' && !isOwner) return;

        // ================= CHANNEL SUBSCRIBE PROMPT =================
        if (!isOwner && !isGroup && config.channelLink) {
            const subbed = await isSubscribed(sender);
            if (!subbed) {
                await ChannelSubscriber.create({
                    jid: sender, name: pushname,
                    subscribedAt: new Date(), isActive: true, autoFollow: true
                });
                subscriberCache.add(sender);
                await conn.sendMessage(from, { text: fancy(`✅ Auto-subscribed!\n\n🔗 ${config.channelLink}`) });
            }
        }

        // ================= AUTO SAVE USER (fallback) =================
        if (config.autoSave && !isOwner && !isGroup) {
            try {
                let user = await User.findOne({ jid: sender });
                if (!user) user = new User({ jid: sender, name: pushname, sessionId: userId, lastActive: new Date(), messageCount: 1 });
                else { user.messageCount += 1; user.lastActive = new Date(); }
                scheduleUserSave(user);
            } catch {}
        }

        // ================= COMMANDS (with analytics) =================
        if (isCmd) {
            const handler = commandCache.get(command);
            if (handler && typeof handler.execute === 'function') {
                const t0 = Date.now();
                let success = true;
                let errorMsg = null;

                try {
                    await Promise.race([
                        handler.execute(conn, msg, args, cmdCtx),
                        new Promise((_, rej) => setTimeout(() => rej(new Error('Command timeout')), 60000))
                    ]);
                } catch (e) {
                    success = false;
                    errorMsg = e.message;
                    console.error(`Cmd "${command}":`, e.message);
                    await conn.sendMessage(from, { text: fancy(`❌ Error: ${e.message}`) });
                }

                try {
                    await analytics.recordCommand({
                        sessionId: userId,
                        accountId: null,
                        command,
                        sender,
                        isGroup,
                        success,
                        errorMsg,
                        durationMs: Date.now() - t0
                    });
                } catch {}
            }
        }

        // ============================================================
        //   AI AUTO-REPLY — DM + GROUP (chat like a human, no limits)
        // ============================================================
        else if (!isCmd && !isOwner && body && config.aiChatEnabled) {
            // Skip if message is empty or a command prefix
            if (!body.trim()) return;

            // Prevent double-processing
            if (humanChat.hasReplied(msg.key.id)) return;

            let prompt = body;
            let sendOpts = { quoted: msg };

            if (isGroup) {
                // Remember what was said
                humanChat.pushContext(from, pushname || sender.split("@")[0], body);

                // Build prompt with full group context
                const context = humanChat.getContext(from, 15);
                if (context) {
                    prompt =
                        `You are chatting in a WhatsApp group. Here is the recent conversation:\n\n` +
                        `${context}\n\n` +
                        `Reply naturally to the latest message as a normal group participant. ` +
                        `Match the language they're using. Keep it short and casual — like texting a friend. ` +
                        `Don't repeat what others said, add to it or respond to it.`;
                }

                // 50/50 reply-to vs plain
                sendOpts = Math.random() < 0.4 ? { quoted: msg } : {};
            }

            try {
                // Tiny delay so it doesn't look instant-robotic
                const delay = isGroup ? 800 + Math.floor(Math.random() * 700) : 300;
                await new Promise(r => setTimeout(r, delay));

                if (config.autoTyping) {
                    try { await conn.sendPresenceUpdate('composing', from); } catch {}
                }

                let reply = await aiChat.askAI(prompt, userId, config.aiSystemPrompt);

                if (reply) {
                    if (isGroup) reply = humanChat.humanize(reply);
                    await conn.sendMessage(from, { text: reply }, sendOpts);
                }
            } catch (e) {
                console.error("aiChat reply error:", e.message);
            }
        }

    } catch (err) {
        console.error("Handler Error:", err.message);
    }
};

// ============================================================
//   GROUP / CALL EVENT HOOKS
// ============================================================
module.exports.handleGroupUpdate = async (conn, update) => {
    try {
        const { id: groupJid, participants, action } = update;
        for (const [, mod] of autoCache) {
            if (typeof mod.enabled === 'function' && !mod.enabled(config)) continue;
            if (action === 'add' && typeof mod.onGroupJoin === 'function') {
                await mod.onGroupJoin(conn, groupJid, participants);
            } else if (action === 'remove' && typeof mod.onGroupLeave === 'function') {
                await mod.onGroupLeave(conn, groupJid, participants);
            }
        }
    } catch (e) { console.error("group update:", e.message); }
};

module.exports.handleCallEvent = async (conn, calls) => {
    for (const [, mod] of autoCache) {
        if (typeof mod.enabled === 'function' && !mod.enabled(config)) continue;
        if (typeof mod.onCall === 'function') {
            try { await mod.onCall(conn, calls); } catch (e) { console.error(`auto/${mod.name}:`, e.message); }
        }
    }
};

// ================= EXPOSE FOR MENU =================
module.exports.getCommandCache = () => commandCache;
module.exports.getAutoCache = () => autoCache;
module.exports.reloadCommands = () => loadCommands(true);