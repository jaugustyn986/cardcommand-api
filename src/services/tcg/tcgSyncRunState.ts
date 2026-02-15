import { TcgSyncResult } from './tcgSyncPipeline';

export type TcgSyncTrigger = 'manual' | 'scheduled' | 'development_boot';
export type TcgSyncRunStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface TcgSyncRunRecord {
  runId: string;
  trigger: TcgSyncTrigger;
  status: TcgSyncRunStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  result?: TcgSyncResult;
  error?: string;
}

let currentRun: TcgSyncRunRecord | null = null;
let lastRun: TcgSyncRunRecord | null = null;

function createRunId(): string {
  return `tcg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function beginTcgSyncRun(trigger: TcgSyncTrigger): { accepted: boolean; run: TcgSyncRunRecord } {
  if (currentRun && currentRun.status === 'running') {
    return { accepted: false, run: currentRun };
  }

  const run: TcgSyncRunRecord = {
    runId: createRunId(),
    trigger,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  currentRun = run;
  return { accepted: true, run };
}

export function finishTcgSyncRunSuccess(runId: string, result: TcgSyncResult): void {
  if (!currentRun || currentRun.runId !== runId) return;

  const endedAt = new Date().toISOString();
  const durationMs = new Date(endedAt).getTime() - new Date(currentRun.startedAt).getTime();
  const completed: TcgSyncRunRecord = {
    ...currentRun,
    status: 'completed',
    endedAt,
    durationMs,
    result,
    error: undefined,
  };

  lastRun = completed;
  currentRun = null;
}

export function finishTcgSyncRunFailure(runId: string, error: unknown): void {
  if (!currentRun || currentRun.runId !== runId) return;

  const endedAt = new Date().toISOString();
  const durationMs = new Date(endedAt).getTime() - new Date(currentRun.startedAt).getTime();
  const failed: TcgSyncRunRecord = {
    ...currentRun,
    status: 'failed',
    endedAt,
    durationMs,
    error: error instanceof Error ? error.message : String(error),
  };

  lastRun = failed;
  currentRun = null;
}

export function getTcgSyncRunState(): {
  status: TcgSyncRunStatus;
  currentRun: TcgSyncRunRecord | null;
  lastRun: TcgSyncRunRecord | null;
} {
  if (currentRun) {
    return { status: 'running', currentRun, lastRun };
  }
  if (lastRun) {
    return { status: lastRun.status, currentRun: null, lastRun };
  }
  return { status: 'idle', currentRun: null, lastRun: null };
}
