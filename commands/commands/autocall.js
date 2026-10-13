module.exports = {
    name: 'anticall',
    category: 'auto',
    tags: ['security'],
    description: 'Reject incoming calls',
    enabled: (cfg) => cfg.anticall === true,
    async onCall(conn, calls) {
        for (const call of calls) {
            if (call.status === 'offer') {
                try { await conn.rejectCall(call.id, call.from); } catch {}
            }
        }
    }
};
