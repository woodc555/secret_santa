const crypto = require('crypto');

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function createToken(userId) {
    const payload = Buffer.from(JSON.stringify({
        id: userId,
        exp: Date.now() + TOKEN_TTL_MS,
    })).toString('base64url');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return null;
    }

    const [payload, signature] = token.split('.');
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');

    const expectedBuffer = Buffer.from(expected);
    const signatureBuffer = Buffer.from(signature);
    if (expectedBuffer.length !== signatureBuffer.length) {
        return null;
    }
    if (!crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
        return null;
    }

    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (!data.id || data.exp < Date.now()) {
            return null;
        }
        return data;
    } catch (error) {
        return null;
    }
}

module.exports = { createToken, verifyToken };
