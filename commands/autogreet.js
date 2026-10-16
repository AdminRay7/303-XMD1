// commands/autogreet.js
// Replies to common greetings with a casual, human-like response.
// No AI needed — uses a built-in dictionary of greetings + responses.
// Toggle: .autogreet on | off | (no args = show state)
// Scope: session-wide (all chats)
//
// Rules:
//   - Owner exempt
//   - Bot itself exempt
//   - Only triggers when the entire message IS a greeting (not buried in text)
//   - 60s cooldown per user so it doesn't feel spammy

const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

// ---- Greeting dictionary ----
// key: lowercase greeting to match
// value: array of possible responses
const GREETINGS = {
    // English
    'hi':         ['Hey! 👋', 'Hi there!', 'Hello! 😊', 'Yo! 👋'],
    'hey':        ['Hey!', 'Yo! 😎', 'Sup!', 'Hey hey 👋'],
    'hello':      ['Hello! 👋', 'Hi!', 'Hey there! 😊'],
    'hiya':       ['Hiya! 👋', 'Hey!'],
    'yo':         ['Yo! 😎', 'Sup!', 'Hey!'],
    'sup':        ['Not much, you? 😎', 'Sup! 👋', 'Chilling. You?'],
    'good morning': ['Morning! ☀️', 'Good morning! 🌅', 'Morning 🌞'],
    'morning':    ['Morning! ☀️', 'Good morning! 🌅'],
    'good afternoon': ['Afternoon! 🌤️', 'Good afternoon! ☀️'],
    'afternoon':  ['Afternoon! 🌤️'],
    'good evening': ['Evening! 🌆', 'Good evening! ✨'],
    'evening':    ['Evening! 🌆'],
    'good night': ['Good night! 🌙', 'Night night 💤'],
    'goodnight':  ['Good night! 🌙', 'Night night 💤'],
    'night':      ['Night! 🌙'],
    'bye':        ['Bye! 👋', 'Later!', 'See ya! ✌️'],
    'goodbye':    ['Bye! 👋', 'Later!'],
    'later':      ['Later! ✌️', 'See ya!'],
    'cya':        ['See ya! ✌️', 'Later!'],

    // Swahili / Kenyan
    'mambo':      ['Mambo vipi! 😎', 'Poa! Wewe?', 'Mambo sawa! 👋'],
    'habari':     ['Nzuri! Wewe? 😊', 'Habari yako?', 'Poa!'],
    'sasa':       ['Sasa! 👋', 'Poa. Wewe?', 'Sasa hivi! 😎'],
    'vipi':       ['Poa! Wewe?', 'Vipi bro! 👋'],
    'poa':        ['Poa! 😊', 'Fresh!'],
    'karibu':     ['Asante! 🙏', 'Karibu! 😊'],
    'asante':     ['Karibu! 🙏', 'Poa!'],
    'shikamoo':   ['Marahaba! 👴', 'Marahaba! 😊'],
    'niko sawa':  ['Poa! 👋', 'Fresh!'],

    // Arabic
    'salam':      ['Wa alaikum salaam! 🤲', 'Salaam! ✨'],
    'salaam':     ['Wa alaikum salaam! 🤲'],
    'assalamu alaikum': ['Wa alaikum salaam! 🤲', 'Wa alaikum salaam warahmatullah!'],
    'asalaam':    ['Wa alaikum salaam! 🤲'],
    'marhaba':    ['Marhaba! 👋', 'Ahlan wa sahlan!'],

    // Hindi / Urdu
    'namaste':    ['Namaste! 🙏', 'Namaskar!'],
    'namaskar':   ['Namaste! 🙏'],
    'hai':        ['Haan! 😊', 'Haan bolo'],
    'kaise ho':   ['Main theek hoon! Aap? 😊'],
    'kaisa hai':  ['Main theek hoon! 😊'],
    'theek':      ['Theek! 😊', 'Poa!'],

    // French
    'bonjour':    ['Bonjour! 👋', 'Salut! 😊'],
    'salut':      ['Salut! 👋', 'Bonjour!'],
    'bonsoir':    ['Bonsoir! 🌆'],
    'au revoir':  ['Au revoir! 👋'],

    // Spanish
    'hola':       ['¡Hola! 👋', '¡Hey! 😊'],
    'buenos dias':['¡Buenos días! ☀️'],
    'buenas':     ['¡Buenas! 👋'],
    'adios':      ['¡Adiós! 👋'],

    // Portuguese
    'ola':        ['Olá! 👋', 'Oi! 😊'],
    'oi':         ['Oi! 👋', 'Olá!'],

    // German
    'hallo':      ['Hallo! 👋'],
    'guten tag':  ['Guten Tag! 👋'],
    'guten morgen': ['Guten Morgen! ☀️'],

    // Chinese
    'nihao':      ['你好! 👋', '你好吗? 😊'],
    'ni hao':     ['你好! 👋'],

    // Japanese
    'konnichiwa': ['こんにちは! 👋'],
    'ohayo':      ['おはよう! ☀️'],
    'ohayou':     ['おはよう! ☀️'],
};

// ---- Cooldown (per user) ----
// Map<senderJid, timestamp>
const cooldowns = new Map();
const COOLDOWN_MS = 60 * 1000;   // 60 seconds

setInterval(() => {
    const now = Date.now();
    for (const [k, t] of cooldowns) {
        if (now - t > COOLDOWN_MS) cooldowns.delete(k);
    }
}, 5 * 60 * 1000).unref();

// ---- Match function ----
// Returns the greeting key if the ENTIRE message is a greeting (with punctuation stripped)
function matchGreeting(text) {
    if (!text) return null;
    // Strip punctuation, emojis, extra whitespace
    const clean = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, '')   // remove punctuation + emoji
        .replace(/\s+/g, ' ')
        .trim();
    if (!clean) return null;
    if (clean.length > 30) return null;   // only short greetings

    return GREETINGS[clean] ? clean : null;
}

function pickReply(key) {
    const list = GREETINGS[key];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
}

module.exports = {
    name: 'autogreet',
    category: 'auto',
    aliases: ['ag'],
    description: 'Auto-reply to greetings (multi-language)',
    toggleKey: 'autogreet',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });

        const action = (args[0] || '').toLowerCase();

        if (action === '') {
            const on = await autoToggles.get(userId, 'autogreet', null, config.autoGreet === true);
            return conn.sendMessage(from, {
                text: fancy(
                    `🙋 Auto-Greet: ${on ? '✅ ON' : '❌ OFF'}\n` +
                    `Replies to greetings in EN, SW, AR, HI, FR, ES, PT, DE, ZH, JP`
                )
            }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) {
            return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}autogreet on|off`) });
        }

        const value = action === 'on';
        await autoToggles.set(userId, 'autogreet', null, value);
        return conn.sendMessage(from, {
            text: fancy(`✅ Auto-Greet ${value ? 'ENABLED' : 'DISABLED'}.`)
        }, { quoted: msg });
    },

    // ============================================================
    //   ENFORCEMENT
    // ============================================================
    async onMessage(conn, msg, ctx) {
        const { from, sender, isOwner, body } = ctx;

        if (isOwner) return false;
        if (msg.key.fromMe) return false;
        if (!body || !body.trim()) return false;
        if (body.startsWith(config.prefix)) return false;   // ignore commands

        const key = matchGreeting(body);
        if (!key) return false;

        // Cooldown check
        const now = Date.now();
        const last = cooldowns.get(sender) || 0;
        if (now - last < COOLDOWN_MS) return false;
        cooldowns.set(sender, now);

        const reply = pickReply(key);
        if (!reply) return false;

        try {
            await conn.sendMessage(from, { text: reply }, { quoted: msg });
            console.log(`[autogreet] replied "${reply}" to "${key}" from ${sender}`);
        } catch (e) {
            console.error('[autogreet] send failed:', e.message);
        }
        return false;   // don't consume — let AI or other modules also process
    }
};