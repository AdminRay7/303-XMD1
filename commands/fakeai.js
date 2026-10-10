const { fancy } = require('../lib/font');
const RESP=["Interesting question. Let me think... 🤔","Based on my analysis, the answer is 42.","That's a great point! Here's my take:","Hmm, I'm not sure, but I'd say yes.","Absolutely! 100% correct.","Not quite — but close.","Let me Google that for you... jk.","I'd need more coffee for that one. ☕"];
module.exports = { name:'fakeai', category:'misc', aliases:['fai','botreply'], description:'Fake AI response (offline)',
async execute(conn,msg,args,ctx){ const {from}=ctx; const r=RESP[Math.floor(Math.random()*RESP.length)]; await conn.sendMessage(from,{text:`╭─〔 🤖 ꜰᴀᴋᴇ ᴀɪ 〕\n│\n│ ${r}\n│\n╰──────────────────────`},{quoted:msg}); } };
