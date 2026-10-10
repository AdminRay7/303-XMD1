const { fancy } = require('../lib/font');
module.exports = { name:'cron', category:'tools', aliases:['cronhelp'], description:'Common cron schedule examples',
async execute(conn,msg,args,ctx){ const {from}=ctx; const text=`╭─〔 ⏰ ᴄʀᴏɴ ʜᴇʟᴘ 〕\n│\n│ * * * * *   every minute\n│ 0 * * * *   hourly\n│ 0 0 * * *   daily @ midnight\n│ 0 9 * * *   daily @ 9am\n│ 0 0 * * 0   weekly Sunday\n│ 0 0 1 * *   monthly 1st\n│ */5 * * * * every 5 min\n│ 0 */6 * * * every 6 hours\n│\n╰──────────────────────`; await conn.sendMessage(from,{text},{quoted:msg}); } };
