const { fancy } = require('../lib/font');
module.exports = { name:'json', category:'tools', aliases:['formatjson','pretty'], description:'Pretty-print a JSON string',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .json {"a":1,"b":2}')},{quoted:msg}); try{ const obj=JSON.parse(t); const out=JSON.stringify(obj,null,2); await conn.sendMessage(from,{text:`\`\`\`${out}\`\`\``},{quoted:msg}); }catch(e){ await conn.sendMessage(from,{text:fancy('❌ Invalid JSON: '+e.message)},{quoted:msg}); } } };
