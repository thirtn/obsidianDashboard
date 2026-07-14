export interface SyncSession {
  ts: number;
  tsFmt: string;
  remoteType: string;
  uploads: string[];
  downloads: string[];
  deletions: string[];
  totalCount: number;
}

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
          console.log("[yyDashboard] RS DB blocked — closing and retrying");
          // Close any existing connections and retry
          if (req.result) req.result.close();
          reject(new Error("数据库被阻塞，请重试"));
        };
      } catch (e: any) {
        reject(new Error("indexedDB not available: " + e.message));
      }
    });
  }

  async getSyncHistory(limit: number = 10): Promise<SyncSession[]> {
    let db: IDBDatabase | null = null;
    try {
      db = await this.openDB();
    } catch (e: any) {
      console.log("[yyDashboard] Remotely Save DB not available:", e.message);
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
              if (session && session.totalCount > 0) {
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
      } catch (e: any) {
        console.log("[yyDashboard] Error reading sync history:", e.message);
        resolve([]);
      }
    });
  }

  private parseSyncPlan(record: any, plan: any): SyncSession | null {
    if (!plan || typeof plan !== "object") return null;

    const uploads: string[] = [];
    const downloads: string[] = [];
    const deletions: string[] = [];

    for (const [key, info] of Object.entries(plan) as [string, any][]) {
      if (!info || typeof info !== "object") continue;

      const decision: string = info.decision || "";
      const changed = info.change === true;

      if (!changed) continue;

      if (decision.startsWith("upload")) {
        uploads.push(key);
      } else if (decision.startsWith("download")) {
        downloads.push(key);
      } else if (decision.startsWith("delete") || decision.startsWith("remove")) {
        deletions.push(key);
      } else if (decision === "keepRemote" || decision === "overwrite") {
        downloads.push(key);
      } else if (decision === "keepLocal" || decision === "overwriteRemote") {
        uploads.push(key);
      } else if (changed && key) {
        // Catch any other changed files
        uploads.push(key);
      }
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
}
