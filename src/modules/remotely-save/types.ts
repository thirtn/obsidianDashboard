export interface SyncSession {
  ts: number;
  tsFmt: string;
  remoteType: string;
  uploads: string[];
  downloads: string[];
  deletions: string[];
  totalCount: number;
}
