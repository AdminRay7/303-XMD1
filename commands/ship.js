const { fancy } = require('../lib/font');
function loveScore(a,b){ let h=0; const s=(a+b).toLowerCase(); for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0; return h%101; }
module.exports = { name:'ship', category:'fun', aliases:['love'], description:'Calculate love compatibility between two names',
async execute(conn,msg,args,ctx){ const {from}=ctx; const [a,b]=[args[0],args[1]]; if(!a||!b) return conn.sendMessage(from,{text:fancy('❌ Usage: .ship Alice Bob')},{quoted:msg}); const pct=loveScore(a,b); const bar='█'.repeat(Math.round(pct/10))+'░'.repeat(10-Math.round(pct/10)); await conn.sendMessage(from,{text:`╭─〔 💘 ꜱʜɪᴘ 〕\n│\n│ 👫 ${a} + ${b}\n│\n│ ${bar} ${pct}%\n│\n╰──────────────────────`},{quoted:msg}); } };
