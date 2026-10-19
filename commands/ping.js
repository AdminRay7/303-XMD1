// commands/ping.js
// Simple speed test.
// Usage: .ping

module.exports = {
    name: 'ping',
    category: 'general',
    aliases: ['p', 'speed'],
    description: 'Check bot speed',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const t0 = Date.now();

        // Send initial message
        const sent = await conn.sendMessage(from, { text: '𝐏𝐢𝐧𝐠𝐢𝐧𝐠...' }, { quoted: msg });

        // Calculate latency
        const latency = Date.now() - t0;

        // Edit the message with the result
        try {
            await conn.sendMessage(from, { 
                text: `𝐏𝛐𝛈𝐠! ⚡ 𝛒𝛔𝛈𝐠𝐞𝐞𝐝: ${latency} ms`, 
                edit: sent.key 
            });
        } catch (e) {
            await conn.sendMessage(from, { text: `𝐏𝛐𝛈𝐠! ⚡ 𝛒𝛔𝛈𝐠𝐞𝐞𝐝: ${latency} ms` }, { quoted: msg });
        }
    }
};