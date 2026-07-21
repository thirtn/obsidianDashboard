import { App, TFile } from "obsidian";
import { BaseComponent } from "../../shared/BaseComponent";
import { DashboardSettings } from "../../types";
import { LargeFilesConfigModal } from "./LargeFilesConfigModal";

interface LargeFile {
  path: string;
  size: number;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export class LargeFilesComponent extends BaseComponent {
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;

  constructor(
    app: App,
    settings: DashboardSettings,
    onSettingsChange: (s: DashboardSettings) => Promise<void>
  ) {
    super(app, settings);
    this.onSettingsChange = onSettingsChange;
  }

  get id(): string { return "large-files"; }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "📦", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "大文件", cls: "dashboard-module-title" });

    // Gear button
    const gearBtn = header.createEl("button", {
      cls: "dashboard-icon-btn",
      title: "大文件配置",
    });
    gearBtn.style.marginLeft = "auto";
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => {
      new LargeFilesConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
      }).open();
    });

    const body = mod.createDiv("dashboard-module-body");

    const minSizeBytes = this.settings.largeFilesMinSizeKB * 1000;
    const maxCount = this.settings.largeFilesMaxCount;

    const allFiles = this.app.vault.getFiles();
    const filtered: LargeFile[] = allFiles
      .filter((f) => f.stat.size >= minSizeBytes)
      .sort((a, b) => b.stat.size - a.stat.size)
      .slice(0, maxCount)
      .map((f) => ({ path: f.path, size: f.stat.size }));

    if (filtered.length === 0) {
      body.createDiv({ text: "暂无符合条件的大文件", cls: "dashboard-empty" });
      return;
    }

    const list = body.createDiv("dashboard-large-file-list");
    for (const item of filtered) {
      const row = list.createDiv("dashboard-large-file-row");
      const nameEl = row.createEl("span", {
        text: item.path,
        cls: "dashboard-large-file-path",
        title: item.path,
      });
      nameEl.addEventListener("click", () => {
        const f = this.app.vault.getAbstractFileByPath(item.path);
        if (f instanceof TFile) this.app.workspace.getLeaf(false).openFile(f);
      });
      row.createEl("span", {
        text: formatSize(item.size),
        cls: "dashboard-large-file-size",
      });
    }
  }
}
