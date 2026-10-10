const { fancy } = require('../lib/font');
const ROASTS = [
    "You're the reason shampoo has instructions.",
    "You bring everyone so much joy… when you leave the room.",
    "I'd agree with you but then we'd both be wrong.",
    "Your secrets are safe with me. I wasn't even listening.",
    "You're not stupid; you just have bad luck when you think.",
    "Somewhere a tree is working hard to produce oxygen for you. Apologize.",
    "You're proof that evolution can go in reverse.",
    "I was going to give you a nasty look but I see you already have one.",
    "You have your entire life to be an idiot. Why not take today off?",
    "If laziness was an Olympic sport, you'd come in 4th so you don't have to walk to the podium."
];
module.exports = {
    name: 'roast',
    category: 'fun',
    aliases: ['burn'],
    description: 'Get roasted',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const r = ROASTS[Math.floor(Math.random() * ROASTS.length)];
        await conn.sendMessage(from, {
            text: `╭─〔 🔥 ʀᴏᴀꜱᴛ 〕\n│\n│ ${r}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
