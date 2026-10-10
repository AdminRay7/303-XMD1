const { fancy } = require('../lib/font');
const L = ["You light up every room you walk into.","You have a smile that could end wars.","You're smarter than you give yourself credit for.","The world is better because you're in it.","Your kindness is unmatched.","You make everything look easy.","You're the human equivalent of a warm hug.","You have a heart of gold.","You're the reason someone believes in good people.","You're doing better than you think."];
module.exports = { name:'compliment', category:'fun', aliases:['praise'], description:'Send a compliment',
async execute(conn,msg,args,ctx){ const {from}=ctx; const r=L[Math.floor(Math.random()*L.length)]; await conn.sendMessage(from,{text:`╭─〔 💚 ᴄᴏᴍᴘʟɪᴍᴇɴᴛ 〕\n│\n│ ${r}\n│\n╰──────────────────────`},{quoted:msg}); } };
