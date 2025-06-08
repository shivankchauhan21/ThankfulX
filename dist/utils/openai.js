"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAIResponse = generateAIResponse;
const generative_ai_1 = require("@google/generative-ai");
const logger_1 = require("./logger");
if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set in environment variables');
}
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
async function generateAIResponse(customer, options) {
    const prompt = generatePrompt(customer, options);
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const message = response.text();
        logger_1.logger.debug('AI message generated successfully', {
            customerName: customer.name,
            style: options.style,
            length: options.length,
            language: options.language
        });
        return message.trim();
    }
    catch (error) {
        logger_1.logger.error('Failed to generate AI message', {
            customerName: customer.name,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
    }
}
function generatePrompt(customer, options) {
    const { style, length, language } = options;
    let prompt = `You are a professional thank you message writer. Write a ${style} thank you message for ${customer.name}`;
    prompt += ` who purchased: ${customer.productDescription}.`;
    prompt += ` The message should be ${length} and in ${language}.`;
    prompt += ` Make sure to specifically mention the product they purchased and express genuine gratitude.`;
    return prompt;
}
