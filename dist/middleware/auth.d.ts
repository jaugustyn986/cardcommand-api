import { Request, Response, NextFunction } from 'express';
import { User, UserPreferences } from '@prisma/client';
interface JWTPayload {
    userId: string;
    email: string;
    plan: string;
}
export type UserWithPreferences = User & {
    preferences: UserPreferences | null;
};
export declare function generateToken(user: User | UserWithPreferences): string;
export declare function verifyToken(token: string): JWTPayload;
export declare function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requirePlan(...allowedPlans: string[]): (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=auth.d.ts.map