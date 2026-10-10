const { fancy } = require('../lib/font');
module.exports = { name:'mono', category:'text', aliases:['monospace','code'], description:'Wrap text in WhatsApp monospace',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .mono hello')},{quoted:msg}); await conn.sendMessage(from,{text:'```'+t+'```'},{quoted:msg}); } };
