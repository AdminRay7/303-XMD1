// commands/pdf.js
// Read a document, extract the text, and use AI to answer questions about it.
// Usage: (Reply to a document with) .pdf <your question>

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const aiChat = require('../lib/aiChat');
const { fancy } = require('../lib/font');
const config = require('../config');

module.exports = {
    name: 'pdf',
    category: 'ai',
    aliases: ['doc', 'read'],
    description: 'Extract text from a document and use AI to summarize/answer',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const prompt = args.join(' ') || 'Summarize this document briefly.';
        const msgContext = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = msgContext?.quotedMessage;

        if (!quoted || !quoted.documentMessage) {
            return conn.sendMessage(from, { text: fancy(`❌ Reply to a PDF or text document with ${config.prefix}pdf <question>`) }, { quoted: msg });
        }

        const fileName = quoted.documentMessage.fileName || 'file';
        const mime = quoted.documentMessage.mimetype;

        // Only support PDF and plain text for now
        if (!mime.includes('pdf') && !mime.includes('text') && !mime.includes('word')) {
            return conn.sendMessage(from, { text: fancy('❌ Only PDF, TXT, or Word documents are supported.') }, { quoted: msg });
        }

        const wait = await conn.sendMessage(from, { text: fancy(`📄 Reading ${fileName}...`) }, { quoted: msg });

        try {
            // 1. Download the document
            const quotedMsg = {
                key: { remoteJid: from, fromMe: false, id: msgContext.stanzaId, participant: msgContext.participant },
                message: quoted
            };
            const buffer = await downloadMediaMessage(quotedMsg, 'buffer', {}, { logger: console });

            let text = '';

            // 2. Extract text based on file type
            if (mime.includes('pdf')) {
                const pdfData = await pdfParse(buffer);
                text = pdfData.text;
            } else {
                text = buffer.toString('utf-8');
            }

            if (!text || text.trim().length === 0) {
                throw new Error('No text found in this document.');
            }

            // Limit to first ~4000 words to avoid blowing up AI context limits
            const truncatedText = text.slice(0, 20000);
            
            await conn.sendMessage(from, { text: fancy('🧠 Analyzing text...'), edit: wait.key });

            // 3. Send to AI
            const sysPrompt = "You are a helpful assistant. Read the provided document text and answer the user's question accurately. Be concise.";
            const fullPrompt = `Document Text:\n\n${truncatedText}\n\nUser Question: ${prompt}`;
            
            const reply = await aiChat.askAI(fullPrompt, "pdf_" + from, sysPrompt);

            if (!reply) throw new Error('AI failed to process the document.');

            // 4. Reply
            await conn.sendMessage(from, {
                text: fancy(`📄 *Document Analysis:*\n\n${reply}`),
                edit: wait.key
            });

        } catch (e) {
            console.error('[pdf] error:', e.message);
            await conn.sendMessage(from, { text: fancy(`❌ Failed: ${e.message}`), edit: wait.key });
        }
    }
};