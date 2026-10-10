const os=require('os');
const { fancy } = require('../lib/font');
module.exports = { name:'osinfo', category:'info', aliases:['os'], description:'Show OS information',
async execute(conn,msg,args,ctx){ const {from}=ctx; await conn.sendMessage(from,{text:`╭─〔 🐧 ᴏꜱ 〕\n│\n│ 📛 Type:   ${os.type()}\n│ 📌 Release:${os.release()}\n│ 🏗 Platform:${os.platform()}\n│ 🏗 Arch:   ${os.arch()}\n│ 🖥 Endian: ${os.endianness()}\n│\n╰──────────────────────`},{quoted:msg}); } };
