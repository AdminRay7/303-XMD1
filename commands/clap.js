const { fancy } = require('../lib/font');
module.exports = { name:'clap', category:'text', aliases:['claptext'], description:'Insert 👏 between every word',
async execute(conn,msg,args,ctx){ const {from}=ctx; const t=args.join(' ').trim(); if(!t) return conn.sendMessage(from,{text:fancy('❌ Usage: .clap hello world')},{quoted:msg}); const out=t.split(/\s+/).join(' 👏 '); await conn.sendMessage(from,{text:out},{quoted:msg}); } };
