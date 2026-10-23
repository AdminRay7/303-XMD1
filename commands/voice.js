// commands/voice.js
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { fancy } = require('../lib/font');

// Tell fluent-ffmpeg where to find the binary on Heroku
// Most buildpacks install it to /usr/bin/ffmpeg
ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

module.exports = {
    name: 'voice',
    aliases: ['audiofx', 'robot', 'chipmunk', 'deep'],
    category: 'tools',
    description: 'Change the voice/audio of a replied voice note',
    async execute(conn, msg, args, ctx) {
        const { from, command } = ctx;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted || (!quoted.audioMessage && !quoted.ptvMessage)) {
            return conn.sendMessage(from, { 
                text: fancy('❌ Please reply to a voice note with this command.') 
            }, { quoted: msg });
        }

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

            const audioMsg = quoted.audioMessage || quoted.ptvMessage;
            const stream = await downloadContentFromMessage(audioMsg, 'audio');
            const chunks = [];
            for await (const chunk of stream) chunks.push(chunk);
            const audioBuffer = Buffer.concat(chunks);

            const inputPath = path.join(__dirname, `../temp_in_${Date.now()}.ogg`);
            const outputPath = path.join(__dirname, `../temp_out_${Date.now()}.ogg`);
            fs.writeFileSync(inputPath, audioBuffer);

            // Run FFmpeg with error logging
            await new Promise((resolve, reject) => {
                ffmpeg(inputPath)
                    .audioFilters(filter)
                    .toFormat('ogg')
                    .on('start', (cmd) => console.log('[FFmpeg] Started:', cmd))
                    .on('stderr', (stderr) => console.log('[FFmpeg] stderr:', stderr))
                    .on('end', resolve)
                    .on('error', (err) => {
                        console.error('[FFmpeg] Error:', err.message);
                        reject(err);
                    })
                    .save(outputPath);
            });

            const processedBuffer = fs.readFileSync(outputPath);

            await conn.sendMessage(from, { 
                audio: processedBuffer, 
                mimetype: 'audio/ogg; codecs=opus', 
                ptt: true 
            }, { quoted: msg });

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