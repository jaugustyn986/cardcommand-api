import { UserWithPreferences } from '../middleware/auth';

declare global {
  namespace Express {
    interface Request {
      user?: UserWithPreferences;
    }
  }
}

export {};
