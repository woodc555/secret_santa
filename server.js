require('./load-env');

const path = require('path');
const express = require('express');
const { pool, initDb } = require('./db');
const { createToken, verifyToken } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));

function publicUser(row) {
    return {
        id: row.id,
        name: row.name,
        matched: row.matched,
        family_group: row.family_group,
        is_admin: row.is_admin,
        opt_out: row.opt_out,
        wishlist: row.wishlist,
    };
}

function receiverView(row) {
    return {
        id: row.id,
        name: row.name,
        wishlist: row.wishlist,
    };
}

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function wrap(handler) {
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const payload = verifyToken(token);
    if (!payload) {
        return next(new HttpError(401, 'Please log in again.'));
    }
    req.userId = payload.id;
    next();
}

async function loadUser(req, res, next) {
    const { rows } = await pool.query('SELECT * FROM participants WHERE id = $1', [req.userId]);
    if (!rows[0]) {
        return next(new HttpError(401, 'Please log in again.'));
    }
    req.user = rows[0];
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user.is_admin) {
        return next(new HttpError(403, 'Admin access required.'));
    }
    next();
}

async function getAssignment(userId) {
    const { rows: pairingRows } = await pool.query(
        'SELECT receiver_id FROM pairings WHERE giver_id = $1',
        [userId]
    );
    if (!pairingRows[0]) {
        return { matched: false, receiver: null };
    }

    const { rows: receiverRows } = await pool.query(
        'SELECT id, name, wishlist FROM participants WHERE id = $1',
        [pairingRows[0].receiver_id]
    );
    return {
        matched: true,
        receiver: receiverRows[0] ? receiverView(receiverRows[0]) : null,
    };
}

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

app.post('/api/login', wrap(async (req, res) => {
    const pin = String(req.body.pin || '').trim();
    if (!pin) {
        throw new HttpError(400, 'Please Enter a Pin');
    }
    if (pin.length !== 4) {
        throw new HttpError(400, 'Pin must be 4 digits');
    }

    const { rows } = await pool.query('SELECT * FROM participants WHERE pin = $1', [pin]);
    if (!rows[0]) {
        throw new HttpError(401, 'Invalid Pin or Non-Existent Pin');
    }

    res.json({
        token: createToken(rows[0].id),
        user: publicUser(rows[0]),
    });
}));

app.get('/api/me', requireAuth, wrap(loadUser), wrap(async (req, res) => {
    res.json({ user: publicUser(req.user) });
}));

app.get('/api/assignment', requireAuth, wrap(loadUser), wrap(async (req, res) => {
    res.json(await getAssignment(req.user.id));
}));

app.put('/api/wishlist', requireAuth, wrap(loadUser), wrap(async (req, res) => {
    const wishlist = Array.isArray(req.body.wishlist) ? req.body.wishlist : [];
    const cleaned = wishlist.map((item) => ({
        name: String(item?.name || '').trim(),
        link: String(item?.link || '').trim(),
    }));

    const { rows } = await pool.query(
        'UPDATE participants SET wishlist = $1::jsonb WHERE id = $2 RETURNING *',
        [JSON.stringify(cleaned), req.user.id]
    );

    res.json({ user: publicUser(rows[0]) });
}));

app.post('/api/match', requireAuth, wrap(loadUser), wrap(async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: giverRows } = await client.query(
            'SELECT * FROM participants WHERE id = $1 FOR UPDATE',
            [req.user.id]
        );
        const giver = giverRows[0];
        if (!giver) {
            throw new HttpError(401, 'Please log in again.');
        }
        if (giver.opt_out) {
            throw new HttpError(400, 'This account has opted out of matching.');
        }

        const existing = await getAssignment(giver.id);
        if (existing.matched) {
            await client.query('COMMIT');
            return res.json(existing);
        }

        const { rows: takenRows } = await client.query(
            'SELECT receiver_id FROM pairings FOR UPDATE'
        );
        const takenIds = takenRows.map((row) => row.receiver_id);

        const { rows: eligible } = await client.query(
            `SELECT id, name, wishlist
             FROM participants
             WHERE id <> $1
               AND family_group IS DISTINCT FROM $2
               AND NOT (id = ANY($3::int[]))
               AND COALESCE(opt_out, false) = false`,
            [giver.id, giver.family_group, takenIds]
        );

        if (eligible.length === 0) {
            throw new HttpError(400, 'No eligible participants found. Please try again later.');
        }

        const matchedParticipant = eligible[Math.floor(Math.random() * eligible.length)];

        await client.query(
            'INSERT INTO pairings (giver_id, receiver_id) VALUES ($1, $2)',
            [giver.id, matchedParticipant.id]
        );
        await client.query(
            'UPDATE participants SET matched = true WHERE id = $1',
            [giver.id]
        );

        await client.query('COMMIT');
        res.json({
            matched: true,
            receiver: receiverView(matchedParticipant),
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

app.get('/api/admin/participants', requireAuth, wrap(loadUser), requireAdmin, wrap(async (req, res) => {
    const { rows: participants } = await pool.query(
        `SELECT id, name, matched, family_group, is_admin, opt_out, wishlist
         FROM participants
         ORDER BY id`
    );
    const { rows: pairings } = await pool.query(
        'SELECT id, giver_id, receiver_id FROM pairings ORDER BY id'
    );
    res.json({ participants, pairings });
}));

app.put('/api/admin/participants/:id', requireAuth, wrap(loadUser), requireAdmin, wrap(async (req, res) => {
    const participantId = Number(req.params.id);
    if (!Number.isInteger(participantId)) {
        throw new HttpError(400, 'Invalid participant.');
    }

    const name = String(req.body.name || '').trim();
    const familyGroup = String(req.body.family_group || '').trim();
    const isAdmin = Boolean(req.body.is_admin);
    const matched = Boolean(req.body.matched);
    const givingToId = req.body.receiver_id === '' || req.body.receiver_id == null
        ? null
        : Number(req.body.receiver_id);

    if (!name) {
        throw new HttpError(400, 'Name is required.');
    }
    if (givingToId !== null && !Number.isInteger(givingToId)) {
        throw new HttpError(400, 'Invalid match selection.');
    }
    if (givingToId === participantId) {
        throw new HttpError(400, 'A participant cannot be matched to themselves.');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: updatedRows } = await client.query(
            `UPDATE participants
             SET name = $1, family_group = $2, is_admin = $3, matched = $4
             WHERE id = $5
             RETURNING id, name, matched, family_group, is_admin, opt_out, wishlist`,
            [name, familyGroup, isAdmin, matched, participantId]
        );
        if (!updatedRows[0]) {
            throw new HttpError(404, 'Participant not found.');
        }

        const { rows: existingPairings } = await client.query(
            'SELECT * FROM pairings WHERE giver_id = $1',
            [participantId]
        );
        const existingPairing = existingPairings[0] || null;

        if (givingToId) {
            const { rows: receiverRows } = await client.query(
                'SELECT id FROM participants WHERE id = $1',
                [givingToId]
            );
            if (!receiverRows[0]) {
                throw new HttpError(400, 'Selected match was not found.');
            }

            if (existingPairing) {
                await client.query(
                    'UPDATE pairings SET receiver_id = $1 WHERE id = $2',
                    [givingToId, existingPairing.id]
                );
            } else {
                await client.query(
                    'INSERT INTO pairings (giver_id, receiver_id) VALUES ($1, $2)',
                    [participantId, givingToId]
                );
            }
        } else if (existingPairing) {
            await client.query('DELETE FROM pairings WHERE giver_id = $1', [participantId]);
        }

        await client.query('COMMIT');
        res.json({ participant: updatedRows[0] });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

app.post('/api/admin/reset-pairings', requireAuth, wrap(loadUser), requireAdmin, wrap(async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const deleted = await client.query('DELETE FROM pairings');
        await client.query('UPDATE participants SET matched = false');
        await client.query('COMMIT');
        res.json({ reset: true, pairingsDeleted: deleted.rowCount });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

app.use('/style', express.static(path.join(__dirname, 'style')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/api.js', (req, res) => res.sendFile(path.join(__dirname, 'api.js')));
app.get('/secret_santa.js', (req, res) => res.sendFile(path.join(__dirname, 'secret_santa.js')));
app.get('/admin.js', (req, res) => res.sendFile(path.join(__dirname, 'admin.js')));

app.use((req, res) => {
    res.status(404).json({ error: 'Not found.' });
});

app.use((error, req, res, next) => {
    const status = error.status || 500;
    if (status >= 500) {
        console.error(error);
    }
    res.status(status).json({
        error: status >= 500 ? 'Something went wrong. Please try again.' : error.message,
    });
});

initDb()
    .then(() => {
        if (!process.env.SESSION_SECRET) {
            console.warn('SESSION_SECRET is not set. Logins will reset whenever the app restarts.');
        }
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Secret Santa listening on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Failed to start:', error);
        process.exit(1);
    });
