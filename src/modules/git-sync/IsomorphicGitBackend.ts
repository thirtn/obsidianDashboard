import { App } from "obsidian";
import * as git from "isomorphic-git";
import type { GitStatus, GitFileStatus, GitCommit } from "./types";
import type { IGitBackend } from "./GitBackend";

// ── FS Adapter for Obsidian vault ──

interface IsomorphicFs {
  readFile(filepath: string, opts?: { encoding?: string }): Promise<Uint8Array | string>;
  writeFile(filepath: string, data: Uint8Array | string, opts?: { encoding?: string }): Promise<void>;
  unlink(filepath: string): Promise<void>;
  readdir(filepath: string): Promise<string[]>;
  mkdir(filepath: string): Promise<void>;
  rmdir(filepath: string): Promise<void>;
  stat(filepath: string): Promise<{ type: "file" | "dir"; mode: number; size: number; mtimeMs: number; ctimeMs: number; ino: number; uid: number; gid: number }>;
  lstat(filepath: string): Promise<{ type: "file" | "dir"; mode: number; size: number; mtimeMs: number; ctimeMs: number; ino: number; uid: number; gid: number }>;
  readlink?(filepath: string): Promise<string>;
  symlink?(target: string, filepath: string): Promise<void>;
}

function normalizePath(p: string): string {
  // Remove leading slash and clean up
  let cleaned = p.replace(/^\/+/, "").replace(/\/+/g, "/");
  if (cleaned === "" || cleaned === "/") cleaned = ".";
  return cleaned;
}

function createVaultFs(app: App): IsomorphicFs {
  const adapter = app.vault.adapter;

  async function statImpl(filepath: string) {
    const np = normalizePath(filepath);
    if (np === ".") {
      return { type: "dir" as const, mode: 0o777, size: 0, mtimeMs: 0, ctimeMs: 0, ino: 0, uid: 0, gid: 0 };
    }
    try {
      const s = await adapter.stat(np);
      if (!s) throw new Error(`ENOENT: ${np}`);
      return {
        type: (s.type === "folder" ? "dir" : "file") as "file" | "dir",
        mode: s.type === "folder" ? 0o777 : 0o666,
        size: (s as any).size ?? 0,
        mtimeMs: s.mtime,
        ctimeMs: s.ctime,
        ino: 0,
        uid: 0,
        gid: 0,
      };
    } catch (e: any) {
      // If stat fails, fallback → try to list parent to infer type
      throw e;
    }
  }

  return {
    async readFile(filepath, opts) {
      const np = normalizePath(filepath);
      const buf = await adapter.readBinary(np);
      const u8 = new Uint8Array(buf);
      if (opts?.encoding === "utf8" || opts?.encoding === "utf-8") {
        return new TextDecoder("utf-8").decode(u8);
      }
      return u8;
    },
    async writeFile(filepath, data, opts) {
      const np = normalizePath(filepath);
      let u8: Uint8Array;
      if (typeof data === "string") {
        u8 = new TextEncoder().encode(data);
      } else {
        u8 = data;
      }
      await adapter.writeBinary(np, u8.buffer as ArrayBuffer);
    },
    async unlink(filepath) {
      const np = normalizePath(filepath);
      await adapter.remove(np);
    },
    async readdir(filepath) {
      const np = normalizePath(filepath);
      const list = await adapter.list(np);
      return [...(list.folders || []), ...(list.files || [])];
    },
    async mkdir(filepath) {
      const np = normalizePath(filepath);
      await adapter.mkdir(np);
    },
    async rmdir(filepath) {
      const np = normalizePath(filepath);
      await adapter.rmdir(np, true);
    },
    stat: statImpl,
    lstat: statImpl,
    async readlink(_filepath) {
      throw new Error("ENOSYS: symlinks not supported");
    },
    async symlink(_target, _filepath) {
      throw new Error("ENOSYS: symlinks not supported");
    },
  };
}

// ── HTTP client ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const httpClient: any = {
  async request({ url, method, headers, body }: any) {
    const hdrs: Record<string, string> = { ...(headers || {}) };
    let bodyBuf: Uint8Array | undefined;
    if (body) {
      if (Array.isArray(body)) {
        for (const chunk of body) {
          if (chunk instanceof Uint8Array) {
            bodyBuf = bodyBuf ? new Uint8Array([...bodyBuf, ...chunk]) : chunk;
          }
        }
      } else if (body instanceof Uint8Array) {
        bodyBuf = body;
      }
    }
    const resp = await fetch(url, {
      method,
      headers: hdrs,
      body: bodyBuf as any as BodyInit,
    });
    const respBody = await resp.arrayBuffer();
    // Convert Headers to plain object
    const plainHeaders: Record<string, string> = {};
    resp.headers.forEach((v: string, k: string) => { plainHeaders[k] = v; });
    // Return body as async iterable (required by isomorphic-git types)
    const bodyIterable = (async function* () {
      yield new Uint8Array(respBody);
    })();
    return {
      url: resp.url,
      method,
      statusCode: resp.status,
      statusMessage: resp.statusText,
      headers: plainHeaders,
      body: bodyIterable,
    };
  },
};

// ── Status code conversion ──

/** Convert isomorphic-git statusMatrix row to porcelain‑style status string */
function matrixToPorcelain(head: number, workdir: number, stage: number): string {
  // head: 0=absent, 1=same as HEAD
  // workdir: 0=absent, 1=same as HEAD, 2=modified
  // stage: 0=absent, 1=same as HEAD, 2=changed, 3=added
  const xy = (x: string, y: string) => x + y;

  if (head === 0 && workdir === 0 && stage === 0) return "  "; // should not happen
  if (head === 0 && workdir === 2 && stage === 0) return "??"; // untracked
  if (head === 0 && workdir === 0 && stage === 3) return "A "; // added, staged
  if (head === 0 && workdir === 2 && stage === 3) return "AM"; // added, staged + modified
  if (head === 1 && workdir === 0 && stage === 0) return " D"; // deleted, not staged
  if (head === 1 && workdir === 0 && stage === 0) return "D "; // deleted, staged
  if (head === 1 && workdir === 0 && stage === 2) return "D "; // deleted, staged
  if (head === 1 && workdir === 2 && stage === 1) return " M"; // modified, not staged
  if (head === 1 && workdir === 1 && stage === 2) return "M "; // modified, staged
  if (head === 1 && workdir === 2 && stage === 2) return "MM"; // modified, both

  // More detailed fallback based on the matrix
  if (stage === 3) return "A ";
  if (stage === 2 && head === 1 && workdir === 1) return "M ";
  if (stage === 2 && head === 1 && workdir === 2) return "MM";
  if (stage === 1 && workdir === 2 && head === 1) return " M";
  if (head === 1 && workdir === 0 && stage === 0) return " D";
  if (head === 1 && workdir === 0 && stage === 2) return "D ";
  if (head === 0 && workdir === 2 && stage === 0) return "??";

  return "  ";
}

// ── Backend ──

export class IsomorphicGitBackend implements IGitBackend {
  private app: App;
  private fs: IsomorphicFs;
  private dir: string;

  constructor(app: App) {
    this.app = app;
    this.fs = createVaultFs(app);
    this.dir = "/";
  }

  private async gitdir(): Promise<string> {
    try {
      return await git.findRoot({ fs: this.fs, filepath: `${this.dir}/.git` });
    } catch {
      return `${this.dir}/.git`;
    }
  }

  // ── Public API ──

  async isGitRepo(): Promise<boolean> {
    try {
      const gd = await this.gitdir();
      await git.resolveRef({ fs: this.fs, dir: gd, ref: "HEAD" });
      return true;
    } catch {
      return false;
    }
  }

  async initRepo(): Promise<void> {
    await git.init({ fs: this.fs, dir: this.dir });
  }

  async ensureRemote(url: string, name: string): Promise<void> {
    const gd = await this.gitdir();
    const remotes = await git.listRemotes({ fs: this.fs, dir: gd });

    // Check if any existing remote already points to this URL
    const byUrl: Record<string, string> = {};
    for (const r of remotes) {
      if (r.url) byUrl[r.url] = r.remote;
    }
    if (byUrl[url] && byUrl[url] !== name) {
      return;
    }

    const existing = remotes.find((r) => r.remote === name);
    if (existing) {
      if (existing.url !== url) {
        await git.deleteRemote({ fs: this.fs, dir: gd, remote: name });
        await git.addRemote({ fs: this.fs, dir: gd, remote: name, url });
      }
    } else {
      await git.addRemote({ fs: this.fs, dir: gd, remote: name, url });
      try {
        await git.fetch({
          fs: this.fs,
          http: httpClient,
          dir: gd,
          remote: name,
          singleBranch: true,
        });
      } catch { /* available after first push */ }
    }
  }

  async hasCommits(): Promise<boolean> {
    try {
      const gd = await this.gitdir();
      await git.resolveRef({ fs: this.fs, dir: gd, ref: "HEAD" });
      return true;
    } catch {
      return false;
    }
  }

  async getStatus(remoteName?: string, branchName?: string): Promise<GitStatus> {
    const gd = await this.gitdir();
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

    if (remoteName && branchName) {
      try {
        const localRef = `refs/heads/${branchName}`;
        const remoteRef = `refs/remotes/${remoteName}/${branchName}`;

        const localOid = await git.resolveRef({ fs: this.fs, dir: gd, ref: localRef }).catch(() => null);
        const remoteOid = await git.resolveRef({ fs: this.fs, dir: gd, ref: remoteRef }).catch(() => null);

        if (localOid && remoteOid && localOid !== remoteOid) {
          // Count ahead/behind by walking commits
          const localLog = await git.log({ fs: this.fs, dir: gd, ref: localRef, depth: 500 });
          const remoteHashes = new Set(
            (await git.log({ fs: this.fs, dir: gd, ref: remoteRef, depth: 500 })).map((c) => c.oid)
          );
          const localHashes = new Set(localLog.map((c) => c.oid));

          for (const c of localLog) {
            if (remoteHashes.has(c.oid)) break;
            ahead++;
          }

          const remoteLog = await git.log({ fs: this.fs, dir: gd, ref: remoteRef, depth: 500 });
          for (const c of remoteLog) {
            if (localHashes.has(c.oid)) break;
            behind++;
          }
        }
      } catch { /* remote may not exist */ }
    }

    return { clean, files, ahead, behind };
  }

  async getStatusFiles(): Promise<GitFileStatus[]> {
    try {
      const gd = await this.gitdir();
      const matrix = await git.statusMatrix({
        fs: this.fs,
        dir: this.dir,
        gitdir: gd,
      });

      const results: GitFileStatus[] = [];
      for (const [filepath, head, workdir, stage] of matrix) {
        // Skip unchanged files
        if (head === 1 && workdir === 1 && stage === 1) continue;

        const status = matrixToPorcelain(head, workdir, stage);
        if (status === "  ") continue;

        const staged = stage !== 1 || (status[0] !== " " && status[0] !== "?");
        results.push({ path: filepath, status, staged });
      }
      return results;
    } catch {
      return [];
    }
  }

  async stageFiles(files: string[]): Promise<string[]> {
    const gd = await this.gitdir();
    const staged: string[] = [];
    const skipped: string[] = [];

    for (const f of files) {
      if (!f || !f.trim()) continue;
      try {
        await git.add({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
        staged.push(f);
      } catch {
        try {
          await git.remove({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
          staged.push(f);
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
    const gd = await this.gitdir();
    const restored: string[] = [];

    for (const f of files) {
      try {
        // Unstage first
        try {
          await git.resetIndex({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
        } catch { /* not staged */ }

        // Restore working tree from HEAD
        await git.checkout({
          fs: this.fs,
          dir: this.dir,
          gitdir: gd,
          filepaths: [f],
          force: true,
        });
        restored.push(f);
      } catch { /* can't restore */ }
    }
    if (restored.length === 0 && files.length > 0) {
      throw new Error("无法回滚任何文件");
    }
    return restored;
  }

  async commit(message: string): Promise<boolean> {
    const gd = await this.gitdir();

    // Check if there are staged changes
    const matrix = await git.statusMatrix({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      filter: (f) => f.endsWith(""),
    });

    const hasStaged = matrix.some(([_f, _h, _w, stage]) => stage !== 1);
    if (!hasStaged) return false;

    const sha = await git.commit({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      message,
      author: {
        name: "yyObsidianDashboard",
        email: "dashboard@obsidian.local",
      },
    });
    return !!sha;
  }

  async stageAndCommit(message: string): Promise<boolean> {
    const gd = await this.gitdir();

    // Stage all files
    const matrix = await git.statusMatrix({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
    });

    const toAdd: string[] = [];
    const toRemove: string[] = [];
    for (const [filepath, _head, _workdir, _stage] of matrix) {
      const head = _head as number;
      const workdir = _workdir as number;
      if (head === 1 && workdir === 0) {
        toRemove.push(filepath);
      } else if (head !== workdir || (head === 0 && workdir === 2)) {
        toAdd.push(filepath);
      }
    }

    for (const f of toAdd) {
      await git.add({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
    }
    for (const f of toRemove) {
      await git.remove({ fs: this.fs, dir: this.dir, gitdir: gd, filepath: f });
    }

    // Check if anything was staged
    const matrix2 = await git.statusMatrix({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
    });
    const hasStaged = matrix2.some(([_f, _h, _w, stage]) => stage === 2 || stage === 3);
    if (!hasStaged) return false;

    await git.commit({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      message,
      author: {
        name: "yyObsidianDashboard",
        email: "dashboard@obsidian.local",
      },
    });
    return true;
  }

  async push(
    remote: string,
    branch: string,
    username?: string,
    password?: string,
    _timeoutMinutes?: number
  ): Promise<string> {
    const gd = await this.gitdir();

    const onAuth = username && password
      ? () => ({ username, password })
      : undefined;

    const pushResult: any = await git.push({
      fs: this.fs,
      http: httpClient,
      dir: gd,
      remote,
      ref: `refs/heads/${branch}`,
      remoteRef: `refs/heads/${branch}`,
      onAuth,
    });

    if (pushResult.error) {
      throw new Error(pushResult.error);
    }

    // Sync tracking ref
    try {
      await git.fetch({
        fs: this.fs,
        http: httpClient,
        dir: gd,
        remote,
        ref: `refs/heads/${branch}`,
        singleBranch: true,
        onAuth,
      });
    } catch { /* ignore */ }

    return pushResult.ok ? "推送成功" : "推送失败";
  }

  async pull(
    remote: string,
    branch: string,
    username?: string,
    password?: string,
    _timeoutMinutes?: number
  ): Promise<string> {
    const gd = await this.gitdir();

    const onAuth = username && password
      ? () => ({ username, password })
      : undefined;

    const pullResult: any = await git.pull({
      fs: this.fs,
      http: httpClient,
      dir: this.dir,
      gitdir: gd,
      remote,
      ref: `refs/heads/${branch}`,
      singleBranch: true,
      author: {
        name: "yyObsidianDashboard",
        email: "dashboard@obsidian.local",
      },
      onAuth,
    });

    if (pullResult.error) {
      throw new Error(pullResult.error);
    }

    // Checkout the pulled files into the working tree
    await git.checkout({
      fs: this.fs,
      dir: this.dir,
      gitdir: gd,
      ref: `refs/heads/${branch}`,
    });

    return "拉取完成";
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
    try {
      const gd = await this.gitdir();
      const log = await git.log({ fs: this.fs, dir: gd, depth: n });

      return log.map((entry) => ({
        hash: entry.oid.slice(0, 7),
        message: entry.commit.message,
        date: new Date(entry.commit.committer.timestamp * 1000).toISOString(),
        author: entry.commit.author.name,
      }));
    } catch {
      return [];
    }
  }

  async getCommitFiles(hash: string): Promise<string[]> {
    try {
      const gd = await this.gitdir();
      const oid = await git.resolveRef({ fs: this.fs, dir: gd, ref: hash });
      const { commit: commitObj } = await git.readCommit({ fs: this.fs, dir: gd, oid });

      // For first commit (no parent), list all files in tree
      if (!commitObj.parent || commitObj.parent.length === 0) {
        const files: string[] = [];
        await git.walk({
          fs: this.fs,
          dir: gd,
          trees: [git.TREE({ ref: oid })],
          map: async (filepath, [node]) => {
            if (node) files.push(filepath);
          },
        });
        return files;
      }

      // Diff against first parent
      const parentOid = commitObj.parent[0];
      const parentTree = (await git.readCommit({ fs: this.fs, dir: gd, oid: parentOid })).commit.tree;
      const thisTree = commitObj.tree;

      const files = new Set<string>();

      // Walk current tree
      await git.walk({
        fs: this.fs,
        dir: gd,
        trees: [git.TREE({ ref: thisTree })],
        map: async (filepath, [node]) => {
          if (!node) return;
          // Check if file exists in parent and is the same
          try {
            const parentEntry = await git.walk({
              fs: this.fs,
              dir: gd,
              trees: [git.TREE({ ref: parentTree })],
              map: async (fp, [n]) => {
                if (fp === filepath && n) return n.oid;
              },
            });
            const parentOids: string[] = [];
            if (parentEntry) parentOids.push(parentEntry as any);
            if (parentOids.length === 0 || parentOids[0] !== (node.oid as any)) {
              files.add(filepath);
            }
          } catch {
            files.add(filepath);
          }
        },
      });

      // Also check for files deleted from parent
      await git.walk({
        fs: this.fs,
        dir: gd,
        trees: [git.TREE({ ref: parentTree })],
        map: async (filepath, [node]) => {
          if (!node) return;
          try {
            const entry = await git.walk({
              fs: this.fs,
              dir: gd,
              trees: [git.TREE({ ref: thisTree })],
              map: async (fp, [n]) => {
                if (fp === filepath && n) return n.oid;
              },
            });
            if (!entry) {
              files.add(filepath);
            }
          } catch {
            files.add(filepath);
          }
        },
      });

      return [...files];
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
