import { SyncPipelineResult } from '../../releaseSyncPipeline';

export type ReleaseSyncTrigger = 'manual' | 'scheduled';
export type ReleaseSyncRunStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface ReleaseSyncRunRecord {
  runId: string;
  trigger: ReleaseSyncTrigger;
  status: ReleaseSyncRunStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  result?: SyncPipelineResult;
  error?: string;
}

let currentRun: ReleaseSyncRunRecord | null = null;
let lastRun: ReleaseSyncRunRecord | null = null;

function createRunId(): string {
  return `release_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function beginReleaseSyncRun(trigger: ReleaseSyncTrigger): { accepted: boolean; run: ReleaseSyncRunRecord } {
  if (currentRun && currentRun.status === 'running') {
    return { accepted: false, run: currentRun };
  }

  const run: ReleaseSyncRunRecord = {
    runId: createRunId(),
    trigger,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  currentRun = run;
  return { accepted: true, run };
}

export function finishReleaseSyncRunSuccess(runId: string, result: SyncPipelineResult): void {
  if (!currentRun || currentRun.runId !== runId) return;

  const endedAt = new Date().toISOString();
  const durationMs = new Date(endedAt).getTime() - new Date(currentRun.startedAt).getTime();
  const completed: ReleaseSyncRunRecord = {
    ...currentRun,
    status: 'completed',
    endedAt,
    durationMs,
    result,
  };

  lastRun = completed;
  currentRun = null;
}

export function finishReleaseSyncRunFailure(runId: string, error: unknown): void {
  if (!currentRun || currentRun.runId !== runId) return;

  const endedAt = new Date().toISOString();
  const durationMs = new Date(endedAt).getTime() - new Date(currentRun.startedAt).getTime();
  const failed: ReleaseSyncRunRecord = {
    ...currentRun,
    status: 'failed',
    endedAt,
    durationMs,
    error: error instanceof Error ? error.message : String(error),
  };

  lastRun = failed;
  currentRun = null;
}

export function getReleaseSyncRunState(): {
  status: ReleaseSyncRunStatus;
  currentRun: ReleaseSyncRunRecord | null;
  lastRun: ReleaseSyncRunRecord | null;
} {
  if (currentRun) {
    return { status: 'running', currentRun, lastRun };
  }
  if (lastRun) {
    return { status: lastRun.status, currentRun: null, lastRun };
  }
  return { status: 'idle', currentRun: null, lastRun: null };
}
