const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const config = require('./config');
const { fancy } = require('./lib/font');
const { User, ChannelSubscriber, ChannelPost } = require('./database/models');
const messageStore = require('./lib/messageStore');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

// ================= HOT-RELOAD COMMAND LOADER =================
// Watches /commands folder. Reloads on change (add / edit / delete).
// No restart required. Subfolders become categories.

const COMMANDS_DIR = path.join(__dirname, 'commands');
const commandCache = new Map();
let folderSignature = '';
let lastScan = 0;
const RESCAN_DEBOUNCE_MS = 2000;

/**
 * Compute a signature of the commands folder.
 * Any file add/remove/mtime change alters this string.
 */
function computeFolderSignature(dir) {
    if (!fs.existsSync(dir)) return '';
    const parts = [];
    const walk = (d) => {
        for (const item of fs.readdirSync(d)) {
            const full = path.join(d, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) walk(full);
            else if (item.endsWith('.js')) {
                parts.push(`${item}:${stat.mtimeMs}`);
            }
        }
    };
    walk(dir);
    return parts.sort().join('|');
}

function loadCommands(force = false) {
    const now = Date.now();
    if (!force && now - lastScan < RESCAN_DEBOUNCE_MS) return false;
    lastScan = now;

    if (!fs.existsSync(COMMANDS_DIR)) {
        if (commandCache.size > 0) {
            commandCache.clear();
            console.log(fancy('📂 No commands folder — cache cleared.'));
        }
        return false;
    }

    const sig = computeFolderSignature(COMMANDS_DIR);
    if (!force && sig === folderSignature) return false;

    folderSignature = sig;
    commandCache.clear();

    const walk = (dir) => {
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
                walk(itemPath);
            } else if (item.endsWith('.js')) {
                try {
                    // Bust require cache so edits take effect
                    delete require.cache[require.resolve(itemPath)];
                    const mod = require(itemPath);
                    if (!mod || typeof mod.execute !== 'function') continue;

                    const names = [
                        mod.name,
                        ...(Array.isArray(mod.aliases) ? mod.aliases : [])
                    ].filter(Boolean).map(s => String(s).toLowerCase());

                    for (const n of names) {
                        if (commandCache.has(n)) {
                            console.warn(fancy(`⚠️ Duplicate command: ${n} (${item})`));
                        }
                        commandCache.set(n, mod);
                    }
                } catch (e) {
                    console.error(`⚠️ Failed to load ${itemPath}:`, e.message);
                }
            }
        }
    };

    walk(COMMANDS_DIR);
    console.log(fancy(`♻️  Reloaded ${commandCache.size} command(s).`));
    return true;
}

// Initial scan
loadCommands(true);

// Background watcher (safe if nothing changes)
setInterval(() => {
    try { loadCommands(false); } catch (e) { console.error('Command watch:', e.message); }
}, 3000).unref();

// ================= DEBOUNCED USER SAVES =================
const pendingUserSaves = new Map();
function scheduleUserSave(user) { pendingUserSaves.set(user.jid, user); }
setInterval(async () => {
    for (const [, user] of pendingUserSaves) {
        try { await user.save(); } catch {}
    }
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
            } catch (e) {
                console.error("handleButton error:", e.message);
            }
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
        const isOwner   = String(config.ownerNumber).includes(sender.split('@')[0]) || msg.key.fromMe;
        const prefix    = config.prefix;
        const isCmd     = body && body.startsWith(prefix);
        const command   = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
        const args      = body ? body.trim().split(/ +/).slice(1) : [];

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
                            msgId: msg.key.id,
                            serverId: msg.key.server_id,
                            jid: from,
                            text: postText,
                            type,
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

        // ================= CONTEXT =================
        const cmdCtx = {
            from, sender, fancy, isOwner, pushname, config, conn, msg,
            userId, isGroup, isChannel, body, args, command, prefix
        };

        // ================= BUTTON ROUTER =================
        if (await routeButtonInteraction(conn, msg, cmdCtx)) return;

        // ================= HOT-RELOAD CHECK (before command exec) =================
        if (isCmd) {
            try { loadCommands(false); } catch (e) { console.error('Hot reload:', e.message); }
        }

        // ================= ANTIDELETE: SAVE =================
        if (config.antidelete && msg.key?.id && !msg.key.fromMe) {
            try {
                const stored = {
                    msg, from, sender, pushname, userId,
                    timestamp: Date.now(), mediaBuffer: null, mediaType: null
                };

                if (['imageMessage','videoMessage','audioMessage','stickerMessage'].includes(type)) {
                    try {
                        const innerType = type.replace('Message', '').toLowerCase();
                        const stream = await downloadContentFromMessage(msg.message[type], innerType);
                        const chunks = []; let total = 0;
                        const MAX = 3 * 1024 * 1024;
                        for await (const c of stream) {
                            total += c.length;
                            if (total > MAX) throw new Error("Media too large");
                            chunks.push(c);
                        }
                        stored.mediaBuffer = Buffer.concat(chunks);
                        stored.mediaType = type;
                    } catch (e) { console.log("Skip large media:", e.message); }
                }
                messageStore.save(msg.key.id, stored);
            } catch (e) { console.error("Antidelete save:", e.message); }
        }

        // ================= ANTIDELETE: REVOKE =================
        const isRevoke = type === 'protocolMessage' && msg.message.protocolMessage?.type === 0;
        if (isRevoke && config.antidelete) {
            try {
                const dKey = msg.message.protocolMessage.key;
                const original = messageStore.get(dKey.id);
                if (original) {
                    const who = msg.key.participant || msg.key.remoteJid;
                    await conn.sendMessage(from, {
                        text: fancy(`🚨 ᴀɴᴛɪᴅᴇʟᴇᴛᴇ\n@${who.split('@')[0]} deleted a message:`),
                        mentions: [who]
                    });

                    const om = original.msg;
                    const text = om.message?.conversation ||
                                 om.message?.extendedTextMessage?.text ||
                                 om.message?.imageMessage?.caption ||
                                 om.message?.videoMessage?.caption;

                    if (text && !original.mediaBuffer) {
                        await conn.sendMessage(from, { text: `📄 ᴅᴇʟᴇᴛᴇᴅ:\n\n${text}` });
                    } else if (original.mediaBuffer && original.mediaType === 'imageMessage') {
                        await conn.sendMessage(from, { image: original.mediaBuffer, caption: text || "📷 ᴅᴇʟᴇᴛᴇᴅ ɪᴍᴀɢᴇ" });
                    } else if (original.mediaBuffer && original.mediaType === 'videoMessage') {
                        await conn.sendMessage(from, { video: original.mediaBuffer, caption: text || "🎥 ᴅᴇʟᴇᴛᴇᴅ ᴠɪᴅᴇᴏ" });
                    } else if (original.mediaBuffer && original.mediaType === 'audioMessage') {
                        await conn.sendMessage(from, { audio: original.mediaBuffer, mimetype: 'audio/mp4', ptt: true });
                    } else if (original.mediaBuffer && original.mediaType === 'stickerMessage') {
                        await conn.sendMessage(from, { sticker: original.mediaBuffer });
                    }
                    messageStore.remove(dKey.id);
                }
            } catch (e) { console.error("Antidelete:", e.message); }
            return;
        }

        // ================= AUTO READ =================
        if (config.autoRead) { try { await conn.readMessages([msg.key]); } catch {} }

        // ================= AUTO REACT (DM only) =================
        if (config.autoReact && !msg.key.fromMe && !isGroup) {
            try {
                const r = ['🔑','🔥','⭐','✨','💯'][Math.floor(Math.random()*5)];
                await conn.sendMessage(from, { react: { text: r, key: msg.key } });
            } catch {}
        }

        // ================= AUTO SAVE USER =================
        if (config.autoSave && !isOwner && !isGroup) {
            try {
                let user = await User.findOne({ jid: sender });
                if (!user) user = new User({ jid: sender, name: pushname, sessionId: userId, lastActive: new Date(), messageCount: 1 });
                else { user.messageCount += 1; user.lastActive = new Date(); }
                scheduleUserSave(user);
            } catch {}
        }

        // ================= WORK MODE =================
        if (config.workMode === 'private' && !isOwner) return;

        // ================= AUTO SUBSCRIBE PROMPT =================
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

        // ================= ANTIBUG =================
        if (config.antibug && body) {
            const patterns = ['\u200e','\u200f','\u202e','\u202a','\u202b','\u202c','\u202d', /[\u2066-\u2069]/g, /[\u2000-\u200F]/g, /[\u2028-\u202F]/g];
            const hasBug = patterns.some(p => typeof p === 'string' ? body.includes(p) : (p.lastIndex = 0, p.test(body)));
            if (hasBug) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    await conn.sendMessage(from, {
                        text: fancy(`🚫 ʙᴜɢ ᴅᴇᴛᴇᴄᴛᴇᴅ\n@${sender.split('@')[0]}`),
                        mentions: [sender]
                    });
                    return;
                } catch {}
            }
        }

        // ================= ANTISPAM =================
        if (config.antispam && !isOwner) {
            try {
                let user = await User.findOne({ jid: sender });
                const now = Date.now();
                if (user) {
                    const diff = now - (user.lastMessageTime || 0);
                    if (diff < 60000) {
                        user.spamCount = (user.spamCount || 0) + 1;
                        if (user.spamCount >= 5) {
                            if (isGroup) {
                                await conn.groupParticipantsUpdate(from, [sender], "remove");
                                await conn.sendMessage(from, { text: fancy(`🚫 ꜱᴘᴀᴍᴍᴇʀ ʀᴇᴍᴏᴠᴇᴅ`), mentions: [sender] });
                            } else {
                                await conn.updateBlockStatus(sender, 'block');
                            }
                            user.spamCount = 0;
                        }
                    } else user.spamCount = 0;
                    user.lastMessageTime = now;
                    scheduleUserSave(user);
                }
            } catch {}
        }

        // ================= AUTOBLOCK COUNTRY =================
        if (config.autoblock.length && !isOwner) {
            const cc = sender.split('@')[0].substring(0, 3).replace('+', '');
            if (config.autoblock.includes(cc)) {
                try { await conn.updateBlockStatus(sender, 'block'); return; } catch {}
            }
        }

        // ================= GROUP SECURITY =================
        if (isGroup && !isOwner) {
            if (config.antilink && body?.match(/https?:\/\//gi)) {
                try {
                    await conn.sendMessage(from, { delete: msg.key });
                    await conn.sendMessage(from, { text: fancy(`⚠️ ᴀɴᴛɪʟɪɴᴋ`), mentions: [sender] });
                    return;
                } catch {}
            }
            if (config.antimedia !== 'off') {
                const map = { 'imageMessage':'photo', 'videoMessage':'video', 'stickerMessage':'sticker' };
                if (map[type] && (config.antimedia === 'all' || config.antimedia === map[type])) {
                    try {
                        await conn.sendMessage(from, { delete: msg.key });
                        await conn.sendMessage(from, { text: fancy(`🚫 ᴀɴᴛɪᴍᴇᴅɪᴀ`), mentions: [sender] });
                        return;
                    } catch {}
                }
            }
        }

        // ================= COMMANDS =================
        // Fully hot-reloaded. Drop a file in /commands → it works instantly.
        if (isCmd) {
            const handler = commandCache.get(command);
            if (handler && typeof handler.execute === 'function') {
                try {
                    await Promise.race([
                        handler.execute(conn, msg, args, cmdCtx),
                        new Promise((_, rej) => setTimeout(() => rej(new Error('Command timeout')), 60000))
                    ]);
                } catch (e) {
                    console.error(`Cmd "${command}":`, e.message);
                    await conn.sendMessage(from, { text: fancy(`❌ Error: ${e.message}`) });
                }
            }
            // Silent if command not found — you add your own fallback later.
        }

    } catch (err) {
        console.error("Handler Error:", err.message);
    }
};

// ================= EXPOSE FOR MENU =================
module.exports.getCommandCache = () => commandCache;
module.exports.reloadCommands = () => loadCommands(true);