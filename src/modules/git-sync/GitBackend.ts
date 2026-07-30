import type { GitStatus, GitFileStatus, GitCommit } from "./types";

export interface IGitBackend {
  isGitRepo(): Promise<boolean>;
  initRepo(): Promise<void>;
  ensureRemote(url: string, name: string): Promise<void>;
  hasCommits(): Promise<boolean>;
  getStatus(remoteName?: string, branchName?: string): Promise<GitStatus>;
  getStatusFiles(): Promise<GitFileStatus[]>;
  stageFiles(files: string[]): Promise<string[]>;
  restoreFiles(files: string[]): Promise<string[]>;
  commit(message: string): Promise<boolean>;
  stageAndCommit(message: string): Promise<boolean>;
  push(remote: string, branch: string, username?: string, password?: string, timeoutMinutes?: number): Promise<string>;
  pull(remote: string, branch: string, username?: string, password?: string, timeoutMinutes?: number): Promise<string>;
  pushAll(remote: string, branch: string, message: string, username?: string, password?: string, timeoutMinutes?: number): Promise<string>;
  getRecentCommits(n: number): Promise<GitCommit[]>;
  getCommitFiles(hash: string): Promise<string[]>;
  buildAuthUrl(remoteUrl: string, username: string, password: string): string;
}
