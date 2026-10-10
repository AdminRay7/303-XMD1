const { fancy } = require('../lib/font');
module.exports = { name:'strike', category:'text', aliases:['strikethrough'], description:'Wrap text in WhatsApp strikethrough',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .strike hello')},{quoted:msg}); await conn.sendMessage(from,{text:`~${t}~`},{quoted:msg}); } };
