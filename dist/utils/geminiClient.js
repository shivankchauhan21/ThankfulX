"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWithGemini = generateWithGemini;
const generative_ai_1 = require("@google/generative-ai");
const errors_1 = require("./errors");
if (!process.env.GOOGLE_API_KEY) {
    throw new Error('GOOGLE_API_KEY is not set in environment variables');
}
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
async function generateWithGemini(prompt) {
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    }
    catch (error) {
        if (error instanceof Error) {
            throw new errors_1.AIServiceError(`Failed to generate content: ${error.message}`);
        }
        throw new errors_1.AIServiceError('Failed to generate content');
    }
}
