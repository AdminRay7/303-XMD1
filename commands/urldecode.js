const { fancy } = require('../lib/font');
module.exports = { name:'urldecode', category:'tools', aliases:['urldec'], description:'URL-decode text',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .urldecode hello%20world')},{quoted:msg}); let out; try{ out=decodeURIComponent(t);}catch{ out=t; } await conn.sendMessage(from,{text:`╭─〔 🔗 ᴜʀʟ ᴅᴇᴄᴏᴅᴇ 〕\n│\n│ ${out}\n│\n╰──────────────────────`},{quoted:msg}); } };
