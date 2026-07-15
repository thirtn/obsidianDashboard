import { App, TFile, TFolder } from "obsidian";
import { BaseComponent } from "./BaseComponent";
import { DashboardSettings } from "../../types";
import { RemotelySaveService, SyncSession } from "../../services/RemotelySaveService";
import { FileService } from "../../services/FileService";

export class RemotelySaveComponent extends BaseComponent {
  private remotelySaveService: RemotelySaveService;
  private fileService: FileService;

  constructor(app: App, settings: DashboardSettings) {
    super(app, settings);
    this.remotelySaveService = new RemotelySaveService();
    this.fileService = new FileService(app);
  }

  get id(): string { return "remotely-save"; }

  private isRemotelySaveEnabled(): boolean {
    const plugins = (this.app as any).plugins;
    if (!plugins) return false;
    const manifests = plugins.manifests ?? {};
    if (!manifests["remotely-save"]) return false;
    const enabledSet: Set<string> | Record<string, boolean> = plugins.enabledPlugins ?? {};
    if (enabledSet instanceof Set) return enabledSet.has("remotely-save");
    return !!(enabledSet as Record<string, boolean>)["remotely-save"];
  }

  async render(container: HTMLElement): Promise<void> {
    if (!this.isRemotelySaveEnabled()) return;

    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-remotely-save-module";

    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    header.createEl("span", { text: "☁️ OneDrive 同步", cls: "dashboard-module-title" });

    const body = mod.createDiv("dashboard-module-body dashboard-sync-body");
    const sessions = await this.remotelySaveService.getSyncHistory(7);

    if (sessions.length === 0) {
      body.createDiv({ text: "暂无 Remotely Save 同步记录", cls: "dashboard-git-mobile-hint" });
      return;
    }

    header.createEl("span", { text: `${sessions.length} 次同步`, cls: "dashboard-module-badge" });
    const sessionList = body.createDiv("dashboard-sync-session-list");

    for (const session of sessions) {
      const sessionBlock = sessionList.createDiv("dashboard-sync-session");
      const sessionHeader = sessionBlock.createDiv("dashboard-sync-session-header");
      const date = new Date(session.ts);
      const dateStr = date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      sessionHeader.createEl("span", { text: dateStr, cls: "dashboard-sync-time" });

      const badges = sessionHeader.createDiv("dashboard-sync-badges");
      if (session.uploads.length > 0) badges.createEl("span", { text: `↑ ${session.uploads.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-upload" });
      if (session.downloads.length > 0) badges.createEl("span", { text: `↓ ${session.downloads.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-download" });
      if (session.deletions.length > 0) badges.createEl("span", { text: `✕ ${session.deletions.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-delete" });
      if (session.totalCount === 0) badges.createEl("span", { text: "无变更", cls: "dashboard-sync-badge dashboard-sync-badge-none" });

      const toggleBtn = sessionHeader.createEl("button", { cls: "dashboard-sync-toggle" });
      toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      const fileList = sessionBlock.createDiv("dashboard-sync-files");
      fileList.style.display = "none";

      const doToggle = () => {
        const isHidden = fileList.style.display === "none";
        fileList.style.display = isHidden ? "block" : "none";
        toggleBtn.classList.toggle("expanded", isHidden);
      };
      toggleBtn.addEventListener("click", (e) => { e.stopPropagation(); doToggle(); });
      sessionHeader.addEventListener("click", doToggle);

      this.renderSyncFileGroup(fileList, "已上传", session.uploads, "upload");
      this.renderSyncFileGroup(fileList, "已下载", session.downloads, "download");
      this.renderSyncFileGroup(fileList, "已删除", session.deletions, "delete");
    }
  }

  private renderSyncFileGroup(parent: HTMLElement, label: string, files: string[], cls: string) {
    if (files.length === 0) return;
    const group = parent.createDiv("dashboard-sync-file-group");
    group.createEl("span", { text: label, cls: `dashboard-sync-file-label dashboard-sync-file-${cls}` });
    for (const f of files) {
      const item = group.createEl("div", { text: f, cls: "dashboard-sync-file-item" });
      item.addEventListener("click", () => {
        const cleanPath = f.replace(/^\/+|\/+$/g, "");
        const abstract = this.app.vault.getAbstractFileByPath(cleanPath);
        if (abstract instanceof TFile) {
          this.app.workspace.getLeaf(false).openFile(abstract);
        } else if (abstract instanceof TFolder) {
          this.fileService.toggleFolderInExplorer(cleanPath);
        } else {
          const lastSlash = cleanPath.lastIndexOf("/");
          if (lastSlash > 0) this.fileService.toggleFolderInExplorer(cleanPath.slice(0, lastSlash));
        }
      });
    }
  }
}
