import { z } from 'zod';
export const ProfileSchema = z.object({
  harness: z.enum(['codex', 'dsh']), model: z.string().min(1).max(200).optional(),
  command: z.array(z.string().min(1)).min(1).max(32).optional(),
}).strict();
export type Profile = z.infer<typeof ProfileSchema>;
export const CreateSchema = z.object({
  requestId: z.string().min(1).max(128), entry: z.string().min(1).max(100).optional(),
  profile: z.string().min(1).max(64), instructions: z.string().min(1).max(64000),
  repo: z.string().min(1).optional(), baseRef: z.string().min(1).max(200).optional(),
  allowedWorkers: z.array(z.string().min(1).max(64)).max(10).optional(),
}).strict();
export type CreateInput = z.infer<typeof CreateSchema>;
export type State = 'preparing' | 'running' | 'waiting_approval' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
export const terminal = (state: State) => ['completed','failed','cancelled','interrupted'].includes(state);
export type Task = {
  id: string; requestId: string; requestHash: string; role: 'leader'|'worker'; parentId?: string;
  entry: string; profile: string; harness: Profile['harness']; requestedModel?: string; actualModel?: string;
  instructions: string; allowedWorkers: string[]; repo: string; baseRef: string;
  worktree?: string; branch?: string; nativeSessionId?: string; turn: number;
  state: State; createdAt: string; updatedAt: string; result?: string; error?: string;
  delivery?: { diff: string; status: string; truncated: boolean }; unread: boolean;
};
export type Approval = { id: string; taskId: string; method: string; details: unknown;
  options: {id: string; label: string}[]; state: 'pending'|'answered'|'expired'; selected?: string; createdAt: string };
export type Event = {seq: number; taskId: string; kind: string; data: unknown; at: string};
export type Principal = {kind: 'admin'} | {kind: 'task'; taskId: string; role: 'leader'|'worker'};
export class BridgeError extends Error { constructor(message: string, public status = 400) { super(message); } }
export interface ExecutionContext {
  task: Task; profile: Profile; env: Record<string,string>; signal: AbortSignal;
  event(kind: string, data: unknown): void;
  session(id: string, model?: string): void;
  approve(method: string, details: unknown, options: Approval['options'], signal?: AbortSignal): Promise<string>;
  registerCancel(fn: () => Promise<void>): void;
  registerStop(fn: () => Promise<void> | void): void;
}
export type Runner = (context: ExecutionContext, prompt: string) => Promise<{state: 'completed'|'cancelled'; text: string}>;
