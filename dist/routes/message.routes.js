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
        res.status(401).json({ error: 'User not authenticated' });
        return;
    }
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
        logger_1.logger.warn('Invalid customer data in request', { userId, customerCount: 0 });
        res.status(400).json({ error: 'Customer data is required' });
        return;
    }
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
    try {
        // Calculate total cost for all messages
        const totalCost = (0, creditCalculator_1.calculateCreditCost)(customers.length, options);
        logger_1.logger.debug('Credit cost calculated', { userId, totalCost, customerCount: customers.length });
        // Generate messages first
        logger_1.logger.info('Starting AI message generation', { userId, customerCount: customers.length });
        const messages = await (0, message_service_1.generateMessages)({
            customers,
            options,
            userId,
            organizationId
        });
        logger_1.logger.info('AI message generation completed', {
            userId,
            customerCount: customers.length,
            successCount: messages.length,
            organizationId
        });
        // Use a single transaction for credit check, deduction, and message storage
        await prismaClient_1.default.$transaction(async (tx) => {
            // Check and update credits atomically
            const user = await tx.user.findUnique({
                where: { id: userId },
                select: { credits: true }
            });
            if (!user || user.credits < totalCost) {
                logger_1.logger.warn('Insufficient credits for message generation', {
                    userId,
                    required: totalCost,
                    available: (user === null || user === void 0 ? void 0 : user.credits) || 0,
                    customerCount: customers.length
                });
                throw new errors_1.InsufficientCreditsError(totalCost, (user === null || user === void 0 ? void 0 : user.credits) || 0);
            }
            logger_1.logger.info('Credit check passed', {
                userId,
                availableCredits: user.credits,
                requiredCredits: totalCost
            });
            // Deduct credits
            await tx.user.update({
                where: { id: userId },
                data: { credits: { decrement: totalCost } }
            });
            logger_1.logger.info('Credits deducted', {
                userId,
                amount: totalCost,
                remainingCredits: user.credits - totalCost
            });
            // Store all messages
            logger_1.logger.info('Starting message persistence', { userId, messageCount: messages.length });
            await Promise.all(messages.map(msg => tx.message.create({
                data: {
                    content: msg.message,
                    style: options.style,
                    length: options.length,
                    language: options.language,
                    customerName: msg.customer.name,
                    products: msg.customer.productDescription,
                    userId
                }
            })));
            logger_1.logger.info('Messages persisted successfully', {
                userId,
                messageCount: messages.length
            });
        });
        logger_1.logger.info('Message generation process completed successfully', {
            userId,
            customerCount: customers.length,
            totalCost,
            organizationId
        });
        res.json({
            messages,
            cost: totalCost
        });
    }
    catch (err) {
        logger_1.logger.error('Message generation failed', {
            userId,
            error: err instanceof Error ? err.message : 'Unknown error',
            customerCount: customers.length,
            organizationId,
            options: {
                style: options.style,
                length: options.length,
                language: options.language
            }
        });
        next(err);
    }
};
router.post('/generate', authMiddleware_1.authenticateToken, validationMiddleware_1.validateGenerateMessage, generateMessagesHandler);
exports.default = router;
