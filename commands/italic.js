const { fancy } = require('../lib/font');
module.exports = { name:'italic', category:'text', aliases:['i'], description:'Wrap text in WhatsApp italic',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .italic hello')},{quoted:msg}); await conn.sendMessage(from,{text:`_${t}_`},{quoted:msg}); } };
