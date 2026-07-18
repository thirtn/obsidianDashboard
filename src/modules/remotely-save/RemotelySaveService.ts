import { SyncSession } from "./types";

export class RemotelySaveService {
  private dbName = "remotelysavedb";
  private storeName = "syncplanshistory";

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      try {
        // Open without version to get whatever version exists
        const req = indexedDB.open(this.dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error("无法打开 Remotely Save 数据库"));
        req.onblocked = () => {
          if (req.result) req.result.close();
          reject(new Error("数据库被阻塞，请重试"));
        };
      } catch (e: any) {
        reject(new Error("indexedDB not available: " + e.message));
      }
    });
  }

  async getTotalSyncCount(): Promise<number> {
    let db: IDBDatabase | null = null;
    try {
      db = await this.openDB();
    } catch {
      return 0;
    }
    return new Promise((resolve) => {
      try {
        const tx = db!.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(0);
        tx.onerror = () => resolve(0);
      } catch {
        resolve(0);
      }
    });
  }

  async getSyncHistory(limit: number = 10): Promise<SyncSession[]> {
    let db: IDBDatabase | null = null;
    try {
      db = await this.openDB();
    } catch {
      return [];
    }

    return new Promise((resolve) => {
      try {
        const tx = db!.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const sessions: SyncSession[] = [];

        store.openCursor(null, "prev").onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const record = cursor.value;
            try {
              const plan = typeof record.syncPlan === "string"
                ? JSON.parse(record.syncPlan)
                : record.syncPlan;
              const session = this.parseSyncPlan(record, plan);
              // Include sessions with no changes too — the UI shows a "无变更" badge for them.
              if (session) {
                sessions.push(session);
              }
            } catch { /* skip malformed records */ }

            if (sessions.length >= limit) {
              resolve(sessions);
              return;
            }
            cursor.continue();
          } else {
            resolve(sessions);
          }
        };

        tx.onerror = () => resolve(sessions);
      } catch {
        resolve([]);
      }
    });
  }

  private parseSyncPlan(record: any, plan: any): SyncSession | null {
    if (!plan || typeof plan !== "object") return null;

    const entries = this.extractFileEntries(plan);
    const uploads: string[] = [];
    const downloads: string[] = [];
    const deletions: string[] = [];

    for (const [key, info] of entries) {
      // Only entries where Remotely Save actually performed an operation.
      if (info.change !== true) continue;

      const decision = String(info.decision || "").toLowerCase();
      const category = this.categorize(decision);
      if (category === "upload") uploads.push(key);
      else if (category === "download") downloads.push(key);
      else if (category === "delete") deletions.push(key);
      else uploads.push(key); // Unknown but changed — surface as upload rather than swallowing it
    }

    return {
      ts: record.ts || 0,
      tsFmt: record.tsFmt || "",
      remoteType: record.remoteType || "",
      uploads,
      downloads,
      deletions,
      totalCount: uploads.length + downloads.length + deletions.length,
    };
  }

  /** Map a Remotely Save `decision` enum value to a coarse operation category. */
  private categorize(decision: string): "upload" | "download" | "delete" | "unknown" {
    // Deletion decisions typically contain `del` or `remove`.
    if (/(^|_)del(_|$)|delete|remove|delhist/.test(decision)) return "delete";
    // Upload: local change pushed to remote, or conflict resolved by keeping local.
    if (/push|upload|local_is_modified|local_is_created|keep_local|overwrite_remote/.test(decision)) return "upload";
    // Download: remote change pulled to local, or conflict resolved by keeping remote.
    if (/pull|download|remote_is_modified|remote_is_created|keep_remote|overwrite_local/.test(decision)) return "download";
    return "unknown";
  }

  /** Extract file entries from a sync plan, tolerating multiple Remotely Save formats. */
  private extractFileEntries(plan: any): [string, any][] {
    const results: [string, any][] = [];

    // Prefer known nested containers used by newer Remotely Save versions.
    const nestedKeys = ["mixedStates", "mixedEntities", "syncPlanEntries", "entries"];
    for (const nk of nestedKeys) {
      const nested = plan[nk];
      if (nested && typeof nested === "object" && !Array.isArray(nested)) {
        for (const [k, v] of Object.entries(nested)) {
          if (v && typeof v === "object" && (v as any).decision !== undefined) {
            results.push([this.entryKey(k, v), v]);
          }
        }
        if (results.length > 0) return results;
      }
    }

    // Fallback: legacy flat format — file paths are top-level keys.
    for (const [k, v] of Object.entries(plan)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      if ((v as any).decision === undefined && (v as any).change === undefined) continue;
      results.push([this.entryKey(k, v), v]);
    }
    return results;
  }

  private entryKey(k: string, v: any): string {
    // Prefer the entry's own `key` field if present (newer formats), else fall back to the outer object key.
    if (v && typeof v === "object" && typeof v.key === "string" && v.key) return v.key;
    return k;
  }
}
