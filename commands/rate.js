const { fancy } = require('../lib/font');
function rate(s){ let h=0; for(let i=0;i<s.length;i++) h=(h*33+s.charCodeAt(i))>>>0; return (h%10)+1; }
module.exports = { name:'rate', category:'fun', aliases:['score'], description:'Rate something from 1-10',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .rate pizza')},{quoted:msg}); const n=rate(t); const star='⭐'.repeat(n)+'☆'.repeat(10-n); await conn.sendMessage(from,{text:`╭─〔 ⭐ ʀᴀᴛᴇ 〕\n│\n│ 📝 ${t}\n│ ${star}\n│ Score: ${n}/10\n│\n╰──────────────────────`},{quoted:msg}); } };
