import { App, Platform } from "obsidian";
import type { GitStatus, GitFileStatus, GitCommit } from "./types";

export type { GitStatus, GitFileStatus, GitCommit };

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

  private execArgs(
    args: string[],
    opts: { encoding?: "utf-8" | "buffer"; timeout?: number } = {}
  ): string | Buffer {
    if (this.isMobile) {
      throw new Error("Git 操作仅支持桌面端");
    }
    const { execFileSync } = require("child_process");
    try {
      const execOpts: any = {
        cwd: this.vaultPath,
        encoding: opts.encoding === "buffer" ? undefined : "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      };
      const t = opts.timeout ?? 30000;
      if (t > 0) execOpts.timeout = t;
      return execFileSync("git", args, execOpts);
    } catch (e: any) {
      const msg = (e.stderr?.toString?.() || e.message || "Git 命令执行失败").trim();
      const err = new Error(msg);
      // Signal SIGTERM = killed by timeout
      if (e.signal === "SIGTERM" || /ETIMEDOUT|timed out/i.test(msg)) {
        (err as any).code = "TIMEOUT";
      }
      throw err;
    }
  }

  async isGitRepo(): Promise<boolean> {
    if (this.isMobile) return false;
    try {
      this.execArgs(["rev-parse", "--is-inside-work-tree"]);
      return true;
    } catch {
      return false;
    }
  }

  async initRepo(): Promise<void> {
    this.execArgs(["init"]);
  }

  async ensureRemote(url: string, name: string): Promise<void> {
    // Check if any existing remote already points to this URL — reuse it.
    try {
      const remotesRaw = (this.execArgs(["remote", "-v"]) as string).trim();
      const lines = remotesRaw.split("\n");
      const byUrl: Record<string, string> = {};
      for (const line of lines) {
        const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)/);
        if (m) byUrl[m[2]] = m[1];
      }
      if (byUrl[url] && byUrl[url] !== name) {
        // Another remote already points to this URL — no need to add a duplicate.
        return;
      }
    } catch { /* ignore */ }

    let isNew = false;
    try {
      const existing = (this.execArgs(["remote", "get-url", name]) as string).trim();
      if (existing !== url) {
        this.execArgs(["remote", "set-url", name, url]);
      }
    } catch {
      this.execArgs(["remote", "add", name, url]);
      isNew = true;
    }
    if (isNew) {
      try { this.execArgs(["fetch", name]); } catch { /* available after first push */ }
    }
  }

  async hasCommits(): Promise<boolean> {
    try {
      this.execArgs(["rev-parse", "HEAD"]);
      return true;
    } catch {
      return false;
    }
  }


  async getStatus(remoteName?: string, branchName?: string): Promise<GitStatus> {
    if (this.isMobile) return { clean: true, files: [], ahead: 0, behind: 0 };

    let clean = true;
    let files: string[] = [];
    try {
      const statusFiles = await this.getStatusFiles();
      if (statusFiles.length > 0) {
        clean = false;
        files = statusFiles.map((f) => f.path);
      }
    } catch { /* ignore */ }

    let ahead = 0;
    let behind = 0;
    try {
      if (remoteName && branchName) {
        try {
          const counts = this.execArgs([
            "rev-list", "--left-right", "--count",
            `${remoteName}/${branchName}...${branchName}`,
          ]) as string;
          const parts = counts.trim().split("\t");
          behind = parseInt(parts[0]) || 0;
          ahead = parseInt(parts[1]) || 0;
        } catch { /* remote branch may not exist yet */ }
      } else {
        const branch = (this.execArgs(["rev-parse", "--abbrev-ref", "HEAD"]) as string).trim();
        const counts = this.execArgs([
          "rev-list", "--left-right", "--count",
          `${branch}@{upstream}...${branch}`,
        ]) as string;
        const parts = counts.trim().split("\t");
        behind = parseInt(parts[0]) || 0;
        ahead = parseInt(parts[1]) || 0;
      }
    } catch { /* no upstream or no commits */ }

    return { clean, files, ahead, behind };
  }

  async getStatusFiles(): Promise<GitFileStatus[]> {
    if (this.isMobile) return [];
    try {
      const buf = this.execArgs(
        ["-c", "core.quotePath=false", "status", "--porcelain=v1", "-z"],
        { encoding: "buffer" }
      ) as Buffer;
      if (!buf || buf.length === 0) return [];
      const output = buf.toString("utf-8");
      // -z uses NUL as terminator. Renames "R" emit two entries: "XY new\0old".
      const parts = output.split("\0").filter((p) => p.length > 0);
      const files: GitFileStatus[] = [];
      for (let i = 0; i < parts.length; i++) {
        const entry = parts[i];
        if (entry.length < 3) continue;
        const status = entry.slice(0, 2);
        const path = entry.slice(3);
        const staged = status[0] !== " " && status[0] !== "?";
        files.push({ status, path, staged });
        // "R" / "C" entries are followed by the old path — skip it.
        if (status[0] === "R" || status[0] === "C") i++;
      }
      return files;
    } catch {
      return [];
    }
  }

  async stageFiles(files: string[]): Promise<string[]> {
    const staged: string[] = [];
    const skipped: string[] = [];
    for (const f of files) {
      if (!f || !f.trim()) continue;
      // git add first (works for new/modified files)
      try {
        this.execArgs(["add", "--", f]);
        staged.push(f);
        continue;
      } catch {
        // Deleted-in-index files: git rm --cached
        try {
          this.execArgs(["rm", "--cached", "--", f]);
          staged.push(f);
          continue;
        } catch { /* fall through */ }
        // git add -A (handles deletes as well)
        try {
          this.execArgs(["add", "-A", "--", f]);
          staged.push(f);
          continue;
        } catch { /* fall through */ }
        // git add -f (force, bypass .gitignore)
        try {
          this.execArgs(["add", "-f", "--", f]);
          staged.push(f);
          continue;
        } catch {
          skipped.push(f);
        }
      }
    }
    if (staged.length === 0 && files.length > 0) {
      throw new Error("没有文件可以暂存（所有文件均已不存在）");
    }
    return staged;
  }

  async restoreFiles(files: string[]): Promise<string[]> {
    const restored: string[] = [];
    for (const f of files) {
      let ok = false;
      // Step 1: unstage if needed (ignore if not staged)
      try { this.execArgs(["restore", "--staged", "--", f]); } catch { /* not staged */ }
      // Step 2: restore working tree from index
      try {
        this.execArgs(["restore", "--", f]);
        ok = true;
      } catch { /* try checkout fallback */ }
      // Step 3: git checkout HEAD (handles deleted files, staged+unstaged)
      if (!ok) {
        try {
          this.execArgs(["checkout", "HEAD", "--", f]);
          ok = true;
        } catch { /* not in HEAD */ }
      }
      // Step 4: legacy git checkout
      if (!ok) {
        try {
          this.execArgs(["checkout", "--", f]);
          ok = true;
        } catch { /* can't restore */ }
      }
      if (ok) {
        restored.push(f);
      }
    }
    if (restored.length === 0 && files.length > 0) {
      throw new Error("无法回滚任何文件");
    }
    return restored;
  }

  async commit(message: string): Promise<boolean> {
    try {
      this.execArgs(["diff", "--cached", "--quiet"]);
      return false; // No staged changes
    } catch {
      // Has staged changes, proceed
    }
    this.execArgs(["commit", "-m", message]);
    return true;
  }

  async stageAndCommit(message: string): Promise<boolean> {
    this.execArgs(["add", "-A"]);

    try {
      this.execArgs(["diff", "--cached", "--quiet"]);
      return false;
    } catch {
      // Has staged changes, proceed
    }

    this.execArgs(["commit", "-m", message]);
    return true;
  }

  async push(
    remote: string,
    branch: string,
    username?: string,
    password?: string,
    timeoutMinutes?: number
  ): Promise<string> {
    const min = timeoutMinutes ?? 5;
    const timeout = min > 0 ? min * 60 * 1000 : 0;
    const args = this.withAuthArgs(username, password);
    args.push("push", "--set-upstream", remote, branch);
    try {
      this.execArgs(args, { timeout });
      // Sync local tracking ref (in case push was killed just before it updated it).
      try { this.execArgs(["fetch", remote, branch], { timeout: 30000 }); } catch { /* ignore */ }
      return "推送成功";
    } catch (e: any) {
      if (e?.code === "TIMEOUT") {
        // Push may have already reached the server. Verify by fetching and comparing HEAD.
        const reconciled = this.verifyRemoteMatchesLocal(remote, branch, username, password);
        if (reconciled) {
          return "推送成功（客户端超时，但服务端已完成）";
        }
      }
      throw e;
    }
  }

  /** Fetch and check whether remote/branch tip equals local HEAD. Returns true if reconciled. */
  private verifyRemoteMatchesLocal(
    remote: string,
    branch: string,
    username?: string,
    password?: string
  ): boolean {
    try {
      const auth = this.withAuthArgs(username, password);
      this.execArgs([...auth, "fetch", remote, branch], { timeout: 30000 });
      const localHead = (this.execArgs(["rev-parse", "HEAD"]) as string).trim();
      const remoteHead = (this.execArgs(["rev-parse", `${remote}/${branch}`]) as string).trim();
      return localHead === remoteHead && localHead.length > 0;
    } catch {
      return false;
    }
  }

  async pull(
    remote: string,
    branch: string,
    username?: string,
    password?: string,
    timeoutMinutes?: number
  ): Promise<string> {
    const min = timeoutMinutes ?? 5;
    const timeout = min > 0 ? min * 60 * 1000 : 0;
    const args = this.withAuthArgs(username, password);
    args.push("pull", remote, branch, "--no-edit");
    const output = this.execArgs(args, { timeout }) as string;
    return output.trim() || "拉取完成";
  }

  /** Prefix git args with `-c http.extraHeader=...` for GitHub token auth, avoiding token in URL. */
  private withAuthArgs(username?: string, password?: string): string[] {
    if (!username || !password) return [];
    // GitHub accepts Basic auth via extraHeader; token can be the password or the username field.
    const basic = Buffer.from(`${username}:${password}`).toString("base64");
    return ["-c", `http.extraHeader=Authorization: Basic ${basic}`];
  }

  async pushAll(
    remote: string,
    branch: string,
    message: string,
    username?: string,
    password?: string,
    timeoutMinutes?: number
  ): Promise<string> {
    await this.stageAndCommit(message);
    return this.push(remote, branch, username, password, timeoutMinutes);
  }

  async getRecentCommits(n: number): Promise<GitCommit[]> {
    if (this.isMobile) return [];
    try {
      const output = this.execArgs(["log", "--format=%H%x00%an%x00%s%x00%ai", "-n", String(n)]) as string;
      return output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const parts = line.split("\0");
          return { hash: parts[0].slice(0, 7), message: parts[2], date: parts[3], author: parts[1] };
        });
    } catch {
      return [];
    }
  }

  async getCommitFiles(hash: string): Promise<string[]> {
    if (this.isMobile) return [];
    try {
      const output = this.execArgs(["diff-tree", "--no-commit-id", "--name-only", "-r", hash]) as string;
      return output.trim().split("\n").filter(Boolean);
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
