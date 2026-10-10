const { fancy } = require('../lib/font');
module.exports = { name:'charcount', category:'misc', aliases:['cc'], description:'Count characters in text',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' '); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .charcount hello')},{quoted:msg}); const chars=t.length; const noSpace=t.replace(/\s/g,'').length; await conn.sendMessage(from,{text:`╭─〔 🔢 ᴄʜᴀʀ ᴄᴏᴜɴᴛ 〕\n│\n│ 🅰 Total:     ${chars}\n│ 🅱 No spaces: ${noSpace}\n│\n╰──────────────────────`},{quoted:msg}); } };
