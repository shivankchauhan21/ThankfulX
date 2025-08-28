"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authUtils_1 = require("../utils/authUtils");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = express_1.default.Router();
// Signup route
router.post('/signup', async (req, res, next) => {
    const { firstName, lastName, email, password } = req.body;
    // Validate input
    if (!firstName || !lastName || !email || !password) {
        res.status(400).json({ error: 'All fields are required' });
        return;
    }
    if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters long' });
        return;
    }
    try {
        // Check if user already exists
        const existingUser = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (existingUser) {
            res.status(400).json({ error: 'Email already registered' });
            return;
        }
        // Create new user
        const hashedPassword = await (0, authUtils_1.hashPassword)(password);
        const freeTrialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week from now
        const user = await prismaClient_1.default.user.create({
            data: {
                email,
                name: `${firstName} ${lastName}`,
                password: hashedPassword,
                freeTrialEndsAt,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                credits: true,
                createdAt: true,
                freeTrialEndsAt: true,
            },
        });
        // Generate token
        const token = (0, authUtils_1.signJwt)({ userId: user.id, role: user.role });
        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.status(201).json({
            status: 'success',
            message: 'Account created successfully',
            user,
            token,
        });
    }
    catch (error) {
        logger_1.logger.error('Signup error:', { error: error instanceof Error ? error.message : 'Unknown error' });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Failed to create account' });
    }
});
router.post('/login', async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
    }
    try {
        const user = await prismaClient_1.default.user.findUnique({ where: { email } });
        if (!user || !(await (0, authUtils_1.verifyPassword)(password, user.password))) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ error: 'User is inactive' });
            return;
        }
        // Update last login
        await prismaClient_1.default.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        const token = (0, authUtils_1.signJwt)({ userId: user.id, role: user.role });
        // Set cookie with updated settings
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        // Return user data (excluding sensitive information)
        res.json({
            status: 'success',
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                credits: user.credits,
                createdAt: user.createdAt,
                freeTrialEndsAt: user.freeTrialEndsAt,
            },
            token,
        });
    }
    catch (error) {
        logger_1.logger.error('Login error:', { error: error instanceof Error ? error.message : 'Unknown error' });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({ error: error.message });
            return;
        }
        res.status(500).json({ error: 'Login failed' });
    }
});
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.json({ message: 'Logged out' });
});
// Get current user route
router.get('/me', async (req, res, next) => {
    const token = req.cookies['token'];
    if (!token) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
    }
    try {
        const decoded = (0, authUtils_1.verifyJwt)(token);
        if (!decoded || typeof decoded === 'string') {
            res.status(401).json({ error: 'Invalid token' });
            return;
        }
        const { userId } = decoded;
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                credits: true,
                createdAt: true,
            },
        });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({
            status: 'success',
            user
        });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});
// Credit purchase endpoint (basic structure)
router.post('/purchase-credits', authMiddleware_1.authenticateToken, async (req, res, next) => {
    var _a;
    const { creditAmount, paymentMethod } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!creditAmount || creditAmount <= 0) {
        res.status(400).json({
            status: 'error',
            message: 'Invalid credit amount'
        });
        return;
    }
    try {
        // TODO: Implement actual payment processing
        // For now, just add credits to user account
        const user = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { credits: { increment: creditAmount } },
            select: { credits: true }
        });
        res.json({
            status: 'success',
            message: `Successfully purchased ${creditAmount} credits`,
            data: { newCreditBalance: user.credits }
        });
    }
    catch (error) {
        logger_1.logger.error('Credit purchase failed', { error, userId });
        res.status(500).json({
            status: 'error',
            message: 'Failed to process credit purchase'
        });
    }
});
exports.default = router;
