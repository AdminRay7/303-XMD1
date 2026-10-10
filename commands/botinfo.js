const { fancy } = require('../lib/font');
const config = require('../config');
module.exports = { name:'botinfo', category:'info', aliases:['about'], description:'Show bot information',
async execute(conn,msg,args,ctx){ const {from}=ctx; await conn.sendMessage(from,{text:`╭─〔 🤖 ʙᴏᴛ ɪɴꜰᴏ 〕\n│\n│ 📛 Name:  ${config.botName}\n│ 📌 Ver:   ${config.version}\n│ 👤 Owner: ${config.ownerName}\n│ 📞 Phone: +${config.ownerNumber}\n│ 🎯 Prefix:${config.prefix}\n│\n╰──────────────────────`},{quoted:msg}); } };
