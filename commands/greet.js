const RULES = [
    { match: ['hello','hi','hey','yo','sup','hola','habari','salamu','mambo','niaje','sasa'], reply: 'Hey 👋 How can I help you today?' },
    { match: ['good morning','morning','subuhi njema','habari ya asubuhi'], reply: 'Good morning ☀️ Have a great day!' },
    { match: ['good afternoon','afternoon','habari ya mchana'], reply: 'Good afternoon 🌤️ How are you?' },
    { match: ['good evening','evening','habari ya jioni','usiku mwema'], reply: 'Good evening 🌙 How was your day?' },
    { match: ['good night','goodnight','lala salama'], reply: 'Good night 😴 Sleep well!' },
    { match: ['thank you','thanks','asante','shukran','ty'], reply: "You're welcome 😊" },
    { match: ['bye','goodbye','kwaheri'], reply: 'Goodbye 👋 Come back soon!' },
    { match: ['how are you','how r u','unaendeleaje','uko aje'], reply: "I'm doing great, thanks for asking! 😄" }
];
function matchGreeting(text) {
    if (!text) return null;
    const lower = text.toLowerCase().trim();
    for (const rule of RULES) {
        for (const m of rule.match) {
            const re = new RegExp(`(^|\\s)${m}(\\s|$|[!?.,])`, 'i');
            if (re.test(lower)) return rule.reply;
        }
    }
    return null;
}
module.exports = {
    name: 'autogreet',
    category: 'auto',
    tags: ['social'],
    description: 'Auto-reply to greetings',
    enabled: (cfg) => cfg.autoGreet === true,
    async onMessage(conn, msg, ctx) {
        if (msg.key.fromMe || ctx.isCmd) return false;
        if (!ctx.body || ctx.body.length > 200) return false;
        const greeting = matchGreeting(ctx.body);
        if (!greeting) return false;
        try { await conn.sendMessage(ctx.from, { text: greeting }, { quoted: msg }); } catch {}
        return true;
    }
};
