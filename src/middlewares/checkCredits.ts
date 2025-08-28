import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prismaClient';
import { AuthRequest } from '../types/middleware';
import { 
  AuthenticationError, 
  InsufficientCreditsError, 
  DatabaseError,
  AppError
} from '../utils/errors';

export const checkCredits = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;
  const cost = req.body._calculatedCost ?? 1;

  if (!userId) {
    throw new AuthenticationError('User not authenticated');
  }

  try {
    // Use transaction to prevent race conditions
    const user = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, credits: true }
      });

      if (!user) {
        throw new AuthenticationError('User not found');
      }

      if (user.credits < cost) {
        throw new InsufficientCreditsError(cost, user.credits);
      }

      return user;
    });

    // Attach user to request for later use
    if (req.user) {
      req.user = { ...req.user, credits: user.credits };
    }
    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new DatabaseError('Failed to check user credits');
  }
}; 