const { fancy } = require('../lib/font');
module.exports = {
    name: 'bubble',
    category: 'text',
    aliases: ['bubbles', 'circled'],
    description: 'Convert text to ⓑⓤⓑⓑⓛⓔ letters',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const text = args.join(' ').trim();
        if (!text) return conn.sendMessage(from, { text: fancy('❌ Usage: .bubble hello') }, { quoted: msg });
        const map = {
            a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',
            n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',
            A:'Ⓐ',B:'Ⓑ',C:'Ⓒ',D:'Ⓓ',E:'Ⓔ',F:'Ⓕ',G:'Ⓖ',H:'Ⓗ',I:'Ⓘ',J:'Ⓙ',K:'Ⓚ',L:'Ⓛ',M:'Ⓜ',
            N:'Ⓝ',O:'Ⓞ',P:'Ⓟ',Q:'Ⓠ',R:'Ⓡ',S:'Ⓢ',T:'Ⓣ',U:'Ⓤ',V:'Ⓥ',W:'Ⓦ',X:'Ⓧ',Y:'Ⓨ',Z:'Ⓩ',
            '0':'⓪','1':'①','2':'②','3':'③','4':'④','5':'⑤','6':'⑥','7':'⑦','8':'⑧','9':'⑨'
        };
        const out = text.split('').map(c => map[c] || c).join('');
        await conn.sendMessage(from, {
            text: `╭─〔 ⓑ ᴛᴇxᴛ 〕\n│\n│ ${out}\n│\n╰──────────────────────`
        }, { quoted: msg });
    }
};
