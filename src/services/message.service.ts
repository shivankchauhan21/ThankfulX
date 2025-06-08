import { GoogleGenerativeAI } from '@google/generative-ai';
import { Customer } from './file.service';
import { Response } from 'express';
import prisma from '../utils/prismaClient';
import { generateWithGemini } from '../utils/geminiClient';
import { AuthRequest } from '../types/middleware';
import { 
  AIServiceError, 
  DatabaseError, 
  ValidationError,
  InsufficientCreditsError
} from '../utils/errors';
import { logger } from '../utils/logger';
import { calculateCreditCost } from '../utils/creditCalculator';
import { generateAIResponse } from '../utils/openai';

if (!process.env.GOOGLE_API_KEY) {
  throw new Error('GOOGLE_API_KEY is not set in environment variables');
}

// Initialize Gemini AI with gemini-2.0-flash model
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export interface MessageOptions {
  style: 'formal' | 'casual' | 'friendly' | 'professional';
  length: 'short' | 'medium' | 'long';
  language: 'en' | 'es' | 'fr' | 'de';
}

export interface GeneratedMessage {
  customer: Customer;
  message: string;
}

interface GenerateMessagesParams {
  customers: Customer[];
  options: MessageOptions;
  userId: string;
  organizationId?: string;
}

export async function generateMessages({ customers, options, userId, organizationId }: GenerateMessagesParams) {
  // If organizationId is provided, verify the user has access to it
  if (organizationId) {
    const organization = await prisma.organization.findFirst({
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
      logger.warn('User attempted to generate message for unauthorized organization', {
        userId,
        organizationId
      });
      throw new Error('Unauthorized access to organization');
    }

    logger.info('Organization access verified', {
      userId,
      organizationId,
      organizationName: organization.name
    });
  }

  const messages = await Promise.all(
    customers.map(async (customer) => {
      try {
        const message = await generateAIResponse(customer, options);
        return {
          message,
          customer
        };
      } catch (error) {
        logger.error('Failed to generate message for customer', {
          customerName: customer.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    })
  );

  // Store messages in a transaction
  await prisma.$transaction(async (tx) => {
    await Promise.all(
      messages.map(msg =>
        tx.message.create({
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
        })
      )
    );
  });

  logger.info('Messages generated and stored successfully', {
    userId,
    organizationId,
    messageCount: messages.length
  });

  return messages;
}

function generatePrompt(customer: Customer, options: MessageOptions): string {
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

export async function generateMessage(req: AuthRequest, res: Response) {
  const userId = req.user?.id;
  if (!userId) {
    throw new ValidationError('User not authenticated');
  }

  const {
    customerName,
    products,
    style,
    length,
    language,
    additionalContext
  } = req.body;

  // Validate required fields
  if (!customerName || !products || !style || !length || !language) {
    throw new ValidationError('Missing required fields');
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
    let aiResponse: string;
    try {
      aiResponse = await generateWithGemini(prompt);
    } catch (error) {
      logger.error('AI service error', { error, prompt });
      throw new AIServiceError('Failed to generate message');
    }

    // Calculate cost for single message
    const cost = calculateCreditCost(1, {
      style,
      length,
      language
    });

    try {
      // Use a single transaction for credit check, deduction, and message storage
      await prisma.$transaction(async (tx) => {
        // Check and update credits atomically
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { credits: true }
        });

        if (!user || user.credits < cost) {
          throw new InsufficientCreditsError(cost, user?.credits || 0);
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

      logger.info('Message generated and saved', {
        userId,
        cost,
        style,
        length,
        language
      });
    } catch (error) {
      logger.error('Database operation failed', { error, userId });
      throw new DatabaseError('Failed to save message or update credits');
    }

    return res.json({
      status: 'success',
      data: {
        message: aiResponse,
        cost: calculateCreditCost(1, {
          style,
          length,
          language
        })
      }
    });
  } catch (error) {
    // Let the error handler middleware handle the error
    throw error;
  }
}

function buildPrompt(params: {
  customerName: string;
  products: string[];
  style: string;
  length: string;
  language: string;
  additionalContext?: string;
}): string {
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