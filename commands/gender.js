const { fancy } = require('../lib/font');
const L=['Male 👦','Female 👧','Non-binary 🧑','Unknown ❓','Fluid 🌀','Alien 👽'];
module.exports = { name:'gender', category:'fun', aliases:['detect'], description:'Guess the gender of a name (fun)',
async execute(conn,msg,args,ctx){ const {from}=ctx; const name=args.join(' ').trim()||ctx.pushname; let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))>>>0; const g=L[h%L.length]; await conn.sendMessage(from,{text:`╭─〔 🎭 ɢᴇɴᴅᴇʀ 〕\n│\n│ 👤 ${name}\n│ 🎯 ${g}\n│\n╰──────────────────────`},{quoted:msg}); } };
