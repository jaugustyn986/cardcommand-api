import { Request, Response, NextFunction } from 'express';
export declare function getPortfolio(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getGradingQueue(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function addToGradingQueue(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function addPortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function updatePortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function deletePortfolioItem(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function getPortfolioStats(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=portfolioController.d.ts.map