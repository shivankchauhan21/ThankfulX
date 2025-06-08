import { AuthUser } from './middleware';
import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request {
      user?: AuthUser;
    }
  }
}

export type MessageHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<void>;

export {}; 