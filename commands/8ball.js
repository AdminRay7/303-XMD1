const { fancy } = require('../lib/font');
const ANSWERS = [
    "Yes, definitely.", "It is certain.", "Without a doubt.", "You may rely on it.",
    "Most likely.", "Outlook good.", "Signs point to yes.", "Yes.",
    "Reply hazy, try again.", "Ask again later.", "Better not tell you now.",
    "Cannot predict now.", "Concentrate and ask again.",
    "Don't count on it.", "My reply is no.", "My sources say no.",
    "Outlook not so good.", "Very doubtful."
];
module.exports = {
    name: '8ball',
    category: 'fun',
    aliases: ['ball', 'ask'],
    description: 'Ask the magic 8-ball a question',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const q = args.join(' ').trim();
        if (!q) return conn.sendMessage(from, { text: fancy('❌ Ask a question: .8ball Will I win?') }, { quoted: msg });
        const a = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
        await conn.sendMessage(from, {
            text: `╭─〔 🎱 8-ʙᴀʟʟ 〕\n│\n│ ❓ ${q}\n│ 💬 ${a}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
