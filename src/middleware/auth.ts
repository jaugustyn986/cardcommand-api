// ============================================
// CardCommand Center - Authentication Middleware
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { User, UserPreferences } from '@prisma/client';

const JWT_SECRET: jwt.Secret = (process.env.JWT_SECRET || 'your-secret-key') as jwt.Secret;

// JWT Payload interface
interface JWTPayload {
  userId: string;
  email: string;
  plan: string;
}

// User with preferences type
export type UserWithPreferences = User & {
  preferences: UserPreferences | null;
};

// Generate JWT token
export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    plan: user.plan,
  };

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

// Verify JWT token
export function verifyToken(token: string): JWTPayload {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
}

// Authentication middleware
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required',
        },
      });
      return;
    }

    const payload = verifyToken(token);
    
    // Get full user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { preferences: true },
    }) as UserWithPreferences | null;

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found',
        },
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Account is not active',
        },
      });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        },
      });
      return;
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired',
        },
      });
      return
