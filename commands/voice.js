// commands/voice.js
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'voice',
    aliases: ['audiofx', 'robot', 'chipmunk', 'deep'],
    category: 'tools',
    description: 'Change the voice/audio of a replied voice note',
    async execute(conn, msg, args, ctx) {
        const { from, command } = ctx;

        // 1. Check if they replied to an audio message
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted || (!quoted.audioMessage && !quoted.ptvMessage)) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Please reply to a voice note with this command.') 
            }, { quoted: msg });
        }

        // 2. Set the effect based on the command
        let filter = '';
        if (command === 'robot') {
            filter = 'asetrate=44100*0.8,atempo=1.25,highpass=f=200,lowpass=f=3000';
        } else if (command === 'chipmunk') {
            filter = 'asetrate=44100*1.5,atempo=0.8';
        } else if (command === 'deep') {
            filter = 'asetrate=44100*0.7,atempo=1.2';
        } else {
            return conn.sendMessage(from, { 
                text: fancy('❌ Choose an effect:\n.robot\n.chipmunk\n.deep') 
            }, { quoted: msg });
        }

        try {
            await conn.sendMessage(from, { react: { text: '⏳', key: msg.key } });

            // 3. Download the audio
            const audioMsg = quoted.audioMessage || quoted.ptvMessage;
            const stream = await downloadContentFromMessage(audioMsg, 'audio');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const audioBuffer = Buffer.concat(chunks);

            // 4. Save temporary files
            const inputPath = path.join(__dirname, `../temp_in_${Date.now()}.ogg`);
            const outputPath = path.join(__dirname, `../temp_out_${Date.now()}.ogg`);
            fs.writeFileSync(inputPath, audioBuffer);

            // 5. Process with FFmpeg (100% local, no API)
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters(filter)
                    .toFormat('ogg')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            const processedBuffer = fs.readFileSync(outputPath);

            // 6. Send the new voice note
            await conn.sendMessage(from, { 
                audio: processedBuffer, 
                mimetype: 'audio/ogg; codecs=opus', 
                ptt: true 
            }, { quoted: msg });

            // Clean up
            fs.unlinkSync(inputPath);
            fs.unlinkSync(outputPath);

            await conn.sendMessage(from, { react: { text: '✅', key: msg.key } });

        } catch (error) {
            console.error('[voice command] Error:', error.message);
            await conn.sendMessage(from, { text: fancy('❌ Failed to process audio.') }, { quoted: msg });
            await conn.sendMessage(from, { react: { text: '❌', key: msg.key } });
        }
    }
};