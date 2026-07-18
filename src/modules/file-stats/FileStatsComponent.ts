import { App, TFile } from "obsidian";
import { BaseComponent } from "../../shared/BaseComponent";
import { DashboardSettings, FileStats } from "../../types";
import { FileService, RecentFile } from "../../services/FileService";
import { FolderConfigModal } from "./FolderConfigModal";
import { formatRelativeTime, attachFileListPopover } from "../../shared/utils";

export class FileStatsComponent extends BaseComponent {
  private fileService: FileService;
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;
  private statsContainer: HTMLElement | null = null;
  private recentContainer: HTMLElement | null = null;

  constructor(app: App, settings: DashboardSettings, onSettingsChange: (s: DashboardSettings) => Promise<void>) {
    super(app, settings);
    this.fileService = new FileService(app);
    this.onSettingsChange = onSettingsChange;
  }

  get id(): string { return "file-stats"; }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const fsTitleWrap = header.createDiv("dashboard-module-title-wrap");
    fsTitleWrap.createEl("span", { text: "📁", cls: "dashboard-module-icon" });
    fsTitleWrap.createEl("span", { text: "文件统计", cls: "dashboard-module-title" });
    const addBtn = header.createEl("button", { cls: "dashboard-icon-btn", title: "增加文件统计" });
    addBtn.style.marginLeft = "auto";
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.addEventListener("click", () => {
      new FolderConfigModal(this.app, this.settings, this.fileService, async (s) => {
        await this.onSettingsChange(s);
      }).open();
    });

    const body = mod.createDiv("dashboard-module-body");
    this.statsContainer = body.createDiv();
    await this.renderFileStats(this.statsContainer);
    this.recentContainer = body.createDiv({ cls: "dashboard-recent-section" });
    this.renderRecentFiles(this.recentContainer);
  }

  async refreshExternal(): Promise<void> {
    if (this.statsContainer && this.statsContainer.isConnected) {
      await this.renderFileStats(this.statsContainer);
    }
    if (this.recentContainer && this.recentContainer.isConnected) {
      this.renderRecentFiles(this.recentContainer);
    }
  }

  async renderFileStats(container: HTMLElement) {
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
      const maxCount = Math.max(...stats.folderStats.map(f => f.count), 1);
      const list = container.createDiv("dashboard-folder-list");
      for (const fs of stats.folderStats) {
        const row = list.createDiv("dashboard-folder-row");
        const nameEl = row.createEl("span", { text: fs.name, cls: "dashboard-folder-row-name", title: fs.name });
        nameEl.addEventListener("click", () => { this.fileService.toggleFolderInExplorer(fs.name); });
        const barWrap = row.createDiv("dashboard-folder-row-bar-wrap");
        barWrap.createDiv("dashboard-folder-row-bar-fill").style.width = `${Math.round((fs.count / maxCount) * 100)}%`;
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
    const healthTrack = health.createDiv("dashboard-health-track");
    const healthFill = healthTrack.createDiv("dashboard-health-fill");
    healthFill.style.width = `${stats.healthScore}%`;
    healthFill.style.background = stats.healthScore >= 80 ? "var(--color-green)" : stats.healthScore >= 50 ? "var(--color-yellow)" : "var(--color-red)";
  }

  renderRecentFiles(container: HTMLElement) {
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
      row.createEl("span", { text: formatRelativeTime(rf.mtime), cls: "dashboard-recent-time" });
    }
  }

  private createBadge(parent: HTMLElement, text: string, level: "ok" | "warn", tooltip?: string, files?: string[]) {
    const badge = parent.createEl("span", { text, cls: `dashboard-badge dashboard-badge-${level}` });
    if (!files || files.length === 0) return;
    attachFileListPopover(badge, files, tooltip ?? text, (filePath) => {
      const f = this.app.vault.getAbstractFileByPath(filePath);
      if (f instanceof TFile) this.app.workspace.getLeaf(false).openFile(f);
    });
  }
}
