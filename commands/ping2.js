const { fancy } = require('../lib/font');
module.exports = { name:'ping2', category:'info', aliases:['latency'], description:'Low-level latency test',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t0=process.hrtime.bigint(); const sent=await conn.sendMessage(from,{text:fancy('⏱ ᴍᴇᴀꜱᴜʀɪɴɢ...')}); const t1=process.hrtime.bigint(); const ns=Number(t1-t0); const ms=(ns/1e6).toFixed(2); await conn.sendMessage(from,{text:`╭─〔 ⚡ ʟᴀᴛᴇɴᴄʏ 〕\n│\n│ 🔁 Round trip: ${ms} ms\n│ 📡 Nanos:      ${ns}\n│\n╰──────────────────────`,edit:sent.key}); } };
