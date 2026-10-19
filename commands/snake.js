// commands/snake.js
// Real Image-Based Snake Game
// Usage: .snake

const { createCanvas } = require('@napi-rs/canvas');
const { fancy } = require('../lib/font');

// Store active games
const games = new Map();

const GRID_SIZE = 15; // 15x15 grid
const TILE_SIZE = 30; // 30px per tile (450x450 image)

function drawBoard(snake, food) {
    const canvas = createCanvas(GRID_SIZE * TILE_SIZE, GRID_SIZE * TILE_SIZE);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Food
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(food.x * TILE_SIZE, food.y * TILE_SIZE, TILE_SIZE - 2, TILE_SIZE - 2);

    // Draw Snake
    snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#2ed573' : '#7bed9f'; // Head is brighter
        ctx.fillRect(segment.x * TILE_SIZE, segment.y * TILE_SIZE, TILE_SIZE - 2, TILE_SIZE - 2);
    });

    return canvas.toBuffer('image/png');
}

module.exports = {
    name: 'snake',
    category: 'games',
    aliases: ['snakegame'],
    description: 'Play Snake with buttons',
    async execute(conn, msg, args, ctx) {
        const { from, sender } = ctx;

        // Init Game State
        const gameState = {
            snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
            dir: { x: 1, y: 0 }, // moving right initially
            food: { x: 8, y: 8 },
            score: 0,
            active: true
        };
        
        games.set(sender, gameState);

        const buffer = drawBoard(gameState.snake, gameState.food);

        // Send Game with Buttons (Using standard Baileys button payload)
        const buttons = [
            { buttonId: 'up', buttonText: { displayText: '⬆️ Up' }, type: 1 },
            { buttonId: 'down', buttonText: { displayText: '⬇️ Down' }, type: 1 },
            { buttonId: 'left', buttonText: { displayText: '⬅️ Left' }, type: 1 },
            { buttonId: 'right', buttonText: { displayText: '➡️ Right' }, type: 1 }
        ];

        const msgContent = {
            image: buffer,
            caption: fancy('🐍 *SNAKE GAME*\nScore: 0\nUse buttons to move!'),
            footer: 'Wait for your turn',
            buttons: buttons.slice(0, 3), // WhatsApp standard limits to 3
            headerType: 4 // Image header
        };

        await conn.sendMessage(from, msgContent, { quoted: msg });
    }
};