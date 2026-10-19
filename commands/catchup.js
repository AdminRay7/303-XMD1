// commands/catchup.js
// Summarize the last 50 messages in a group using AI.
// Usage: .catchup

const aiChat = require('../lib/aiChat');
const humanChat = require('../lib/humanChat');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'catchup',
    category: 'ai',
    aliases: ['summary', 'summarize'],
    description: 'Summarize what you missed in the group',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup, isOwner } = ctx;

        if (!isGroup) {
            return conn.sendMessage(from, { text: fancy('❌ This command only works in groups.') }, { quoted: msg });
        }

        // Get the last 50 messages (using the 60 min window)
        const context = humanChat.getContext(from, 60);

        if (!context || context.length < 50) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Not enough recent messages to summarize. Wait until the group chats a bit more.') 
            }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy('📖 Reading recent messages...') }, { quoted: msg });

        const prompt = `Here are the recent messages from a WhatsApp group:\n\n${context}\n\nPlease summarize what happened. Use 3-4 short bullet points. Focus on important announcements, arguments, or links shared. Keep it casual.`;
        
        try {
            const summary = await aiChat.askAI(prompt, "summary_" + from, "You are a helpful assistant that summarizes WhatsApp chats concisely.");
            
            if (!summary) throw new Error('AI failed to summarize');

            await conn.sendMessage(from, {
                text: fancy(`📝 *Group Catch-Up*\n\n${summary}`),
                edit: wait.key
            });
        } catch (e) {
            console.error('[catchup] error:', e.message);
            await conn.sendMessage(from, {
                text: fancy('❌ Failed to summarize the chat.'),
                edit: wait.key
            });
        }
    }
};