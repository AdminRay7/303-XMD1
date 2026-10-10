const { fancy } = require('../lib/font');
module.exports = { name:'wide', category:'text', aliases:['vapor2','wideText'], description:'Convert text to ｗｉｄｅ letters',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .wide hello')},{quoted:msg}); const out=t.split('').map(c=>{const n=c.charCodeAt(0);return n>=33&&n<=126?String.fromCharCode(n+0xFF00-0x20):c;}).join(''); await conn.sendMessage(from,{text:`╭─〔 🅦 ᴡɪᴅᴇ 〕\n│\n│ ${out}\n│\n╰──────────────────────`},{quoted:msg}); } };
