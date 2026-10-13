// commands/statuslike.js
const autoToggles = require('../lib/autoToggles');
const { fancy } = require('../lib/font');
const config = require('../config');

const EMOJIS = ['🔥', '❤️', '💯', '👏', '😂', '😮', '✨', '👌', '🙌', '💫'];

module.exports = {
    name: 'statuslike',
    category: 'auto',
    aliases: ['autolike', 'sl'],
    description: 'Auto-react to WhatsApp statuses',
    toggleKey: 'statuslike',
    enabled: () => true,

    async execute(conn, msg, args, ctx) {
        const { from, isOwner, userId } = ctx;
        if (!isOwner) return conn.sendMessage(from, { text: fancy('❌ Owner only.') });
        const action = (args[0] || '').toLowerCase();
        if (action === '') {
            const on = await autoToggles.get(userId, 'statuslike', null, config.autoStatusLike === true);
            return conn.sendMessage(from, { text: fancy(`❤️ Status Like: ${on ? '✅ ON' : '❌ OFF'}`) }, { quoted: msg });
        }
        if (!['on', 'off'].includes(action)) return conn.sendMessage(from, { text: fancy(`Usage: ${config.prefix}statuslike on|off`) });
        await autoToggles.set(userId, 'statuslike', null, action === 'on');
        return conn.sendMessage(from, { text: fancy(`✅ Status Like ${action === 'on' ? 'ENABLED' : 'DISABLED'}.`) }, { quoted: msg });
    },

    async onMessage(conn, msg, ctx) {
        const from = msg.key.remoteJid;
        if (from !== 'status@broadcast') return false;
        if (msg.key.fromMe) return false;

        const posterJid = msg.key.participant || msg.participant;
        if (!posterJid) return false;

        const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];

        try {
            await conn.sendMessage('status@broadcast', {
                react: {
                    text: emoji,
                    key: {
                        remoteJid: 'status@broadcast',
                        fromMe: false,
                        id: msg.key.id,
                        participant: posterJid
                    }
                }
            }, {
                statusJidList: [posterJid]
            });
            console.log(`[statuslike] reacted ${emoji} to ${posterJid}'s status`);
        } catch (e) {
            console.error('[statuslike] react failed:', e.message);
        }
        return false;
    }
};