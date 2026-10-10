const { fancy } = require('../lib/font');
module.exports = { name:'wordcount', category:'misc', aliases:['wc'], description:'Count words in text',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .wordcount hello world')},{quoted:msg}); const words=t.split(/\s+/).filter(Boolean).length; await conn.sendMessage(from,{text:`╭─〔 📝 ᴡᴏʀᴅ ᴄᴏᴜɴᴛ 〕\n│\n│ 📄 Words: ${words}\n│\n╰──────────────────────`},{quoted:msg}); } };
