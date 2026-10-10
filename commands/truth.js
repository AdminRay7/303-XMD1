const { fancy } = require('../lib/font');
const TRUTHS = [
    "What's the most embarrassing thing you've ever done?",
    "Who was your first crush?",
    "What's your biggest fear?",
    "Have you ever lied to your best friend?",
    "What's the strangest dream you've ever had?",
    "What's one thing you would never want your parents to know?",
    "If you could change one thing about yourself, what would it be?",
    "What's the most childish thing you still do?",
    "Who do you secretly admire?",
    "What's the biggest mistake you've ever made?"
];
module.exports = {
    name: 'truth',
    category: 'fun',
    aliases: ['t'],
    description: 'Get a random truth question',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const q = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
        await conn.sendMessage(from, {
            text: `╭─〔 🎯 ᴛʀᴜᴛʜ 〕\n│\n│ ${q}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
