import { App, TFile, TFolder } from "obsidian";

export class VaultPersistenceService {
  constructor(private app: App) {}

  async readJSON<T>(path: string): Promise<T | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return null;
      const raw = await this.app.vault.read(file);
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async writeJSON<T>(path: string, data: T): Promise<void> {
    try {
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
        // Ensure parent directories exist
        const segs = dir.split("/");
        let acc = "";
        for (const seg of segs) {
          acc += (acc ? "/" : "") + seg;
          if (!this.app.vault.getAbstractFileByPath(acc)) {
            try { await this.app.vault.createFolder(acc); } catch { /* race */ }
          }
        }
      }
      const file = this.app.vault.getAbstractFileByPath(path);
      const json = JSON.stringify(data, null, 2);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, json);
      } else {
        await this.app.vault.create(path, json);
      }
    } catch { /* silently ignore persistence failures */ }
  }

  getLocalStore<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : fallback;
    } catch {
      return fallback;
    }
  }

  setLocalStore<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch { /* ignore */ }
  }
}
