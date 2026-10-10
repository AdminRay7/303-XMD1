const { fancy } = require('../lib/font');
module.exports = { name:'quote', category:'text', aliases:['qc','qtext'], description:'Format text as a quoted block',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .quote hello')},{quoted:msg}); await conn.sendMessage(from,{text:`> ${t}\n> — 303-XMD`},{quoted:msg}); } };
