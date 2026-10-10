const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');
const config = require('../config');
const { fancy } = require('../lib/font');

// ---- Config override model (auto-created if missing) ----
const OverrideSchema = new mongoose.Schema({
    key: { type: String, unique: true, index: true },
    value: mongoose.Schema.Types.Mixed,
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const ConfigOverride = mongoose.models.ConfigOverride ||
    mongoose.model('ConfigOverride', OverrideSchema);

// ---- Toggle keys (map command name → config key) ----
const TOGGLES = {
    antidelete:   'antidelete',
    antilink:     'antilink',
    antibug:      'antibug',
    antispam:     'antispam',
    anticall:     'anticall',
    autogreet:    'autoGreet',
    autoread:     'autoRead',
    autoreact:    'autoReact',
    autosave:     'autoSave',
    welcome:      'welcomeMessage',
    goodbye:      'goodbyeMessage',
    statusview:   'autoStatus.view',
    statuslike:   'autoStatus.like',
    statusreply:  'autoStatus.reply',
    antimedia:    'antimedia'     // special: off / all / photo / video / sticker
};

function setNested(obj, pathStr, value) {
    const parts = pathStr.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
}

async function getOverrides() {
    const docs = await ConfigOverride.find({}).lean();
    const out = {};
    for (const d of docs) setNested(out, d.key, d.value);
    return out;
}

async function setOverride(key, value) {
    await ConfigOverride.updateOne(
        { key },
        { $set: { value, updatedAt: new Date() } },
        { upsert: true }
    );
}

// ---- Apply overrides on top of config at runtime ----
async function applyOverrides() {
    const o = await getOverrides();
    for (const [k, v] of Object.entries(o)) setNested(config, k, v);
}

// Apply on boot
applyOverrides().catch(e => console.error('applyOverrides:', e.message));

module.exports = {
    name: 'auto',
    category: 'admin',
    aliases: ['toggle', 'set'],
    description: 'Toggle auto-detection modules on/off',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, config } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const sub = (args[0] || '').toLowerCase();

        // ---- LIST ----
        if (!sub || sub === 'list') {
            let text = `╭─〔 ⚙️ ᴀᴜᴛᴏ ᴛᴏɢɢʟᴇs 〕\n│\n`;
            for (const [name, key] of Object.entries(TOGGLES)) {
                const val = getNested(config, key);
                const label = typeof val === 'boolean' ? (val ? '✅ ON' : '❌ OFF') : `⚙️ ${val}`;
                text += `│ ${name.padEnd(12)} ${label}\n`;
            }
            text += `│\n╰──────────────────────\n`;
            text += `\n_Usage: ${config.prefix}auto <name> <on|off>_`;
            return conn.sendMessage(from, { text }, { quoted: msg });
        }

        // ---- ANTIMEDIA special ----
        if (sub === 'antimedia') {
            const mode = (args[1] || '').toLowerCase();
            const valid = ['off', 'all', 'photo', 'video', 'sticker'];
            if (!valid.includes(mode)) {
                return conn.sendMessage(from, {
                    text: fancy(`❌ Usage: ${config.prefix}auto antimedia <off|all|photo|video|sticker>`)
                }, { quoted: msg });
            }
            await setOverride('antimedia', mode);
            config.antimedia = mode;
            return conn.sendMessage(from, { text: fancy(`✅ antimedia set to: ${mode}`) }, { quoted: msg });
        }

        // ---- TOGGLE ----
        const key = TOGGLES[sub];
        if (!key) {
            return conn.sendMessage(from, {
                text: fancy(`❌ Unknown: ${sub}\n\nUse ${config.prefix}auto list`)
            }, { quoted: msg });
        }

        const action = (args[1] || '').toLowerCase();
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, {
                text: fancy(`❌ Usage: ${config.prefix}auto ${sub} <on|off>`)
            }, { quoted: msg });
        }

        const value = action === 'on';
        await setOverride(key, value);

        // Live-apply to config object
        setNested(config, key, value);

        return conn.sendMessage(from, {
            text: fancy(`✅ ${sub} → ${value ? 'ON' : 'OFF'}`)
        }, { quoted: msg });
    }
};

// ---- Helpers ----
function getNested(obj, pathStr) {
    const parts = pathStr.split('.');
    let cur = obj;
    for (const p of parts) {
        if (!cur || typeof cur !== 'object') return undefined;
        cur = cur[p];
    }
    return cur;
}