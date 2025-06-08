import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from './logger';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

interface Customer {
  name: string;
  productDescription: string;
}

interface MessageOptions {
  style: 'formal' | 'casual' | 'friendly' | 'professional';
  length: 'short' | 'medium' | 'long';
  language: 'en' | 'es' | 'fr' | 'de';
}

export async function generateAIResponse(customer: Customer, options: MessageOptions): Promise<string> {
  const prompt = generatePrompt(customer, options);
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const message = response.text();
    
    logger.debug('AI message generated successfully', {
      customerName: customer.name,
      style: options.style,
      length: options.length,
      language: options.language
    });
    
    return message.trim();
  } catch (error) {
    logger.error('Failed to generate AI message', {
      customerName: customer.name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

function generatePrompt(customer: Customer, options: MessageOptions): string {
  const { style, length, language } = options;
  
  let prompt = `You are a professional thank you message writer. Write a ${style} thank you message for ${customer.name}`;
  prompt += ` who purchased: ${customer.productDescription}.`;
  prompt += ` The message should be ${length} and in ${language}.`;
  prompt += ` Make sure to specifically mention the product they purchased and express genuine gratitude.`;
  
  return prompt;
} 