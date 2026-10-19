// commands/pp.js
// Get the profile picture of a user or group.
// Usage: .pp @user   OR reply with .pp

const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'pp',
    category: 'tools',
    aliases: ['profilepic', 'avatar'],
    description: 'Get profile picture',
    async execute(conn, msg, args, ctx) {
        const { from, isGroup } = ctx;

        let targetJid = from;
        
        // If tagged someone
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mentioned.length > 0) {
            targetJid = mentioned[0];
        } 
        // If replied to someone
        else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant;
        } 
        // If in DM, but wants their own
        else if (!isGroup) {
            targetJid = from;
        }

        try {
            const ppUrl = await conn.profilePictureUrl(targetJid, 'image');
            
            await conn.sendMessage(from, { 
                image: { url: ppUrl }, 
                caption: fancy(`📸 Profile picture`) 
            }, { quoted: msg });
        } catch (e) {
            // Baileys throws an error if the user has no PP or hides it
            await conn.sendMessage(from, { text: fancy('❌ No profile picture found or it is hidden.') }, { quoted: msg });
        }
    }
};