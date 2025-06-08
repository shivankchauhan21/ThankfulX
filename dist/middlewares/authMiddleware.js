"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
const authUtils_1 = require("../utils/authUtils");
function authenticateToken(req, res, next) {
    const token = req.cookies['token'];
    if (!token)
        return res.status(401).json({ error: 'Authentication token missing' });
    const decoded = (0, authUtils_1.verifyJwt)(token);
    if (!decoded || typeof decoded === 'string')
        return res.status(401).json({ error: 'Invalid or expired token' });
    // Map the decoded token to AuthUser type
    const { userId, role } = decoded;
    req.user = { id: userId, role };
    next();
}
