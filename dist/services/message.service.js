"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMessages = generateMessages;
exports.generateMessage = generateMessage;
const generative_ai_1 = require("@google/generative-ai");
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const geminiClient_1 = require("../utils/geminiClient");
const errors_1 = require("../utils/errors");
const logger_1 = require("../utils/logger");
const creditCalculator_1 = require("../utils/creditCalculator");
const openai_1 = require("../utils/openai");
if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set in environment variables');
}
// Initialize Gemini AI with gemini-2.0-flash model
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
async function generateMessages({ customers, options, userId, organizationId }) {
    // If organizationId is provided, verify the user has access to it
    if (organizationId) {
        const organization = await prismaClient_1.default.organization.findFirst({
            where: {
                id: organizationId,
                users: {
                    some: {
                        id: userId
                    }
                }
            }
        });
        if (!organization) {
            logger_1.logger.warn('User attempted to generate message for unauthorized organization', {
                userId,
                organizationId
            });
            throw new Error('Unauthorized access to organization');
        }
        logger_1.logger.info('Organization access verified', {
            userId,
            organizationId,
            organizationName: organization.name
        });
    }
    const messages = await Promise.all(customers.map(async (customer) => {
        try {
            const message = await (0, openai_1.generateAIResponse)(customer, options);
            return {
                message,
                customer
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to generate message for customer', {
                customerName: customer.name,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }));
    // Store messages in a transaction
    await prismaClient_1.default.$transaction(async (tx) => {
        await Promise.all(messages.map(msg => tx.message.create({
            data: {
                content: msg.message,
                style: options.style,
                length: options.length,
                language: options.language,
                customerName: msg.customer.name,
                products: msg.customer.productDescription,
                userId,
                ...(organizationId && { organizationId }) // Only include organizationId if provided
            }
        })));
    });
    logger_1.logger.info('Messages generated and stored successfully', {
        userId,
        organizationId,
        messageCount: messages.length
    });
    return messages;
}
function generatePrompt(customer, options) {
    const { style, length, language } = options;
    let prompt = `You are a professional thank you message writer. Write a ${style} thank you message for ${customer.name}`;
    prompt += ` who purchased: ${customer.productDescription}.`;
    prompt += ` The message should be ${length} and in ${language}.`;
    prompt += ` Make sure to specifically mention the product they purchased and express genuine gratitude.`;
    // Include any additional customer data that might be relevant
    const additionalFields = Object.entries(customer)
        .filter(([key]) => !['name', 'productDescription'].includes(key))
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    if (additionalFields) {
        prompt += ` Additional customer details: ${additionalFields}`;
    }
    return prompt;
}
async function generateMessage(req, res) {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
    if (!userId) {
        throw new errors_1.ValidationError('User not authenticated');
    }
    const { customerName, products, style, length, language, additionalContext } = req.body;
    // Validate required fields
    if (!customerName || !products || !style || !length || !language) {
        throw new errors_1.ValidationError('Missing required fields');
    }
    try {
        // Generate prompt
        const prompt = buildPrompt({
            customerName,
            products,
            style,
            length,
            language,
            additionalContext
        });
        // Generate message
        let aiResponse;
        try {
            aiResponse = await (0, geminiClient_1.generateWithGemini)(prompt);
        }
        catch (error) {
            logger_1.logger.error('AI service error', { error, prompt });
            throw new errors_1.AIServiceError('Failed to generate message');
        }
        // Calculate cost for single message
        const cost = (0, creditCalculator_1.calculateCreditCost)(1, {
            style,
            length,
            language
        });
        try {
            // Use a single transaction for credit check, deduction, and message storage
            await prismaClient_1.default.$transaction(async (tx) => {
                // Check and update credits atomically
                const user = await tx.user.findUnique({
                    where: { id: userId },
                    select: { credits: true }
                });
                if (!user || user.credits < cost) {
                    throw new errors_1.InsufficientCreditsError(cost, (user === null || user === void 0 ? void 0 : user.credits) || 0);
                }
                // Deduct credits
                await tx.user.update({
                    where: { id: userId },
                    data: { credits: { decrement: cost } }
                });
                // Save message
                await tx.message.create({
                    data: {
                        content: aiResponse,
                        userId,
                        customerName,
                        style,
                        length,
                        language,
                        products: products.join(', ')
                    }
                });
            });
            logger_1.logger.info('Message generated and saved', {
                userId,
                cost,
                style,
                length,
                language
            });
        }
        catch (error) {
            logger_1.logger.error('Database operation failed', { error, userId });
            throw new errors_1.DatabaseError('Failed to save message or update credits');
        }
        return res.json({
            status: 'success',
            data: {
                message: aiResponse,
                cost: (0, creditCalculator_1.calculateCreditCost)(1, {
                    style,
                    length,
                    language
                })
            }
        });
    }
    catch (error) {
        // Let the error handler middleware handle the error
        throw error;
    }
}
function buildPrompt(params) {
    const { customerName, products, style, length, language, additionalContext } = params;
    let prompt = `Generate a ${length} thank-you message in ${language} for ${customerName}, `;
    prompt += `who purchased ${products.join(', ')}. `;
    prompt += `Style: ${style}. `;
    if (additionalContext) {
        prompt += `Additional context: ${additionalContext}. `;
    }
    prompt += 'Make sure to specifically mention the product(s) they purchased and express genuine gratitude.';
    return prompt;
}
