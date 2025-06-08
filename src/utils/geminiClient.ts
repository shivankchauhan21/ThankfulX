import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIServiceError } from './errors';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function generateWithGemini(prompt: string): Promise<string> {
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    if (error instanceof Error) {
      throw new AIServiceError(`Failed to generate content: ${error.message}`);
    }
    throw new AIServiceError('Failed to generate content');
  }
} 