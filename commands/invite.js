const { fancy } = require('../lib/font');
const config = require('../config');
module.exports = { name:'invite', category:'misc', aliases:['channel2'], description:'Get the bot WhatsApp channel link',
async execute(conn,msg,args,ctx){ const {from}=ctx; const link=config.channelLink||'not configured'; await conn.sendMessage(from,{text:`╭─〔 📢 ᴄʜᴀɴɴᴇʟ 〕\n│\n│ ${link}\n│\n╰──────────────────────`},{quoted:msg}); } };
