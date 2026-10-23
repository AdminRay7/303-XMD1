// commands/news.js
const axios = require('axios');
const { fancy } = require('../lib/font');

module.exports = {
    name: 'news',
    aliases: ['headlines', 'habari'],
    category: 'general',
    description: 'Get the latest news from Kenya and around the world',
    async execute(conn, msg, args, ctx) {
        const { from } = ctx;
        const query = args.join(' ').trim();

        const apiKey = process.env.NEWS_API_KEY;
        if (!apiKey) {
            return conn.sendMessage(from, { 
                text: fancy('❌ NEWS_API_KEY is missing in the .env file.') 
            }, { quoted: msg });
        }

        try {
            // Base URL for NewsData.io
            // We default to country=ke (Kenya) for local news
            let url = `https://newsdata.io/api/1/latest?apikey=${apiKey}`;
            
            if (query) {
                // If a user searches, use the 'q' parameter
                url += `&q=${encodeURIComponent(query)}`;
            } else {
                // Otherwise, show latest Kenyan news
                url += '&country=ke';
            }

            // Fetch 5 articles
            url += '&size=5';

            const { data } = await axios.get(url, { timeout: 15000 });

            if (data.status !== "success" || !data.results || data.results.length === 0) {
                return conn.sendMessage(from, { 
                    text: fancy('❌ No news found for your search.') 
                }, { quoted: msg });
            }

            let text = `📰 *Latest News${query ? `: ${query}` : ' (Kenya)'}*\n\n`;

            data.results.forEach((article, i) => {
                const title = article.title ? article.title.trim() : 'No Title';
                const desc = article.description ? article.description.substring(0, 100) + '...' : 'No description.';
                const link = article.link;
                const source = article.source_id ? article.source_id.toUpperCase() : 'NEWS';
                
                text += `*${i + 1}. ${title}*\n`;
                text += `_${source}_\n`;
                text += `${desc}\n`;
                text += `🔗 ${link}\n\n`;
            });

            text += `_Note: Free tier news may be delayed by 12 hours._`;

            await conn.sendMessage(from, { text }, { quoted: msg });

        } catch (error) {
            console.error('[news command] Error:', error.response?.data || error.message);
            
            if (error.response?.data?.message) {
                return conn.sendMessage(from, { 
                    text: fancy(`❌ API Error: ${error.response.data.message}`) 
                }, { quoted: msg });
            }
            
            await conn.sendMessage(from, { 
                text: fancy('❌ Failed to fetch news. Please try again later.') 
            }, { quoted: msg });
        }
    }
};