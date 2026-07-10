import { App, TFile } from "obsidian";
import { HeatmapData } from "../types";

const HEATMAP_KEY = "llm-wiki-dashboard-heatmap";

export class HeatmapService {
  private unregister: (() => void) | null = null;

  constructor(private app: App) {}

  startTracking() {
    const handler = () => this.recordActivity();
    this.app.vault.on("modify", handler);
    this.unregister = () => this.app.vault.off("modify", handler);
  }

  stopTracking() {
    this.unregister?.();
    this.unregister = null;
  }

  recordActivity(count = 1) {
    const data = this.load();
    const today = this.todayStr();
    data[today] = (data[today] ?? 0) + count;
    localStorage.setItem(HEATMAP_KEY, JSON.stringify(data));
  }

  getData(): HeatmapData {
    return this.load();
  }

  getMonthData(year: number, month: number): HeatmapData {
    const all = this.load();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const result: HeatmapData = {};
    for (const [date, count] of Object.entries(all)) {
      if (date.startsWith(prefix)) result[date] = count;
    }
    return result;
  }

  private load(): HeatmapData {
    try {
      const raw = localStorage.getItem(HEATMAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
