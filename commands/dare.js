const { fancy } = require('../lib/font');
const DARES = [
    "Send a selfie right now.",
    "Text your crush 'I like you' and screenshot it.",
    "Do 20 push-ups and send proof.",
    "Sing the chorus of your favorite song in a voice note.",
    "Change your WhatsApp status to something embarrassing for 1 hour.",
    "Say the alphabet backward in 15 seconds.",
    "Show the last 5 photos in your gallery.",
    "Do your best impression of another group member.",
    "Tell us your most embarrassing nickname.",
    "Let the group choose your profile picture for 24 hours."
];
module.exports = {
    name: 'dare',
    category: 'fun',
    aliases: ['d'],
    description: 'Get a random dare challenge',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const q = DARES[Math.floor(Math.random() * DARES.length)];
        await conn.sendMessage(from, {
            text: `╭─〔 🔥 ᴅᴀʀᴇ 〕\n│\n│ ${q}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
