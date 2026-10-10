const { fancy } = require('../lib/font');
module.exports = { name:'bold', category:'text', aliases:['b'], description:'Wrap text in WhatsApp bold',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .bold hello')},{quoted:msg}); await conn.sendMessage(from,{text:`*${t}*`},{quoted:msg}); } };
