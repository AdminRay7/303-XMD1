const os=require('os');
const { fancy } = require('../lib/font');
module.exports = { name:'cpuinfo', category:'info', aliases:['cpu'], description:'Show CPU information',
async execute(conn,msg,args,ctx){ const {from}=ctx; const c=os.cpus()||[]; const model=c[0]?.model||'unknown'; const speed=c[0]?.speed||0; const load=os.loadavg().map(x=>x.toFixed(2)).join(', '); await conn.sendMessage(from,{text:`╭─〔 💻 ᴄᴘᴜ 〕\n│\n│ 🏷 Model: ${model}\n│ ⚡ Speed: ${speed} MHz\n│ 🔢 Cores: ${c.length}\n│ 📊 Load:  ${load}\n│\n╰──────────────────────`},{quoted:msg}); } };
