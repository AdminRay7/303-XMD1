const { fancy } = require('../lib/font');
module.exports = { name:'age', category:'fun', aliases:['ageguess'], description:'Guess the age of a name (fun)',
async execute(conn,msg,args,ctx){ const {from}=ctx; const name=args.join(' ').trim()||ctx.pushname; let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))>>>0; const a=(h%60)+12; await conn.sendMessage(from,{text:`╭─〔 🎂 ᴀɢᴇ 〕\n│\n│ 👤 ${name}\n│ 🎯 ${a} years old\n│\n╰──────────────────────`},{quoted:msg}); } };
