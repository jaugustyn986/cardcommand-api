import { Request, Response } from 'express';
export declare const getReleases: (req: Request, res: Response) => Promise<void>;
export declare const getReleaseProducts: (req: Request, res: Response) => Promise<void>;
export declare const getReleaseChanges: (req: Request, res: Response) => Promise<void>;
export declare const getRelease: (req: Request, res: Response) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const createRelease: (req: Request, res: Response) => Promise<void>;
export declare const setReminder: (req: Request, res: Response) => Promise<void>;
export declare const removeReminder: (req: Request, res: Response) => Promise<void>;
export declare const getReminders: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=releasesController.d.ts.map