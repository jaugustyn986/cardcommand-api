import { PrismaClient } from '@prisma/client';
declare const prisma: PrismaClient<{
    log: ("info" | "query" | "warn" | "error")[];
}, never, import("@prisma/client/runtime/library").DefaultArgs>;
declare let isConnected: boolean;
export declare function connectDatabase(): Promise<void>;
export declare function disconnectDatabase(): Promise<void>;
export { prisma, isConnected };
//# sourceMappingURL=database.d.ts.map