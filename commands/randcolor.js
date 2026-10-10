const { fancy } = require('../lib/font');
module.exports = { name:'randcolor', category:'tools', aliases:['randomcolor','rc'], description:'Generate a random color',
async execute(conn,msg,args,ctx){ const {from}=ctx; const hex=Math.floor(Math.random()*0xffffff).toString(16).padStart(6,'0'); const r=parseInt(hex.slice(0,2),16),g=parseInt(hex.slice(2,4),16),b=parseInt(hex.slice(4,6),16); await conn.sendMessage(from,{text:`╭─〔 🎨 ʀᴀɴᴅ ᴄᴏʟᴏʀ 〕\n│\n│ HEX: #${hex.toUpperCase()}\n│ RGB: rgb(${r}, ${g}, ${b})\n│\n╰──────────────────────`},{quoted:msg}); } };
