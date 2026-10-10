const { fancy } = require('../lib/font');
module.exports = { name:'timestamp', category:'tools', aliases:['now'], description:'Show current Unix timestamp',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=Math.floor(Date.now()/1000); const ms=Date.now(); await conn.sendMessage(from,{text:`╭─〔 ⏱ ᴛɪᴍᴇꜱᴛᴀᴍᴘ 〕\n│\n│ 📅 Seconds: ${t}\n│ 🔢 Millis:  ${ms}\n│\n╰──────────────────────`},{quoted:msg}); } };
