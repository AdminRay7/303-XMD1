const os=require('os');
const { fancy } = require('../lib/font');
function fmt(b){ return (b/1024/1024).toFixed(0)+' MB'; }
module.exports = { name:'meminfo', category:'info', aliases:['mem','ram'], description:'Show memory usage',
async execute(conn,msg,args,ctx){ const {from}=ctx; const total=os.totalmem(); const free=os.freemem(); const used=total-free; const pct=((used/total)*100).toFixed(1); const m=process.memoryUsage(); await conn.sendMessage(from,{text:`╭─〔 💾 ᴍᴇᴍᴏʀʏ 〕\n│\n│ 💾 Total: ${fmt(total)}\n│ 🆓 Free:  ${fmt(free)}\n│ 🔴 Used:  ${fmt(used)} (${pct}%)\n│\n│ 📦 Process RSS:  ${fmt(m.rss)}\n│ 📦 Heap Used:    ${fmt(m.heapUsed)}\n│ 📦 Heap Total:   ${fmt(m.heapTotal)}\n│\n╰──────────────────────`},{quoted:msg}); } };
