export type RunStatus = 'pending' | 'completed' | 'failed';

export interface RunRecord {
  id: string;
  type: string;
  input: Record<string, any>;
  status: RunStatus;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
