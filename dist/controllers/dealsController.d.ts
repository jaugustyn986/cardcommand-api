import { Request, Response, NextFunction } from 'express';
export declare function getDeals(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getDeal(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function trackDeal(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function untrackDeal(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getTrackedDeals(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function dealStream(req: Request, res: Response): void;
//# sourceMappingURL=dealsController.d.ts.map