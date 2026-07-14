import { App, Platform } from "obsidian";

export interface GitStatus {
  clean: boolean;
  files: string[];
  ahead: number;
  behind: number;
}

export interface GitFileStatus {
  path: string;
  status: string; // e.g. " M", "??", "A ", "D "
  staged: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}

export class GitService {
  private app: App;
  private vaultPath: string;

  constructor(app: App) {
    this.app = app;
    this.vaultPath = this.getVaultPath();
  }

  private getVaultPath(): string {
    try {
      return (this.app.vault.adapter as any).getBasePath?.() ?? "";
    } catch {
      return "";
    }
  }

  get isMobile(): boolean {
    return Platform.isMobile;
  }

  private exec(cmd: string): string {
    if (this.isMobile) {
      throw new Error("Git 操作仅支持桌面端");
    }
    const { execSync } = require("child_process");
    try {
      const result = execSync(cmd, {
        cwd: this.vaultPath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000,
      }).toString();
      return result;
    } catch (e: any) {
      console.log(`[yyDashboard] exec failed (expected for --quiet checks): ${cmd}`);
      throw new Error(e.stderr || e.message || "Git 命令执行失败");
    }
  }

  async isGitRepo(): Promise<boolean> {
    if (this.isMobile) return false;
    try {
      this.exec("git rev-parse --is-inside-work-tree");
      return true;
    } catch {
      return false;
    }
  }

  async initRepo(): Promise<void> {
    this.exec("git init");
  }

  async ensureRemote(url: string, name: string): Promise<void> {
    try {
      const existing = this.exec(`git remote get-url ${name}`).trim();
      if (existing !== url) {
        this.exec(`git remote set-url ${name} ${url}`);
      }
    } catch {
      this.exec(`git remote add ${name} ${url}`);
    }
  }

  async hasCommits(): Promise<boolean> {
    try {
      this.exec("git rev-parse HEAD");
      return true;
    } catch {
      return false;
    }
  }

  private parsePorcelainPath(line: string): string {
    // Strip BOM if present (Electron may add it)
    const clean = line.replace(/^\ufeff/, '');
    // Porcelain format: "XY path" or "XY old -> new" (renames)
    // Use \S{0,2}\s+ to be resilient against encoding quirks
    const match = clean.match(/^\S{0,2}\s+(.*)$/);
    if (!match) { console.log("[yyDashboard] parsePorcelainPath no match for:", JSON.stringify(line)); return ""; }
    const raw = match[1];
    const arrow = raw.indexOf(" -> ");
    return arrow > -1 ? raw.slice(arrow + 4) : raw;
  }

  async getStatus(): Promise<GitStatus> {
    if (this.isMobile) return { clean: true, files: [], ahead: 0, behind: 0 };

    let clean = true;
    let files: string[] = [];
    try {
      const output = this.exec("git -c core.quotePath=false status --porcelain");
      if (output.trim()) {
        clean = false;
        files = output.trim().split(/\r?\n/).map((line) => this.parsePorcelainPath(line));
      }
    } catch { /* ignore */ }

    let ahead = 0;
    let behind = 0;
    try {
      const branch = this.exec("git rev-parse --abbrev-ref HEAD").trim();
      const counts = this.exec(
        `git rev-list --left-right --count ${branch}@{upstream}...${branch}`
      );
      const parts = counts.trim().split("\t");
      behind = parseInt(parts[0]) || 0;
      ahead = parseInt(parts[1]) || 0;
    } catch { /* no upstream or no commits */ }

    return { clean, files, ahead, behind };
  }

  async getStatusFiles(): Promise<GitFileStatus[]> {
    if (this.isMobile) return [];
    try {
      const output = this.exec("git -c core.quotePath=false status --porcelain");
      if (!output.trim()) return [];
      console.log("[yyDashboard] git status --porcelain raw output:", JSON.stringify(output));
      const lines = output.trim().split(/\r?\n/);
      if (lines.length > 0) {
        console.log("[yyDashboard] first line charCodes:", JSON.stringify([...lines[0]].map((c: string) => c.charCodeAt(0))));
      }
      const files = lines.map((line) => {
        const cleanLine = line.replace(/^\ufeff/, '');
        return {
          status: cleanLine.slice(0, 2),
          path: this.parsePorcelainPath(line),
          staged: cleanLine[0] !== " " && cleanLine[0] !== "?",
        };
      });
      console.log("[yyDashboard] getStatusFiles parsed:", JSON.stringify(files));
      return files;
    } catch (e: any) {
      console.error("[yyDashboard] getStatusFiles failed:", e.message);
      return [];
    }
  }

  async stageFiles(files: string[]): Promise<string[]> {
    console.log(`[yyDashboard] stageFiles called with ${files.length} files:`, JSON.stringify(files));
    const staged: string[] = [];
    const skipped: string[] = [];
    for (const f of files) {
      if (!f || !f.trim()) {
        console.log("[yyDashboard] Skipping empty/whitespace path");
        continue;
      }
      // Try git add first (works for new/modified files)
      try {
        this.exec(`git add -- "${f.replace(/"/g, '\\"')}"`);
        staged.push(f);
        continue;
      } catch (e1: any) {
        // Try git rm --cached (for deleted files not on disk but in index)
        try {
          this.exec(`git rm --cached -- "${f.replace(/"/g, '\\"')}"`);
          staged.push(f);
          continue;
        } catch { /* fall through */ }
        // Try git add -A as last resort
        try {
          this.exec(`git add -A -- "${f.replace(/"/g, '\\"')}"`);
          staged.push(f);
          continue;
        } catch { /* fall through */ }
        // Try git add -f (force add, bypasses .gitignore)
        try {
          this.exec(`git add -f -- "${f.replace(/"/g, '\\"')}"`);
          staged.push(f);
          continue;
        } catch (e3: any) {
          console.log(`[yyDashboard] Skipping file: "${f}", add error: ${e1.message}, rm error: ${e3.message}`);
          skipped.push(f);
        }
      }
    }
    console.log(`[yyDashboard] stageFiles result: staged=${staged.length}, skipped=${skipped.length}, skipped=`, JSON.stringify(skipped));
    if (staged.length === 0 && files.length > 0) {
      throw new Error("没有文件可以暂存（所有文件均已不存在）");
    }
    return staged;
  }

  async restoreFiles(files: string[]): Promise<string[]> {
    console.log("[yyDashboard] restoreFiles called with:", JSON.stringify(files));
    const restored: string[] = [];
    for (const f of files) {
      let ok = false;
      // Step 1: unstage if needed (ignore error if not staged)
      try { this.exec(`git restore --staged -- "${f.replace(/"/g, '\\"')}"`); } catch { /* not staged */ }
      // Step 2: restore working tree from index (works for tracked files)
      try {
        this.exec(`git restore -- "${f.replace(/"/g, '\\"')}"`);
        ok = true;
      } catch { /* try git checkout fallback */ }
      // Step 3: git checkout HEAD (handles deleted files, staged+unstaged)
      if (!ok) {
        try {
          this.exec(`git checkout HEAD -- "${f.replace(/"/g, '\\"')}"`);
          ok = true;
        } catch { /* not in HEAD, might be untracked */ }
      }
      // Step 4: legacy git checkout (restore from index on old git versions)
      if (!ok) {
        try {
          this.exec(`git checkout -- "${f.replace(/"/g, '\\"')}"`);
          ok = true;
        } catch { /* truly can't restore */ }
      }
      if (ok) {
        restored.push(f);
      } else {
        console.log(`[yyDashboard] Failed to restore: ${f}`);
      }
    }
    if (restored.length === 0 && files.length > 0) {
      throw new Error("无法回滚任何文件");
    }
    return restored;
  }

  async commit(message: string): Promise<boolean> {
    try {
      this.exec("git diff --cached --quiet");
      return false; // No staged changes
    } catch {
      // Has staged changes, proceed
    }
    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    return true;
  }

  async stageAndCommit(message: string): Promise<boolean> {
    this.exec("git add -A");

    // Check if there's anything staged
    try {
      this.exec("git diff --cached --quiet");
      return false; // No changes to commit
    } catch {
      // Has staged changes, proceed to commit
    }

    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    return true;
  }

  async push(
    remote: string,
    branch: string,
    username?: string,
    password?: string
  ): Promise<string> {
    if (username && password) {
      const remoteUrl = this.exec(`git remote get-url ${remote}`).trim();
      const authUrl = this.buildAuthUrl(remoteUrl, username, password);
      this.exec(`git push ${authUrl} ${branch}`);
    } else {
      this.exec(`git push ${remote} ${branch}`);
    }
    return "推送成功";
  }

  async pull(
    remote: string,
    branch: string,
    username?: string,
    password?: string
  ): Promise<string> {
    if (username && password) {
      const remoteUrl = this.exec(`git remote get-url ${remote}`).trim();
      const authUrl = this.buildAuthUrl(remoteUrl, username, password);
      const output = this.exec(`git pull ${authUrl} ${branch} --no-edit`);
      return output.trim() || "拉取完成";
    }
    const output = this.exec(`git pull ${remote} ${branch} --no-edit`);
    return output.trim() || "拉取完成";
  }

  async pushAll(
    remote: string,
    branch: string,
    message: string,
    username?: string,
    password?: string
  ): Promise<string> {
    // Stage and commit
    const committed = await this.stageAndCommit(message);
    if (!committed) {
      // Even if no commit, push existing commits
    }

    // Push
    return this.push(remote, branch, username, password);
  }

  async getRecentCommits(n: number): Promise<GitCommit[]> {
    if (this.isMobile) return [];
    try {
      const output = this.exec(
        `git log --oneline --format="%H|%an|%s|%ai" -n ${n}`
      );
      return output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const idx1 = line.indexOf("|");
          const idx2 = line.indexOf("|", idx1 + 1);
          const idx3 = line.indexOf("|", idx2 + 1);
          const hash = line.slice(0, idx1);
          const author = line.slice(idx1 + 1, idx2);
          const message = line.slice(idx2 + 1, idx3);
          const date = line.slice(idx3 + 1);
          return { hash: hash.slice(0, 7), message, date, author };
        });
    } catch {
      return [];
    }
  }

  async getCommitFiles(hash: string): Promise<string[]> {
    if (this.isMobile) return [];
    try {
      const output = this.exec(
        `git diff-tree --no-commit-id --name-only -r ${hash}`
      );
      return output
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  buildAuthUrl(remoteUrl: string, username: string, password: string): string {
    if (remoteUrl.startsWith("https://")) {
      const withoutProtocol = remoteUrl.slice(8);
      return `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${withoutProtocol}`;
    }
    return remoteUrl;
  }
}
