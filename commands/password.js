// commands/password.js
// Generate a secure random password.
// Usage: .password 16

const crypto = require('crypto');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'password',
    category: 'tools',
    aliases: ['pass', 'genpass'],
    description: 'Generate a secure password',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const length = parseInt(args[0]) || 16;

        if (length < 8 || length > 64) {
            return conn.sendMessage(from, { text: fancy('❌ Length must be between 8 and 64.') }, { quoted: msg });
        }

        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
        let password = '';
        
        // Use crypto for secure randomness
        for (let i = 0; i < length; i++) {
            password += chars[crypto.randomInt(0, chars.length)];
        }

        await conn.sendMessage(from, { 
            text: fancy(`🔐 *Generated Password* (${length} chars)\n\n\`${password}\`\n\n_Tap to copy._`) 
        }, { quoted: msg });
    }
};