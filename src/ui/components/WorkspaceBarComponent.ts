import { App, TFile } from "obsidian";
import { BaseComponent } from "./BaseComponent";
import { DashboardSettings } from "../../types";
import { FileService } from "../../services/FileService";
import { ReportService } from "../../services/ReportService";
import { formatRelativeTime, loadLastLlmOutput } from "./utils";

export class WorkspaceBarComponent extends BaseComponent {
  private fileService: FileService;
  private reportService: ReportService;

  constructor(app: App, settings: DashboardSettings, fileService: FileService, reportService: ReportService) {
    super(app, settings);
    this.fileService = fileService;
    this.reportService = reportService;
  }

  get id(): string {
    return "workspace-bar";
  }

  updateSettings(settings: DashboardSettings): void {
    super.updateSettings(settings);
    this.reportService.updateSettings(settings);
  }

  async render(container: HTMLElement): Promise<void> {
    const bar = container.createDiv("dashboard-workspace-bar");

    const section = (label: string) => {
      const block = bar.createDiv("dashboard-workspace-section");
      block.createEl("span", { text: label, cls: "dashboard-workspace-label" });
      return block.createDiv("dashboard-workspace-items");
    };

    // Today's daily report
    const reportItems = section("今日");
    const dailyCfg = this.settings.reportConfigs.daily;
    if (dailyCfg.enabled) {
      const today = new Date();
      const path = this.reportService.resolveReportPath("daily", today);
      const exists = this.app.vault.getAbstractFileByPath(path) instanceof TFile;
      const btn = reportItems.createEl("button", {
        text: exists ? "📓 打开日报" : "📓 新建日报",
        cls: "dashboard-workspace-chip",
      });
      btn.addEventListener("click", () => this.reportService.openOrCreateReport("daily", today));
    } else {
      reportItems.createEl("span", { text: "日报未启用", cls: "dashboard-workspace-muted" });
    }

    // Recent 3 modified files
    const recentItems = section("最近修改");
    const recent = this.fileService.getRecentlyModified(3);
    if (recent.length === 0) {
      recentItems.createEl("span", { text: "无", cls: "dashboard-workspace-muted" });
    } else {
      for (const rf of recent) {
        const chip = recentItems.createEl("button", {
          cls: "dashboard-workspace-chip",
          title: rf.path,
        });
        const name = rf.path.split("/").pop() ?? rf.path;
        chip.createEl("span", { text: name, cls: "dashboard-workspace-chip-name" });
        chip.createEl("span", { text: formatRelativeTime(rf.mtime), cls: "dashboard-workspace-chip-time" });
        chip.addEventListener("click", () => this.fileService.openFile(rf.path));
      }
    }

    // Last LLM output
    const llmItems = section("上次 LLM 输出");
    const lastStored = loadLastLlmOutput();
    const storedRecent: { path: string; mtime: number } | null =
      lastStored?.path && this.app.vault.getAbstractFileByPath(lastStored.path) instanceof TFile
        ? { path: lastStored.path, mtime: lastStored.time }
        : null;
    const latestOutput = storedRecent ?? this.fileService.getLatestInFolder("outputs");

    if (!latestOutput) {
      llmItems.createEl("span", { text: "暂无 outputs 文件", cls: "dashboard-workspace-muted" });
    } else {
      const chip = llmItems.createEl("button", { cls: "dashboard-workspace-chip", title: latestOutput.path });
      chip.createEl("span", {
        text: latestOutput.path.split("/").pop() ?? latestOutput.path,
        cls: "dashboard-workspace-chip-name",
      });
      chip.createEl("span", {
        text: formatRelativeTime(latestOutput.mtime),
        cls: "dashboard-workspace-chip-time",
      });
      chip.addEventListener("click", () => this.fileService.openFile(latestOutput.path));
    }
  }
}
