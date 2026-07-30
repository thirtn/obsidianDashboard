import { App, Platform } from "obsidian";
import type { GitStatus, GitFileStatus, GitCommit } from "./types";
import { NativeGitBackend } from "./NativeGitBackend";
import { IsomorphicGitBackend } from "./IsomorphicGitBackend";
import type { IGitBackend } from "./GitBackend";

export type { GitStatus, GitFileStatus, GitCommit };

export class GitService {
  private backend: IGitBackend;

  constructor(app: App) {
    if (Platform.isMobile) {
      this.backend = new IsomorphicGitBackend(app);
    } else {
      this.backend = new NativeGitBackend(app);
    }
  }

  get isMobile(): boolean {
    return Platform.isMobile;
  }

  async isGitRepo(): Promise<boolean> { return this.backend.isGitRepo(); }
  async initRepo(): Promise<void> { return this.backend.initRepo(); }
  async ensureRemote(url: string, name: string): Promise<void> { return this.backend.ensureRemote(url, name); }
  async hasCommits(): Promise<boolean> { return this.backend.hasCommits(); }
  async getStatus(remoteName?: string, branchName?: string): Promise<GitStatus> { return this.backend.getStatus(remoteName, branchName); }
  async getStatusFiles(): Promise<GitFileStatus[]> { return this.backend.getStatusFiles(); }
  async stageFiles(files: string[]): Promise<string[]> { return this.backend.stageFiles(files); }
  async restoreFiles(files: string[]): Promise<string[]> { return this.backend.restoreFiles(files); }
  async commit(message: string): Promise<boolean> { return this.backend.commit(message); }
  async stageAndCommit(message: string): Promise<boolean> { return this.backend.stageAndCommit(message); }
  async push(remote: string, branch: string, username?: string, password?: string, timeoutMinutes?: number): Promise<string> { return this.backend.push(remote, branch, username, password, timeoutMinutes); }
  async pull(remote: string, branch: string, username?: string, password?: string, timeoutMinutes?: number): Promise<string> { return this.backend.pull(remote, branch, username, password, timeoutMinutes); }
  async pushAll(remote: string, branch: string, message: string, username?: string, password?: string, timeoutMinutes?: number): Promise<string> { return this.backend.pushAll(remote, branch, message, username, password, timeoutMinutes); }
  async getRecentCommits(n: number): Promise<GitCommit[]> { return this.backend.getRecentCommits(n); }
  async getCommitFiles(hash: string): Promise<string[]> { return this.backend.getCommitFiles(hash); }
  buildAuthUrl(remoteUrl: string, username: string, password: string): string { return this.backend.buildAuthUrl(remoteUrl, username, password); }
}
