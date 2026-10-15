// commands/antimedia.js
// Block media types in groups — one command, multiple sub-toggles.
//
// Usage:
//   .antimedia                → show all current states
//   .antimedia on             → enable ALL media blocks
//   .antimedia off            → disable ALL media blocks
//   .antimedia photo on       → block photos only
//   .antimedia photo off      → allow photos
//   .antimedia video on/off
//   .antimedia sticker on/off
//   .antimedia audio on/off
//   .antimedia voice on/off
//   .antimedia document on/off
//   .antimedia status on/off  → block status mentions
//
// Scope: per-group (each group has its own state)

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const SUBTYPES = ['photo', 'video', 'sticker', 'audio', 'voice', 'document', 'status'];

function bareNum(jid) {
    return String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
}

async function isBotGroupAdmin(conn, groupJid) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const botBare = bareNum(conn.user?.id);
        const botLid = bareNum(conn.user?.lid);
        const me = meta.participants.find(p => {
            const pb = bareNum(p.id);
            return pb === botBare || (botLid && pb === botLid);
        });
        return me && (me.admin === 'admin' || me.admin === 'superadmin');
    } catch { return false; }
}

async function isGroupAdmin(conn, groupJid, sender) {
    try {
        const meta = await conn.groupMetadata(groupJid);
        const sb = bareNum(sender);
        return meta.participants.some(p =>
            bareNum(p.id) === sb && (p.admin === 'admin' || p.admin === 'superadmin')
        );
    } catch { return false; }
}

// Map sub-type → toggle key
function keyFor(sub) {
    return `antimedia_${sub}`;
}

// Check what media type a message is
function detectMedia(msg) {
    const type = Object.keys(msg.message || {})[0];
    const map = {
        imageMessage:    'photo',
        videoMessage:    'video',
        ptvMessage:      'video',
        stickerMessage:  'sticker',
        audioMessage:    msg.message.audioMessage?.ptt ? 'voice' : 'audio',
        documentMessage: 'document'
    };
    return map[type] || null;
}

// Check if message is a status mention
function isStatusMention(msg) {
    const inner = msg.message || {};
    const ext = inner.extendedTextMessage || inner.imageMessage || inner.videoMessage;
    const mentioned = ext?.contextInfo?.mentionedJid || [];
    return mentioned.includes('status@broadcast');
}

module.exports = {
    name: 'antimedia',
    category: 'auto',
    aliases: ['am'],
    description: 'Block media types in a group',
    toggleKey: 'antimedia',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner, userId } = ctx;

        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        if (!isGroup) return conn.sendMessage(from, { text: fancy('❌ Group only command.') });
        if (!(await isBotGroupAdmin(conn, from))) {
            return conn.sendMessage(from, { text: fancy('❌ I must be a group admin to use this.') });
        }

        const a = (args[0] || '').toLowerCase();
        const b = (args[1] || '').toLowerCase();

        // ---------- .antimedia (no args) — show all states ----------
        if (!a) {
            const lines = ['📵 *ANTI-MEDIA — current state*', ''];
            for (const sub of SUBTYPES) {
                const on = await autoToggles.get(userId, keyFor(sub), from, false);
                lines.push(`${on ? '✅' : '❌'} ${sub}`);
            }
            lines.push('');
            lines.push(`Usage: ${config.prefix}antimedia <type> on|off`);
            lines.push(`       ${config.prefix}antimedia on|off  (all)`);
            return conn.sendMessage(from, { text: fancy(lines.join('\n')) }, { quoted: msg });
        }

        // ---------- .antimedia on|off — bulk ----------
        if (a === 'on' || a === 'off') {
            const value = a === 'on';
            for (const sub of SUBTYPES) {
                await autoToggles.set(userId, keyFor(sub), from, value);
            }
            return conn.sendMessage(from, {
                text: fancy(`✅ All media blocks ${value ? 'ENABLED' : 'DISABLED'}.`)
            }, { quoted: msg });
        }

        // ---------- .antimedia <sub> on|off ----------
        if (!SUBTYPES.includes(a)) {
            return conn.sendMessage(from, {
                text: fancy(`❌ Unknown type: ${a}\n\nTypes: ${SUBTYPES.join(', ')}`)
            }, { quoted: msg });
        }

        // Show single state if no on/off
        if (!b) {
            const on = await autoToggles.get(userId, keyFor(a), from, false);
            return conn.sendMessage(from, {
                text: fancy(`${on ? '✅' : '❌'} ${a}: ${on ? 'ON' : 'OFF'}`)
            }, { quoted: msg });
        }

        if (!['on', 'off'].includes(b)) {
            return conn.sendMessage(from, {
                text: fancy(`Usage: ${config.prefix}antimedia ${a} on|off`)
            }, { quoted: msg });
        }

        const value = b === 'on';
        await autoToggles.set(userId, keyFor(a), from, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ ${a} ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT — one hook, checks each subtype
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isGroup, isOwner, userId } = ctx;

        if (!isGroup) return false;
        if (isOwner) return false;
        if (msg.key.fromMe) return false;

        // Check status mention first (before media types)
        const statusOn = await autoToggles.get(userId, keyFor('status'), from, false);
        if (statusOn && isStatusMention(msg)) {
            if (await isGroupAdmin(conn, from, sender)) return false;
            if (!(await isBotGroupAdmin(conn, from))) return false;
            try {
                await conn.sendMessage(from, { delete: msg.key });
                await conn.sendMessage(from, { text: fancy('📱 Status mentions not allowed here.') });
            } catch (e) { console.error('[antimedia] status delete failed:', e.message); }
            return true;
        }

        // Detect media type
        const mediaType = detectMedia(msg);
        if (!mediaType) return false;

        // Is this type blocked?
        const on = await autoToggles.get(userId, keyFor(mediaType), from, false);
        if (!on) return false;

        // Admin exempt
        if (await isGroupAdmin(conn, from, sender)) return false;

        // Bot must be admin
        if (!(await isBotGroupAdmin(conn, from))) {
            console.log(`[antimedia] ${mediaType} blocked but bot not admin`);
            return false;
        }

        // Delete + warn
        try {
            await conn.sendMessage(from, { delete: msg.key });
            console.log(`[antimedia] deleted ${mediaType}`);
        } catch (e) {
            console.error(`[antimedia] delete ${mediaType} failed:`, e.message);
            return false;
        }

        try {
            await conn.sendMessage(from, {
                text: fancy(`📵 ${mediaType} not allowed here.`)
            });
        } catch {}

        return true;
    }
};