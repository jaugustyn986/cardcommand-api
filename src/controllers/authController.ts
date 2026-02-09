import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import { generateToken } from '../middleware/auth';
import { Errors } from '../middleware/errorHandler';

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password, name } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw Errors.conflict('Email already registered');
    }

    const hashedPassword = await hashPassword(password);

    // Create user first without nested preferences to avoid failures if user_preferences
    // table is missing or schema is out of sync in production
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
      include: { preferences: true },
    });

    // Optionally create default preferences; if it fails, user is still created
    try {
      await prisma.userPreferences.create({
        data: {
          userId: user.id,
          categories: [],
          priceRangeMin: 0,
          priceRangeMax: 10000,
          grades: [],
          graders: [],
          dealAlertThreshold: 15,
          notificationChannels: ['email'],
        },
      });
    } catch (prefErr) {
      console.error('Failed to create default preferences for user', user.id, prefErr);
      // Continue — preferences can be created when user updates settings
    }

    // Re-fetch user with preferences in case we just created them
    const userWithPrefs = await prisma.user.findUnique({
      where: { id: user.id },
      include: { preferences: true },
    });
    const finalUser = userWithPrefs ?? user;

    const token = generateToken(finalUser);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: finalUser.id,
          email: finalUser.email,
          name: finalUser.name,
          plan: finalUser.plan,
          preferences: finalUser.preferences,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { preferences: true },
    });

    if (!user) {
      throw Errors.unauthorized('Invalid email or password');
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      throw Errors.unauthorized('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw Errors.forbidden('Account is not active');
    }

    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          preferences: user.preferences,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { preferences: true },
    });

    if (!user) {
      throw Errors.notFound('User');
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        preferences: user.preferences,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (error) {
    next(error);
  }
}

export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      throw Errors.unauthorized();
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.status !== 'active') {
      throw Errors.unauthorized();
    }

    const token = generateToken(user);
    res.json({ success: true, data: { token } });
  } catch (error) {
    next(error);
  }
}
