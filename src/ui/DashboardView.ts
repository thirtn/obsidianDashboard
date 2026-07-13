import { ItemView, WorkspaceLeaf, TFile, Notice, requestUrl, Modal } from "obsidian";
import { DashboardSettings, FileStats, TokenUsage } from "../types";
import { FileService, RecentFile } from "../services/FileService";
import { LogService } from "../services/LogService";
import { LLMService } from "../services/LLMService";
import { PluginManageService } from "../services/PluginManageService";
import { HeatmapService } from "../services/HeatmapService";
import { ModelConfigModal } from "../modals/ModelConfigModal";
import { FolderConfigModal } from "../modals/FolderConfigModal";
import { ReportConfigModal } from "../modals/ReportConfigModal";

export const DASHBOARD_VIEW_TYPE = "yy-obsidian-dashboard";

export class DashboardView extends ItemView {
  private settings: DashboardSettings;
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;

  private fileService: FileService;
  private logService: LogService;
  private llmService: LLMService;
  private pluginService: PluginManageService;
  private heatmapService: HeatmapService;

  private executing = false;
  private currentHeatmapYear = new Date().getFullYear();
  private autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private onVaultChange?: (file: any) => void;
  private onActiveLeafChange?: (leaf: WorkspaceLeaf) => void;
  private lastRenderTime = 0;
  private visibilityTimer: ReturnType<typeof setInterval> | null = null;
  private readonly AUTO_REFRESH_COOLDOWN = 5 * 60 * 1000; // 5 min cooldown between auto-refreshes
  private readonly VISIBILITY_CHECK_INTERVAL = 30 * 60 * 1000; // 30 min periodic check

  constructor(
    leaf: WorkspaceLeaf,
    settings: DashboardSettings,
    onSettingsChange: (s: DashboardSettings) => Promise<void>
  ) {
    super(leaf);
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
    this.fileService = new FileService(this.app);
    this.logService = new LogService(this.app);
    this.llmService = new LLMService(settings);
    this.pluginService = new PluginManageService(this.app);
    this.heatmapService = new HeatmapService(this.app);
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return "yyObsidianDashboard"; }
  getIcon() { return "layout-dashboard"; }

  updateSettings(settings: DashboardSettings) {
    this.settings = settings;
    this.llmService.updateSettings(settings);
  }

  async onOpen() {
    this.heatmapService.startTracking();

    // Debounced auto-refresh recent files & file stats on vault changes
    this.onVaultChange = () => {
      if (this.autoRefreshTimer) clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = setTimeout(() => {
        const recentContainer = document.getElementById("dashboard-recent-container");
        if (recentContainer) this.renderRecentFiles(recentContainer);
        const statsContainer = document.getElementById("dashboard-file-stats-container");
        if (statsContainer) this.renderFileStats(statsContainer);
      }, 800);
    };
    this.app.vault.on("modify", this.onVaultChange);
    this.app.vault.on("create", this.onVaultChange);
    this.app.vault.on("delete", this.onVaultChange);
    this.app.vault.on("rename", this.onVaultChange);

    // Auto-refresh when user switches back to this dashboard tab
    this.onActiveLeafChange = (leaf: WorkspaceLeaf) => {
      if (leaf.view !== this) return;
      const elapsed = Date.now() - this.lastRenderTime;
      if (elapsed > this.AUTO_REFRESH_COOLDOWN) {
        this.render();
      }
    };
    this.app.workspace.on("active-leaf-change", this.onActiveLeafChange);

    // Periodic fallback: refresh if view is visible and data might be stale
    this.visibilityTimer = setInterval(() => {
      if (this.app.workspace.activeLeaf?.view === this) {
        const elapsed = Date.now() - this.lastRenderTime;
        if (elapsed > this.VISIBILITY_CHECK_INTERVAL) {
          this.render();
        }
      }
    }, this.VISIBILITY_CHECK_INTERVAL);

    await this.render();
  }

  async onClose() {
    this.heatmapService.stopTracking();
    if (this.onVaultChange) {
      this.app.vault.off("modify", this.onVaultChange);
      this.app.vault.off("create", this.onVaultChange);
      this.app.vault.off("delete", this.onVaultChange);
      this.app.vault.off("rename", this.onVaultChange);
    }
    if (this.onActiveLeafChange) {
      this.app.workspace.off("active-leaf-change", this.onActiveLeafChange);
    }
    if (this.autoRefreshTimer) clearTimeout(this.autoRefreshTimer);
    if (this.visibilityTimer) clearInterval(this.visibilityTimer);
  }

  async render() {
    this.lastRenderTime = Date.now();
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("dashboard-root");

    await this.renderHeader(container);
    this.renderSearch(container);
    const scroll = container.createDiv("dashboard-scroll");
    await this.renderModule1(scroll);
    this.renderModule5(scroll);
    this.renderModule4(scroll);
    this.renderModule6(scroll);
    this.renderTaskQuickAdd(scroll);
  }

  // ─── Header ────────────────────────────────────────────────────────────────

  private async renderHeader(parent: HTMLElement) {
    const header = parent.createDiv("dashboard-header");
    const titleRow = header.createDiv("dashboard-header-title-row");
    titleRow.createEl("h2", { text: "yyObsidianDashboard", cls: "dashboard-title" });

    const actions = titleRow.createDiv("dashboard-header-actions");

    const refreshBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "刷新" });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.render());

    const cfgBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "模型配置" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ModelConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }).open();
    });

    const metaRow = header.createDiv("dashboard-header-meta");
    metaRow.createEl("span", { text: `最后刷新: ${new Date().toLocaleTimeString()}`, cls: "dashboard-refresh-time" });
    const obsVersion = this.getObsidianVersion();
    if (obsVersion) {
      metaRow.createEl("span", { text: `Obsidian v${obsVersion}`, cls: "dashboard-version-label" });
    }

    await this.renderHeaderTokenUsage(header);
  }

  private async renderHeaderTokenUsage(header: HTMLElement) {
    const bar = header.createDiv("dashboard-header-token");
    bar.setAttribute("id", "dashboard-token-bar");

    // Local token stats
    let today = 0;
    let thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = this.fmtDate(new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = store[todayStr] ?? 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix)) thisMonth += tokens;
      }
    } catch { /* ignore */ }

    // Balance API
    let balanceInfo: import("../types").BalanceItem[] | null = null;
    if (this.settings.tokenBalanceApiUrl && this.settings.apiKey) {
      try {
        const resp = await requestUrl({
          url: this.settings.tokenBalanceApiUrl,
          method: "GET",
          headers: { Authorization: `Bearer ${this.settings.apiKey}` },
          throw: false,
        });
        if (resp.status === 200 && resp.json?.balance_infos) {
          balanceInfo = resp.json.balance_infos;
        }
      } catch { /* ignore */ }
    }

    const makeChip = (label: string, value: string) => {
      const chip = bar.createDiv("dashboard-token-chip");
      chip.createEl("span", { text: label, cls: "dashboard-token-chip-label" });
      chip.createEl("span", { text: value, cls: "dashboard-token-chip-value" });
    };

    makeChip("今日", `${today.toLocaleString()} tokens`);
    makeChip("本月", `${thisMonth.toLocaleString()} tokens`);

    if (balanceInfo && balanceInfo.length > 0) {
      for (const item of balanceInfo) {
        makeChip(`余额(${item.currency})`, item.total_balance);
      }
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  private renderSearch(parent: HTMLElement) {
    const searchWrap = parent.createDiv("dashboard-search-wrap");
    const searchInput = searchWrap.createEl("input", {
      cls: "dashboard-search-input",
      placeholder: "搜索笔记...",
    }) as HTMLInputElement;

    const resultDropdown = searchWrap.createDiv("dashboard-search-dropdown");
    resultDropdown.style.display = "none";

    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    const fuzzyMatch = (path: string, query: string): boolean => {
      const lowerPath = path.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let qi = 0;
      for (let pi = 0; pi < lowerPath.length && qi < lowerQuery.length; pi++) {
        if (lowerPath[pi] === lowerQuery[qi]) qi++;
      }
      return qi === lowerQuery.length;
    };

    const doSearch = () => {
      const q = searchInput.value.trim();
      if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }

      if (!q) {
        resultDropdown.empty();
        resultDropdown.style.display = "none";
        return;
      }

      const files = this.app.vault.getFiles()
        .filter(f => f.extension === "md" && fuzzyMatch(f.path, q))
        .slice(0, 8);

      resultDropdown.empty();

      if (files.length === 0) {
        resultDropdown.style.display = "none";
        return;
      }

      for (const file of files) {
        const item = resultDropdown.createDiv("dashboard-search-item");
        const nameEl = item.createEl("span", { text: file.basename, cls: "dashboard-search-item-name" });
        item.createEl("span", { text: file.path, cls: "dashboard-search-item-path" });

        item.addEventListener("mousedown", async (e) => {
          e.preventDefault();
          resultDropdown.style.display = "none";
          searchInput.value = "";
          await this.app.workspace.getLeaf(false).openFile(file);
        });
      }

      resultDropdown.style.display = "block";
    };

    searchInput.addEventListener("input", doSearch);
    searchInput.addEventListener("focus", doSearch);

    searchInput.addEventListener("blur", () => {
      blurTimer = setTimeout(() => {
        resultDropdown.style.display = "none";
      }, 200);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        resultDropdown.style.display = "none";
        searchInput.blur();
      } else if (e.key === "Enter") {
        const firstItem = resultDropdown.querySelector(".dashboard-search-item") as HTMLElement;
        if (firstItem) firstItem.click();
      }
    });
  }

  private loadLocalTokenStore(): Record<string, number> {
    try {
      const raw = localStorage.getItem("llm-wiki-dashboard-token-usage");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private async refreshTokenBar() {
    const bar = document.getElementById("dashboard-token-bar");
    if (!bar) return;

    let today = 0;
    let thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = this.fmtDate(new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = store[todayStr] ?? 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix)) thisMonth += tokens;
      }
    } catch { /* ignore */ }

    // Find existing chips or create new ones
    const chips = bar.querySelectorAll(".dashboard-token-chip-value");
    if (chips.length >= 2) {
      (chips[0] as HTMLElement).textContent = `${today.toLocaleString()} tokens`;
      (chips[1] as HTMLElement).textContent = `${thisMonth.toLocaleString()} tokens`;
    }
  }

  // ─── Module 1: File Stats ───────────────────────────────────────────────────

  private async renderModule1(parent: HTMLElement) {
    const mod = parent.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    header.createEl("span", { text: "📁 文件统计", cls: "dashboard-module-title" });
    const addBtn = header.createEl("button", { cls: "dashboard-icon-btn", title: "增加文件统计" });
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.addEventListener("click", () => {
      new FolderConfigModal(this.app, this.settings, this.fileService, async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
        await this.render();
      }).open();
    });

    const body = mod.createDiv("dashboard-module-body");

    // File stats (auto-refreshable portion)
    const statsContainer = body.createDiv({ attr: { id: "dashboard-file-stats-container" } });
    await this.renderFileStats(statsContainer);

    // ── Recently modified files ────────────────────────────────────────
    const recentContainer = body.createDiv({ cls: "dashboard-recent-section", attr: { id: "dashboard-recent-container" } });
    this.renderRecentFiles(recentContainer);
  }

  private async renderFileStats(container: HTMLElement) {
    container.empty();

    let stats: FileStats;
    try {
      stats = await this.fileService.getStats(this.settings.trackedFolders);
    } catch {
      container.createDiv({ text: "加载失败", cls: "dashboard-error" });
      return;
    }

    const totalRow = container.createDiv("dashboard-stat-total");
    totalRow.createEl("span", { text: "Vault 总文件" });
    totalRow.createEl("strong", { text: String(stats.total) });

    if (stats.folderStats.length > 0) {
      const maxCount = Math.max(...stats.folderStats.map((f) => f.count), 1);
      const list = container.createDiv("dashboard-folder-list");
      for (const fs of stats.folderStats) {
        const row = list.createDiv("dashboard-folder-row");
        const nameEl = row.createEl("span", { text: fs.name, cls: "dashboard-folder-row-name", title: fs.name });
        nameEl.addEventListener("click", () => {
          this.fileService.toggleFolderInExplorer(fs.name);
        });
        const barWrap = row.createDiv("dashboard-folder-row-bar-wrap");
        const fill = barWrap.createDiv("dashboard-folder-row-bar-fill");
        fill.style.width = `${Math.round((fs.count / maxCount) * 100)}%`;
        row.createEl("span", { text: String(fs.count), cls: "dashboard-folder-row-count" });
      }
    }

    const anomaly = container.createDiv("dashboard-anomaly-row");
    this.createBadge(anomaly, `⚠ 孤立 ${stats.orphanCount}`, stats.orphanCount > 0 ? "warn" : "ok", `孤立页面（${stats.orphanCount}）`, stats.orphanFiles);
    this.createBadge(anomaly, `⚠ 无来源 ${stats.nosourceCount}`, stats.nosourceCount > 0 ? "warn" : "ok", `无来源页面（${stats.nosourceCount}）`, stats.nosourceFiles);
    this.createBadge(anomaly, `⚠ 空白 ${stats.emptyCount}`, stats.emptyCount > 0 ? "warn" : "ok", `空白页面（${stats.emptyCount}）`, stats.emptyFilesList);

    const health = container.createDiv("dashboard-health");
    const healthLabel = health.createDiv("dashboard-health-label");
    healthLabel.createEl("span", { text: "健康度" });
    healthLabel.createEl("strong", { text: `${stats.healthScore}分（孤立占40% + 无来源占30% + 空白占30%）` });
    const healthBar = health.createDiv("dashboard-health-track");
    const healthFill = healthBar.createDiv("dashboard-health-fill");
    healthFill.style.width = `${stats.healthScore}%`;
    healthFill.style.background = stats.healthScore >= 80
      ? "var(--color-green)"
      : stats.healthScore >= 50 ? "var(--color-yellow)" : "var(--color-red)";

  }

  private renderRecentFiles(container: HTMLElement) {
    container.empty();
    const recentFiles = this.fileService.getRecentlyModified(5);
    if (recentFiles.length === 0) return;

    container.createEl("span", { text: "最近修改", cls: "dashboard-recent-title" });
    const list = container.createDiv("dashboard-recent-list");
    for (const rf of recentFiles) {
      const row = list.createDiv("dashboard-recent-row");
      const nameEl = row.createEl("span", { text: rf.path, cls: "dashboard-recent-path", title: rf.path });
      nameEl.addEventListener("click", () => {
        const f = this.app.vault.getAbstractFileByPath(rf.path);
        if (f instanceof TFile) this.app.workspace.getLeaf(false).openFile(f);
      });
      row.createEl("span", { text: this.formatRelativeTime(rf.mtime), cls: "dashboard-recent-time" });
    }
  }

  // ─── Module 3: Operation Log ───────────────────────────────────────────────

  // ─── Module 4: LLM Command ────────────────────────────────────────────────

  private renderModule4(parent: HTMLElement) {
    const mod = this.createModule(parent, "⚡", "LLM 指令执行");
    const body = mod.createDiv("dashboard-module-body");

    const commandSelect = body.createEl("select", { cls: "dashboard-select" }) as HTMLSelectElement;
    for (const cmd of ["query", "ingest", "lint-wiki"]) {
      commandSelect.createEl("option", { value: cmd, text: cmd });
    }

    const placeholders: Record<string, string> = {
      query: "请输入查询问题...",
      ingest: "请粘贴需要处理的原始内容...",
      "lint-wiki": "请粘贴需要检查的 wiki 内容...",
    };

    const inputArea = body.createEl("textarea", {
      cls: "dashboard-cmd-input",
    } as any) as HTMLTextAreaElement;
    inputArea.placeholder = placeholders["query"];

    commandSelect.addEventListener("change", () => {
      inputArea.placeholder = placeholders[commandSelect.value] ?? "请输入内容...";
    });

    const execBtn = body.createEl("button", { text: "▶ 执行", cls: "mod-cta dashboard-exec-btn" });
    const resultEl = body.createEl("pre", { cls: "dashboard-result-pre" });
    resultEl.textContent = "（执行结果将显示在此处）";

    const resultActions = body.createDiv("dashboard-result-actions");
    resultActions.style.display = "none";
    const exportBtn = resultActions.createEl("button", { text: "导出到 outputs", cls: "dashboard-link-btn" });

    const errorEl = body.createDiv("dashboard-exec-error");
    errorEl.style.display = "none";

    execBtn.addEventListener("click", async () => {
      if (this.executing) return;
      const input = inputArea.value.trim();
      if (!input) { new Notice("请输入内容"); return; }
      if (!this.settings.apiKey) { new Notice("请先配置 API Key"); return; }

      this.executing = true;
      execBtn.disabled = true;
      execBtn.textContent = "执行中...";
      errorEl.style.display = "none";
      resultEl.textContent = "";
      resultActions.style.display = "none";

      try {
        const result = await this.llmService.executeCommand(
          commandSelect.value as "ingest" | "query" | "lint-wiki",
          input
        );
        resultEl.textContent = result;
        resultActions.style.display = "";

        // Write operation log
        const logType = commandSelect.value === "lint-wiki" ? "lint"
          : commandSelect.value as "ingest" | "query";
        this.logService.writeLog(logType, input.slice(0, 80));

        exportBtn.onclick = async () => {
          const filename = `outputs/${commandSelect.value}-${Date.now()}.md`;
          try {
            await this.app.vault.create(filename, result);
          } catch {
            await this.app.vault.adapter.mkdir("outputs");
            await this.app.vault.create(filename, result);
          }
          new Notice(`已导出到 ${filename}`);
        };
      } catch (e: any) {
        errorEl.textContent = `⚠ ${e.message}`;
        errorEl.style.display = "";
      } finally {
        this.executing = false;
        execBtn.disabled = false;
        execBtn.textContent = "▶ 执行";
        this.refreshTokenBar();
      }
    });
  }

  // ─── Module 5: Heatmap ───────────────────────────────────────────────────

  private renderModule5(parent: HTMLElement) {
    const mod = parent.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    header.createEl("span", { text: "🗓 工作热力图", cls: "dashboard-module-title" });

    const yearNav = header.createDiv("dashboard-heatmap-year-nav");
    const prevBtn = yearNav.createEl("span", { text: "◀", cls: "dashboard-heatmap-year-arrow" });
    const yearLabel = yearNav.createEl("span", { text: String(this.currentHeatmapYear), cls: "dashboard-heatmap-year-label clickable" });
    yearLabel.addEventListener("click", () => {
      if (this.settings.reportConfigs.yearly.enabled) {
        this.openOrCreateReport("yearly", new Date(this.currentHeatmapYear, 0, 1));
      }
    });
    const nextBtn = yearNav.createEl("span", { text: "▶", cls: "dashboard-heatmap-year-arrow" });

    // Config button with gear icon
    const cfgBtn = yearNav.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "日报/周报配置" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ReportConfigModal(this.app, this.settings.reportConfigs, async (configs) => {
        this.settings.reportConfigs = configs;
        await this.onSettingsChange(this.settings);
      }).open();
    });

    const thisYear = new Date().getFullYear();
    if (this.currentHeatmapYear >= thisYear) nextBtn.addClass("disabled");

    prevBtn.addEventListener("click", () => {
      this.currentHeatmapYear--;
      this.render();
    });
    nextBtn.addEventListener("click", () => {
      if (this.currentHeatmapYear < thisYear) {
        this.currentHeatmapYear++;
        this.render();
      }
    });

    const body = mod.createDiv("dashboard-module-body");
    const now = new Date();
    const todayStr = this.fmtDate(now);
    const data = this.heatmapService.getData();
    const maxVal = Math.max(...Object.values(data), 1);
    const year = this.currentHeatmapYear;

    const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

    const mainWrap = body.createDiv("dashboard-heatmap-main-wrap");

    // Day labels column (with spacer to align past month labels)
    const dayCol = mainWrap.createDiv("dashboard-heatmap-days");
    dayCol.createDiv({ cls: "dashboard-heatmap-days-spacer" });
    for (const d of DAYS) {
      dayCol.createDiv({ text: d, cls: "dashboard-heatmap-day-label" });
    }

    // Months container
    const monthsWrap = mainWrap.createDiv("dashboard-heatmap-months-wrap");

    for (let m = 0; m < 12; m++) {
      const monthBlock = monthsWrap.createDiv("dashboard-heatmap-month-block");

      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      // Month label - clickable → monthly report
      const monthLabel = monthBlock.createDiv({ text: MONTHS[m], cls: "dashboard-heatmap-month-label clickable" });
      monthLabel.addEventListener("click", () => {
        if (this.settings.reportConfigs.monthly.enabled) {
          this.openOrCreateReport("monthly", new Date(year, m, 1));
        }
      });

      // Compute alignment offset for the 1st day of the month
      const firstDay = new Date(year, m, 1);
      const firstDow = firstDay.getDay();
      const startOffset = firstDow === 0 ? 6 : firstDow - 1;
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      // Mini grid for this month
      const grid = monthBlock.createDiv("dashboard-heatmap-grid");

      // Empty placeholder cells before the 1st for weekday alignment
      for (let p = 0; p < startOffset; p++) {
        grid.createDiv({ cls: "dashboard-heatmap-cell future" });
      }

      // Actual day cells (1st through last day, no adjacent-month days)
      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, m, day);
        const dateStr = this.fmtDate(cellDate);
        const val = data[dateStr] ?? 0;
        const intensity = val === 0 ? 0 : Math.ceil((val / maxVal) * 4);
        const isToday = dateStr === todayStr;
        const isFuture = cellDate > now;

        const cell = grid.createDiv({
          cls: [
            "dashboard-heatmap-cell",
            `level-${intensity}`,
            isToday ? "today" : "",
            isFuture ? "future" : "",
          ].filter(Boolean).join(" "),
        });

        if (!isFuture) {
          cell.style.cursor = "pointer";
          let tip: HTMLElement | null = null;
          cell.addEventListener("mouseenter", () => {
            const rect = cell.getBoundingClientRect();
            tip = document.body.createDiv("dashboard-heatmap-tip");
            tip.textContent = `${dateStr}: ${val} 次操作`;
            tip.style.top = `${rect.top - 28}px`;
            tip.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;
          });
          cell.addEventListener("mouseleave", () => {
            tip?.remove();
            tip = null;
          });
          cell.addEventListener("click", () => this.openOrCreateReport("daily", cellDate));
        }
      }
    }

    // Legend + stats row
    const legendRow = body.createDiv("dashboard-heatmap-legend-row");
    const legend = legendRow.createDiv("dashboard-heatmap-legend");
    legend.createEl("span", { text: "少", cls: "dashboard-heatmap-legend-label" });
    for (let i = 0; i <= 4; i++) {
      legend.createDiv({ cls: `dashboard-heatmap-cell level-${i} legend-cell` });
    }
    legend.createEl("span", { text: "多", cls: "dashboard-heatmap-legend-label" });

    // Summary stats
    const isCurrentYear = year === new Date().getFullYear();
    const statsRow = legendRow.createDiv("dashboard-heatmap-stats");
    if (isCurrentYear) {
      const now2 = new Date();
      const startOfWeek = new Date(now2);
      startOfWeek.setDate(now2.getDate() - ((now2.getDay() + 6) % 7));
      const startOfMonth = new Date(now2.getFullYear(), now2.getMonth(), 1);
      const startOfYear = new Date(year, 0, 1);
      let weekCount = 0, monthCount = 0, yearCount = 0;
      for (const [d, c] of Object.entries(data)) {
        if (d >= this.fmtDate(startOfWeek)) weekCount += c;
        if (d >= this.fmtDate(startOfMonth)) monthCount += c;
        if (d >= this.fmtDate(startOfYear)) yearCount += c;
      }
      statsRow.createEl("span", { text: `本周 ${weekCount} 次` });
      statsRow.createEl("span", { text: `本月 ${monthCount} 次` });
      statsRow.createEl("span", { text: `今年 ${yearCount} 次` });
    } else {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      const endOfYearStr = this.fmtDate(endOfYear);
      let yearCount = 0;
      for (const [d, c] of Object.entries(data)) {
        if (d >= this.fmtDate(startOfYear) && d < endOfYearStr) yearCount += c;
      }
      statsRow.createEl("span", { text: `${year} 年 ${yearCount} 次` });
    }
  }

  private resolveReportPath(type: "daily"|"weekly"|"monthly"|"quarterly"|"yearly", date: Date): string {
    const cfg = this.settings.reportConfigs[type];
    const relPath = this.formatMomentDate(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, '');
    return dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
  }

  private REPORT_NAMES: Record<string, string> = {
    daily: "日报", weekly: "周报", monthly: "月报", quarterly: "季报", yearly: "年报",
  };

  private async openOrCreateReport(type: "daily"|"weekly"|"monthly"|"quarterly"|"yearly", date: Date) {
    const cfg = this.settings.reportConfigs[type];
    const path = this.resolveReportPath(type, date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }

    const doCreate = async () => {
      let content = "";
      if (cfg.templatePath) {
        const tpl = this.app.vault.getAbstractFileByPath(`${cfg.templatePath}.md`);
        if (tpl instanceof TFile) content = this.formatMomentDate(date, await this.app.vault.read(tpl));
      }
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try { await this.app.vault.createFolder(acc); } catch { /* race */ }
        }
      }
      const created = await this.app.vault.create(path, content);
      await this.app.workspace.getLeaf(false).openFile(created);
    };

    if (cfg.confirmBeforeCreate) {
      const name = this.REPORT_NAMES[type];
      new (class extends Modal {
        onOpen() {
          this.contentEl.createEl("p", { text: `${name}不存在，是否新建？` });
          this.contentEl.createEl("p", { text: path, cls: "dashboard-field-hint" });
          const btns = this.contentEl.createDiv("dashboard-confirm-btns");
          btns.createEl("button", { text: "新建", cls: "mod-cta" }).addEventListener("click", async () => {
            this.close();
            try { await doCreate(); } catch (e: any) { new Notice(`创建失败: ${e.message}`); }
          });
          btns.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
        }
        onClose() { this.contentEl.empty(); }
      })(this.app).open();
    } else {
      try { await doCreate(); } catch (e: any) { new Notice(`创建${this.REPORT_NAMES[type]}失败: ${e.message}`); }
    }
  }

  private fmtDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private formatMomentDate(date: Date, format: string): string {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());

    // ISO week number
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7));

    // Quarter
    const Q = String(Math.floor(date.getMonth() / 3) + 1);

    // Replace bracket literals [X] first
    let result = format.replace(/\[([^\]]+)\]/g, "$1");

    // Replace tokens (longer ones first)
    result = result
      .replace(/YYYY/g, y)
      .replace(/YY/g, y.slice(2))
      .replace(/MM/g, m.padStart(2, '0'))
      .replace(/DD/g, d.padStart(2, '0'))
      .replace(/ww/g, w.padStart(2, '0'))
      .replace(/M/g, m)
      .replace(/D/g, d)
      .replace(/w/g, w)
      .replace(/Q/g, Q);

    return result;
  }

  // ─── Module 6: Plugin Manager ─────────────────────────────────────────────

  private renderModule6(parent: HTMLElement) {
    const mod = parent.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    header.createEl("span", { text: "🔌 插件管理", cls: "dashboard-module-title" });

    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "Obsidian 插件设置" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.pluginService.openPluginSettings());

    const body = mod.createDiv("dashboard-module-body");

    const plugins = this.pluginService.getInstalledPlugins();

    if (plugins.length === 0) {
      body.createDiv({ text: "未检测到已安装插件", cls: "dashboard-empty" });
    } else {
      const table = body.createEl("table", { cls: "dashboard-plugin-table" });
      const hr = table.createEl("thead").createEl("tr");
      for (const h of ["插件名称", "说明", "版本", "启用"]) hr.createEl("th", { text: h });
      const tbody = table.createEl("tbody");

      for (const p of plugins) {
        const tr = tbody.createEl("tr");

        const nameTd = tr.createEl("td");
        if (p.hasSettings) {
          const link = nameTd.createEl("a", { text: p.name, cls: "dashboard-plugin-link" });
          link.addEventListener("click", () => this.pluginService.openSpecificPluginSettings(p.id));
        } else {
          nameTd.textContent = p.name;
        }

        const descTd = tr.createEl("td", { cls: "dashboard-plugin-desc" });
        descTd.textContent = p.description || "—";

        tr.createEl("td", { text: p.version, cls: "dashboard-plugin-version" });

        const toggleTd = tr.createEl("td");
        const toggle = toggleTd.createEl("label", { cls: "dashboard-toggle" });
        const cb = toggle.createEl("input") as HTMLInputElement;
        cb.type = "checkbox";
        cb.checked = p.enabled;
        toggle.createEl("span", { cls: "dashboard-toggle-slider" });

        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try {
            await this.pluginService.togglePlugin(p.id, cb.checked);
            new Notice(`${p.name} 已${cb.checked ? "启用" : "禁用"}`);
          } catch (e: any) {
            new Notice(`操作失败: ${e.message}`);
            cb.checked = !cb.checked;
          } finally {
            cb.disabled = false;
          }
        });
      }
    }
  }

  // ─── Task Quick Add ──────────────────────────────────────────────────────

  private readonly TASK_SECTIONS = [
    { key: "urgent", label: "🔴 紧急", section: "### 🔴 紧急/重要", placeholder: "紧急任务..." },
    { key: "normal", label: "🟡 一般", section: "### 🟡 一般", placeholder: "一般任务..." },
    { key: "low", label: "🟢 低优先级", section: "### 🟢 低优先级", placeholder: "低优先级任务..." },
  ];

  private renderTaskQuickAdd(parent: HTMLElement) {
    const td = this.settings.taskDefaults;

    const mod = parent.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    header.createEl("span", { text: "📝 快速添加任务", cls: "dashboard-module-title" });

    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "配置默认内容" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.openTaskDefaultsModal());

    const body = mod.createDiv("dashboard-module-body");
    body.style.cssText = "display:flex;flex-direction:column;gap:6px;";

    // Three priority rows
    for (const cfg of this.TASK_SECTIONS) {
      const row = body.createDiv("dashboard-task-row");
      row.createEl("span", { text: cfg.label, cls: "dashboard-task-label" });
      const input = row.createEl("input", { cls: "dashboard-task-input", placeholder: cfg.placeholder }) as HTMLInputElement;
      input.value = td[cfg.key as keyof typeof td] || "";
      const addBtn = row.createEl("button", { text: "+", cls: "dashboard-task-add-btn", title: "添加到日报" });

      const doAdd = async () => {
        const val = input.value.trim();
        if (!val) return;
        addBtn.disabled = true;
        addBtn.textContent = "...";
        try {
          await this.appendBulletToReport(cfg.section, val);
          input.value = td[cfg.key as keyof typeof td] || "";
        } catch (e: any) {
          new Notice(`添加失败: ${e.message}`);
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = "+";
        }
      };

      addBtn.addEventListener("click", doAdd);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doAdd();
      });
    }

    // Ongoing task row with percentage
    const ongoingRow = body.createDiv("dashboard-task-row");
    ongoingRow.createEl("span", { text: "🔄 持续任务", cls: "dashboard-task-label" });
    const ongoingInput = ongoingRow.createEl("input", { cls: "dashboard-task-input", placeholder: "持续任务..." }) as HTMLInputElement;
    ongoingInput.value = td.ongoing || "";
    const pctInput = ongoingRow.createEl("input", {
      cls: "dashboard-task-pct-input",
      placeholder: "%",
    }) as HTMLInputElement;
    pctInput.value = td.ongoingPercent || "";
    pctInput.style.cssText = "width:48px;flex-shrink:0;";
    const ongoingBtn = ongoingRow.createEl("button", { text: "+", cls: "dashboard-task-add-btn", title: "添加到日报" });

    const doAddOngoing = async () => {
      const val = ongoingInput.value.trim();
      if (!val) return;
      const pct = pctInput.value.trim();
      const text = pct ? `${val} (${pct}%)` : val;
      ongoingBtn.disabled = true;
      ongoingBtn.textContent = "...";
      try {
        await this.appendBulletToReport("### 🔄 持续任务", text);
        ongoingInput.value = td.ongoing || "";
        pctInput.value = td.ongoingPercent || "";
      } catch (e: any) {
        new Notice(`添加失败: ${e.message}`);
      } finally {
        ongoingBtn.disabled = false;
        ongoingBtn.textContent = "+";
      }
    };

    ongoingBtn.addEventListener("click", doAddOngoing);
    ongoingInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAddOngoing();
    });
    pctInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doAddOngoing();
    });
  }

  private openTaskDefaultsModal() {
    const td = this.settings.taskDefaults;
    const saveSettings = this.onSettingsChange;
    const currentSettings = this.settings;
    const view = this;
    const modal = new (class extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.addClass("dashboard-task-defaults-modal");
        contentEl.createEl("h3", { text: "快速任务默认值" });

        const addRow = (label: string, value: string, placeholder: string, onChange: (v: string) => void) => {
          const row = contentEl.createDiv("dashboard-task-modal-row");
          row.createEl("label", { text: label, cls: "dashboard-task-modal-label" });
          const input = row.createEl("input", {
            cls: "dashboard-task-modal-input",
            placeholder,
          }) as HTMLInputElement;
          input.value = value;
          input.addEventListener("input", () => onChange(input.value));
        };

        addRow("🔴 紧急", td.urgent, "默认紧急任务内容...", (v) => { td.urgent = v; });
        addRow("🟡 一般", td.normal, "默认一般任务内容...", (v) => { td.normal = v; });
        addRow("🟢 低优先级", td.low, "默认低优先级任务内容...", (v) => { td.low = v; });
        addRow("🔄 持续任务", td.ongoing, "默认持续任务名称...", (v) => { td.ongoing = v; });
        addRow("📊 持续任务进度 %", td.ongoingPercent, "默认进度百分比...", (v) => { td.ongoingPercent = v; });

        const btns = contentEl.createDiv("dashboard-task-modal-btns");
        btns.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
        btns.createEl("button", { text: "保存", cls: "mod-cta" }).addEventListener("click", async () => {
          await saveSettings(currentSettings);
          this.close();
          view.render();
        });
      }
      onClose() { this.contentEl.empty(); }
    })(this.app);

    modal.open();
  }

  private async appendBulletToReport(sectionMarker: string, text: string): Promise<void> {
    const path = this.resolveReportPath("daily", new Date());
    const file = this.app.vault.getAbstractFileByPath(path);

    let content = "";
    if (file instanceof TFile) {
      content = await this.app.vault.read(file as TFile);
    } else {
      content = this.getDefaultReportTemplate();
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try { await this.app.vault.createFolder(acc); } catch { /* race */ }
        }
      }
    }

    const lines = content.split("\n");
    const bullet = `- ${text}`;
    let sectionIdx = -1;
    let nextHeadingIdx = lines.length;

    // Find the section marker
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === sectionMarker) {
        sectionIdx = i;
        // Find the next heading after this section
        for (let j = i + 1; j < lines.length; j++) {
          const trimmed = lines[j].trim();
          if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) {
            nextHeadingIdx = j;
            break;
          }
        }
        break;
      }
    }

    if (sectionIdx === -1) {
      // Section not found, append at end with the section header
      if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
      lines.push(sectionMarker, "", bullet, "");
    } else {
      // Ensure there's always a blank line before the next heading
      if (nextHeadingIdx > 0 && lines[nextHeadingIdx - 1] !== "") {
        lines.splice(nextHeadingIdx, 0, "");
      }
      // Insert bullet after section header, before the blank+heading gap
      // Find the last bullet line in this section
      let insertAt = sectionIdx + 1;
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() === "") {
        insertAt++;
      }
      // Insert after the existing content, before the blank line gap
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() !== "") {
        insertAt++;
      }
      // If no trailing blank line, add one
      if (insertAt < lines.length && lines[insertAt] !== "") {
        lines.splice(insertAt, 0, "");
      }
      lines.splice(insertAt, 0, bullet);
    }

    const newContent = lines.join("\n");

    if (file instanceof TFile) {
      await this.app.vault.modify(file as TFile, newContent);
    } else {
      await this.app.vault.create(path, newContent);
    }
  }

  private getDefaultReportTemplate(): string {
    return `> **优先级图例**：<span style="color:#e53e3e">🔴 紧急/重要—必须当天完成</span> ｜ <span style="color:#d69e2e">🟡 一般—尽量完成</span> ｜ <span style="color:#38a169">🟢 低优先级—有空再做</span> ｜ <span style="color:#3182ce">🔵 备注/信息</span>

## 今日任务

### 🔴 紧急/重要

-
-

### 🟡 一般

-
-

### 🟢 低优先级

-
-

## 今日完成

-

## 遇到的问题

-

## 明日计划

-

## 备注

-
`;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private createModule(parent: HTMLElement, icon: string, title: string): HTMLElement {
    const mod = parent.createDiv("dashboard-module");
    mod.createDiv("dashboard-module-header").createEl("span", {
      text: `${icon} ${title}`,
      cls: "dashboard-module-title",
    });
    return mod;
  }

  private createBadge(parent: HTMLElement, text: string, level: "ok" | "warn", tooltip?: string, files?: string[]) {
    const badge = parent.createEl("span", { text, cls: `dashboard-badge dashboard-badge-${level}` });
    if (!files || files.length === 0) return;

    let popover: HTMLElement | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    };

    const remove = () => {
      clearTimer();
      if (popover) { popover.remove(); popover = null; }
    };

    const show = () => {
      clearTimer();
      remove(); // close any existing first

      popover = document.body.createDiv("dashboard-popover");
      popover.createDiv("dashboard-popover-title").textContent = tooltip ?? text;

      for (const filePath of files) {
        const item = popover.createDiv("dashboard-popover-item");
        item.textContent = `• ${filePath}`;
        item.addEventListener("mousedown", async (e) => {
          e.preventDefault();
          const f = this.app.vault.getAbstractFileByPath(filePath);
          if (f instanceof TFile) {
            await this.app.workspace.getLeaf(false).openFile(f);
          }
          remove();
        });
      }

      const rect = badge.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;

      popover.addEventListener("mouseenter", clearTimer);
      popover.addEventListener("mouseleave", () => {
        hideTimer = setTimeout(remove, 200);
      });
    };

    badge.addEventListener("mouseenter", show);
    badge.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(remove, 200);
    });
  }

  private getObsidianVersion(): string {
    try {
      const a = this.app as any;
      if (typeof a.version === 'string') return a.version;
      if (typeof a.appVersion === 'string') return a.appVersion;

      // Try to parse from userAgent: "obsidian/1.5.12"
      const ua = navigator.userAgent;
      const m = ua.match(/[Oo]bsidian\/([\d.]+)/);
      if (m) return m[1];

      // Try Electron remote
      const w = window as any;
      if (w.electronRemote?.app?.getVersion) {
        return w.electronRemote.app.getVersion();
      }

      return "";
    } catch {
      return "";
    }
  }

  private formatRelativeTime(mtime: number): string {
    const diff = Math.floor((Date.now() - mtime) / 60000);
    if (diff < 1) return "刚刚";
    if (diff < 60) return `${diff}分钟前`;
    if (diff < 1440) return `${Math.floor(diff / 60)}小时前`;
    return `${Math.floor(diff / 1440)}天前`;
  }
}
