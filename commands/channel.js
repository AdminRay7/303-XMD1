const { fancy } = require('../lib/font');
const config = require('../config');
module.exports = { name:'channel', category:'misc', aliases:['newsletter'], description:'Show bot newsletter info',
async execute(conn,msg,args,ctx){ const {from}=ctx; await conn.sendMessage(from,{text:`╭─〔 📰 ɴᴇᴡꜱʟᴇᴛᴛᴇʀ 〕\n│\n│ 🔗 ${config.channelLink||'—'}\n│ 📛 ${config.newsletterJid||'—'}\n│\n╰──────────────────────`},{quoted:msg}); } };
