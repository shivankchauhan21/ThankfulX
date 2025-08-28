"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const message_service_1 = require("../services/message.service");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const validationMiddleware_1 = require("../middlewares/validationMiddleware");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const errors_1 = require("../utils/errors");
const creditCalculator_1 = require("../utils/creditCalculator");
const logger_1 = require("../utils/logger");
const router = express_1.default.Router();
const generateMessagesHandler = async (req, res, next) => {
    var _a;
    const { customers, options, organizationId } = req.body;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        logger_1.logger.warn('Unauthorized message generation attempt', { userId: 'unknown' });
        res.status(401).json({
            status: 'error',
            message: 'User not authenticated'
        });
        return;
    }
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
        logger_1.logger.warn('Invalid customer data in request', { userId, customerCount: 0 });
        res.status(400).json({
            status: 'error',
            message: 'Customer data is required and must be a non-empty array'
        });
        return;
    }
    try {
        logger_1.logger.info('Message generation request received', {
            userId,
            customerCount: customers.length,
            organizationId,
            options: {
                style: options.style,
                length: options.length,
                language: options.language
            }
        });
        // No daily message limit - only credit-based restrictions
        // Users can generate as many messages as they have credits for
        // Calculate required credits with proper parameters
        const requiredCredits = (0, creditCalculator_1.calculateCreditCost)(customers.length, {
            ...options,
            creativity: options.creativity || 0.7,
            hasProducts: customers.some(c => c.productDescription && c.productDescription.trim() !== '')
        });
        // Check user credits and free trial
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: userId },
            select: { credits: true, freeTrialEndsAt: true }
        });
        if (!user) {
            throw new errors_1.AppError('User not found', 404, 'USER_NOT_FOUND');
        }
        // Enforce one-week free trial
        if (user.freeTrialEndsAt && new Date() > user.freeTrialEndsAt) {
            res.status(403).json({
                status: 'error',
                message: 'Your free trial has expired. Please upgrade your plan to continue.',
                code: 'FREE_TRIAL_EXPIRED',
            });
            return;
        }
        if (user.credits < requiredCredits) {
            throw new errors_1.InsufficientCreditsError(requiredCredits, user.credits);
        }
        // Generate messages
        logger_1.logger.info('Starting message generation', { userId, customerCount: customers.length });
        const messages = await (0, message_service_1.generateMessages)({
            customers,
            options: options,
            userId,
            organizationId
        });
        logger_1.logger.info('Messages generated, deducting credits', {
            userId,
            messageCount: messages.length,
            creditsUsed: requiredCredits
        });
        // Deduct credits and get updated user data
        const updatedUser = await prismaClient_1.default.user.update({
            where: { id: userId },
            data: { credits: { decrement: requiredCredits } },
            select: { credits: true }
        });
        // Log successful generation
        logger_1.logger.info('Messages generated successfully', {
            userId,
            messageCount: messages.length,
            creditsUsed: requiredCredits,
            responseData: {
                status: 'success',
                messages: messages.length,
                cost: requiredCredits,
                remainingCredits: updatedUser.credits
            }
        });
        res.json({
            status: 'success',
            messages,
            cost: requiredCredits,
            remainingCredits: updatedUser.credits
        });
    }
    catch (error) {
        logger_1.logger.error('Message generation failed', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        if (error instanceof errors_1.AppError) {
            res.status(error.statusCode).json({
                status: 'error',
                message: error.message,
                code: error.code
            });
            return;
        }
        if (error instanceof errors_1.InsufficientCreditsError) {
            res.status(402).json({
                status: 'error',
                message: error.message,
                code: 'INSUFFICIENT_CREDITS'
            });
            return;
        }
        next(error);
    }
};
// Apply middleware and route handler
router.post('/generate', authMiddleware_1.authenticateToken, validationMiddleware_1.validateGenerateMessage, generateMessagesHandler);
exports.default = router;
