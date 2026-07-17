import { App } from "obsidian";
import { HeatmapData } from "../types";
import { VaultPersistenceService } from "./VaultPersistenceService";

const HEATMAP_KEY = "llm-wiki-dashboard-heatmap";

export class HeatmapService {
  private unregister: (() => void) | null = null;
  private persistence: VaultPersistenceService;
  private vaultPath: string;
  private cache: HeatmapData | null = null;

  constructor(
    private app: App,
    vaultPath?: string
  ) {
    this.persistence = new VaultPersistenceService(app);
    this.vaultPath = vaultPath || ".dashboard/heatmap.json";
  }

  startTracking() {
    let pending: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        this.recordActivity();
      }, 300);
    };
    const vault = this.app.vault;
    vault.on("modify", handler);
    vault.on("create", handler);
    vault.on("rename", handler);
    this.unregister = () => {
      if (pending) { clearTimeout(pending); pending = null; }
      vault.off("modify", handler);
      vault.off("create", handler);
      vault.off("rename", handler);
    };
  }

  stopTracking() {
    this.unregister?.();
    this.unregister = null;
  }

  recordActivity(count = 1) {
    const data = this.loadSync();
    const today = this.todayStr();
    data[today] = (data[today] ?? 0) + count;

    // Write to localStorage (sync, fast)
    localStorage.setItem(HEATMAP_KEY, JSON.stringify(data));
    this.cache = data;

    // Write to vault file (async, fire-and-forget)
    this.persistence.writeJSON(this.vaultPath, data).catch(() => {});
  }

  async getData(): Promise<HeatmapData> {
    if (this.cache) return this.cache;
    // Try vault file first, then localStorage, then migrate
    const vaultData = await this.persistence.readJSON<HeatmapData>(this.vaultPath);
    const localData = this.loadSync();
    if (vaultData) {
      this.cache = vaultData;
      // Merge any localStorage-only entries into cache
      let merged = false;
      for (const [date, count] of Object.entries(localData)) {
        if (!(date in vaultData) || localData[date] > (vaultData[date] ?? 0)) {
          (vaultData as any)[date] = count;
          merged = true;
        }
      }
      if (merged) {
        this.cache = vaultData;
        localStorage.setItem(HEATMAP_KEY, JSON.stringify(vaultData));
        this.persistence.writeJSON(this.vaultPath, vaultData).catch(() => {});
      }
    } else {
      // No vault data, migrate localStorage → vault
      this.cache = localData;
      this.persistence.writeJSON(this.vaultPath, localData).catch(() => {});
    }
    return this.cache;
  }

  getDataSync(): HeatmapData {
    return this.loadSync();
  }

  getMonthData(year: number, month: number): HeatmapData {
    const all = this.loadSync();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const result: HeatmapData = {};
    for (const [date, count] of Object.entries(all)) {
      if (date.startsWith(prefix)) result[date] = count;
    }
    return result;
  }

  private loadSync(): HeatmapData {
    try {
      const raw = localStorage.getItem(HEATMAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}
