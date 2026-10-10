const { fancy } = require('../lib/font');
module.exports = { name:'quoteimg', category:'misc', aliases:['qcimg'], description:'Make a quote-card image (via api.qrserver style — placeholder)',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .quoteimg some text')},{quoted:msg}); const url=`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(t)}`; await conn.sendMessage(from,{image:{url},caption:`╭─〔 🖼 ǫᴜᴏᴛᴇ ᴄᴀʀᴅ 〕\n│ ${t}\n╰──────────────────────`},{quoted:msg}); } };
