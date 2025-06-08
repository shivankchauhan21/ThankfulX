"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const authUtils_1 = require("../utils/authUtils");
const router = express_1.default.Router();
// Signup route
router.post('/signup', async (req, res) => {
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
        const user = await prismaClient_1.default.user.create({
            data: {
                email,
                name: `${firstName} ${lastName}`,
                password: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                credits: true,
                createdAt: true,
            },
        });
        // Generate token
        const token = (0, authUtils_1.signJwt)({ userId: user.id, role: user.role });
        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-origin requests
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        res.status(201).json({
            message: 'Account created successfully',
            user,
        });
    }
    catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});
router.post('/login', async (req, res) => {
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
            sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-origin requests
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        // Return user data (excluding sensitive information)
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                credits: user.credits,
                createdAt: user.createdAt,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
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
router.get('/me', async (req, res) => {
    const token = req.cookies['token'];
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    try {
        const decoded = (0, authUtils_1.verifyJwt)(token);
        if (!decoded || typeof decoded === 'string') {
            return res.status(401).json({ error: 'Invalid token' });
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
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    }
    catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to get user data' });
    }
});
exports.default = router;
