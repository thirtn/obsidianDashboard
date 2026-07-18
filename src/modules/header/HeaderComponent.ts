import { App, Modal, requestUrl } from "obsidian";
import { BaseComponent } from "../../shared/BaseComponent";
import { DashboardSettings } from "../../types";
import { LLMService } from "../llm-command/LLMService";
import { ModelConfigModal } from "./ModelConfigModal";
import { getLunarInfo } from "../../utils/lunar";

export class HeaderComponent extends BaseComponent {
  private llmService: LLMService;
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;
  private onRefresh: () => Promise<void>;
  private tokenBarEl: HTMLElement | null = null;
  private clockEl: HTMLElement | null = null;
  private lunarEl: HTMLElement | null = null;
  private clockTimer: number | null = null;

  constructor(
    app: App,
    settings: DashboardSettings,
    llmService: LLMService,
    onSettingsChange: (s: DashboardSettings) => Promise<void>,
    onRefresh: () => Promise<void>
  ) {
    super(app, settings);
    this.llmService = llmService;
    this.onSettingsChange = onSettingsChange;
    this.onRefresh = onRefresh;
  }

  get id(): string { return "header"; }

  async render(container: HTMLElement): Promise<void> {
    const header = container.createDiv("dashboard-header");
    const titleRow = header.createDiv("dashboard-header-title-row");
    titleRow.createEl("h2", { text: this.settings.dashboardTitle || "Dashboard", cls: "dashboard-title" });

    const actions = titleRow.createDiv("dashboard-header-actions");

    if (this.settings.dashboardDesc) {
      header.createDiv({ text: this.settings.dashboardDesc, cls: "dashboard-desc" });
    }

    const refreshBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "刷新" });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.onRefresh());

    const cfgBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "模型配置" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ModelConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
        // the view will call updateSettings which re-renders
      }).open();
    });

    const metaRow = header.createDiv("dashboard-header-meta");
    metaRow.createEl("span", { text: `最后刷新: ${new Date().toLocaleTimeString()}`, cls: "dashboard-refresh-time" });
    const obsVersion = HeaderComponent.getObsidianVersion(this.app);
    if (obsVersion) {
      metaRow.createEl("span", { text: `Obsidian v${obsVersion}`, cls: "dashboard-version-label" });
    }
    this.clockEl = metaRow.createEl("span", {
      text: HeaderComponent.fmtClock(new Date()),
      cls: "dashboard-clock",
    });
    this.lunarEl = metaRow.createEl("span", {
      text: HeaderComponent.fmtLunar(new Date()),
      cls: "dashboard-lunar",
    });
    this.startClock();

    this.renderTokenBar(header);
  }

  private startClock() {
    if (this.clockTimer !== null) window.clearInterval(this.clockTimer);
    let lastLunarKey = "";
    this.clockTimer = window.setInterval(() => {
      if (!this.clockEl || !this.clockEl.isConnected) {
        if (this.clockTimer !== null) {
          window.clearInterval(this.clockTimer);
          this.clockTimer = null;
        }
        return;
      }
      const now = new Date();
      this.clockEl.textContent = HeaderComponent.fmtClock(now);
      // Refresh lunar/shichen only when the hour or date changes.
      const key = `${now.toDateString()}#${now.getHours()}`;
      if (this.lunarEl && key !== lastLunarKey) {
        this.lunarEl.textContent = HeaderComponent.fmtLunar(now);
        lastLunarKey = key;
      }
    }, 1000);
  }

  destroy(): void {
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    this.clockEl = null;
    this.lunarEl = null;
    super.destroy();
  }

  private static fmtLunar(d: Date): string {
    const info = getLunarInfo(d);
    return `${info.ganzhiYear}${info.zodiac}年·农历${info.lunarMonth}${info.lunarDay}·${info.shichen}`;
  }

  private static fmtClock(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const w = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    return `${y}-${m}-${day} 周${w} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  private renderTokenBar(header: HTMLElement) {
    const bar = header.createDiv("dashboard-header-token");
    this.tokenBarEl = bar;

    let today = 0, thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = HeaderComponent.fmtDate(new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = store[todayStr] ?? 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix)) thisMonth += tokens;
      }
    } catch { /* ignore */ }

    const makeChip = (label: string, value: string) => {
      const chip = bar.createDiv("dashboard-token-chip");
      chip.createEl("span", { text: label, cls: "dashboard-token-chip-label" });
      chip.createEl("span", { text: value, cls: "dashboard-token-chip-value" });
    };
    makeChip("今日", `${today.toLocaleString()} tokens`);
    makeChip("本月", `${thisMonth.toLocaleString()} tokens`);

    if (this.settings.tokenBalanceApiUrl && this.settings.apiKey) {
      (async () => {
        try {
          const resp = await requestUrl({
            url: this.settings.tokenBalanceApiUrl,
            method: "GET",
            headers: { Authorization: `Bearer ${this.settings.apiKey}` },
            throw: false,
          });
          if (resp.status === 200 && resp.json?.balance_infos) {
            for (const item of resp.json.balance_infos) {
              makeChip(`余额(${item.currency})`, item.total_balance);
            }
          }
        } catch { /* ignore */ }
      })();
    }
  }

  async refreshTokenBar() {
    const bar = this.tokenBarEl;
    if (!bar || !bar.isConnected) return;
    let today = 0, thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = HeaderComponent.fmtDate(new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = store[todayStr] ?? 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix)) thisMonth += tokens;
      }
    } catch { /* ignore */ }
    const chips = bar.querySelectorAll(".dashboard-token-chip-value");
    if (chips.length >= 2) {
      (chips[0] as HTMLElement).textContent = `${today.toLocaleString()} tokens`;
      (chips[1] as HTMLElement).textContent = `${thisMonth.toLocaleString()} tokens`;
    }
  }

  private loadLocalTokenStore(): Record<string, number> {
    try {
      const raw = localStorage.getItem("llm-wiki-dashboard-token-usage");
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  static fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  static getObsidianVersion(app: App): string {
    try {
      const a = app as any;
      if (typeof a.version === 'string') return a.version;
      if (typeof a.appVersion === 'string') return a.appVersion;
      const ua = navigator.userAgent;
      const m = ua.match(/[Oo]bsidian\/([\d.]+)/);
      if (m) return m[1];
      const w = window as any;
      if (w.electronRemote?.app?.getVersion) return w.electronRemote.app.getVersion();
      return "";
    } catch { return ""; }
  }
}
