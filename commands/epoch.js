const { fancy } = require('../lib/font');
module.exports = { name:'epoch', category:'tools', aliases:['fromepoch','tounix'], description:'Convert epoch seconds to a readable date',
async execute(conn,msg,args,ctx){ const {from}=ctx; const n=parseInt(args[0]); if(!n) return conn.sendMessage(from,{text:fancy('❌ Usage: .epoch 1700000000')},{quoted:msg}); const d=new Date(n*1000); await conn.sendMessage(from,{text:`╭─〔 🕐 ᴇᴘᴏᴄʜ 〕\n│\n│ 🔢 ${n}\n│ 📅 ${d.toUTCString()}\n│ 📅 ${d.toLocaleString()}\n│\n╰──────────────────────`},{quoted:msg}); } };
