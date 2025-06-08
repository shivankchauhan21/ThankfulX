import { Request } from 'express';

export interface AuthUser {
  id: string;
  role: string;
  credits?: number;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
} 