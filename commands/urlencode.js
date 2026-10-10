const { fancy } = require('../lib/font');
module.exports = { name:'urlencode', category:'tools', aliases:['urlenc'], description:'URL-encode text',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .urlencode hello world')},{quoted:msg}); await conn.sendMessage(from,{text:`╭─〔 🔗 ᴜʀʟ ᴇɴᴄᴏᴅᴇ 〕\n│\n│ ${encodeURIComponent(t)}\n│\n╰──────────────────────`},{quoted:msg}); } };
