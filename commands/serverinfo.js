const os=require('os');
const { fancy } = require('../lib/font');
module.exports = { name:'serverinfo', category:'info', aliases:['svinfo'], description:'Show server information',
async execute(conn,msg,args,ctx){ const {from}=ctx; const up=os.uptime(); const d=Math.floor(up/86400),h=Math.floor((up%86400)/3600),m=Math.floor((up%3600)/60); await conn.sendMessage(from,{text:`╭─〔 🖥 ꜱᴇʀᴠᴇʀ 〕\n│\n│ 🏷 Host:   ${os.hostname()}\n│ 🐧 OS:     ${os.type()} ${os.release()}\n│ 🏗 Arch:   ${os.arch()}\n│ ⏱ Uptime: ${d}d ${h}h ${m}m\n│\n╰──────────────────────`},{quoted:msg}); } };
