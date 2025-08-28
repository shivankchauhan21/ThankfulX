"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = void 0;
const authUtils_1 = require("../utils/authUtils");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const authenticateToken = (req, res, next) => {
    try {
        const token = req.cookies['token'];
        if (!token) {
            throw new errors_1.AuthenticationError('Authentication token missing');
        }
        const decoded = (0, authUtils_1.verifyJwt)(token);
        if (!decoded || typeof decoded === 'string') {
            throw new errors_1.AuthenticationError('Invalid or expired token');
        }
        // Map the decoded token to AuthUser type
        const { userId, role } = decoded;
        req.user = { id: userId, role };
        logger_1.logger.debug('User authenticated', { userId, role });
        next();
    }
    catch (error) {
        logger_1.logger.warn('Authentication failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({
                status: 'error',
                code: error.code,
                message: error.message
            });
            return;
        }
        res.status(401).json({
            status: 'error',
            code: 'AUTHENTICATION_ERROR',
            message: 'Authentication failed'
        });
    }
};
exports.authenticateToken = authenticateToken;
