import { App, TFile } from "obsidian";
import { BaseComponent } from "../../shared/BaseComponent";
import { DashboardSettings, LogType } from "../../types";
import { LogService } from "./LogService";

const LOG_TYPE_LABELS: Record<LogType, string> = {
  ingest: "入库",
  query: "问答",
  lint: "审阅",
  unknown: "其他",
};

const LOG_TYPE_CLS: Record<LogType, string> = {
  ingest: "ingest",
  query: "query",
  lint: "lint",
  unknown: "unknown",
};

export class OperationLogComponent extends BaseComponent {
  private logService: LogService;

  constructor(app: App, settings: DashboardSettings, logService: LogService) {
    super(app, settings);
    this.logService = logService;
  }

  get id(): string {
    return "operation-log";
  }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "📋", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "操作日志", cls: "dashboard-module-title" });

    const body = mod.createDiv("dashboard-module-body");
    const entries = await this.logService.getRecentLogs(8);

    if (entries.length === 0) {
      body.createDiv({ text: "暂无操作记录（执行 LLM 指令后将自动写入 wiki/log）", cls: "dashboard-empty" });
      return;
    }

    const list = body.createDiv("dashboard-log-list");
    for (const entry of entries) {
      const row = list.createDiv("dashboard-log-row");
      row.createEl("span", {
        text: LOG_TYPE_LABELS[entry.type],
        cls: `dashboard-log-type dashboard-log-type-${LOG_TYPE_CLS[entry.type]}`,
      });
      row.createEl("span", { text: entry.target, cls: "dashboard-log-target", title: entry.raw });
      row.createEl("span", { text: entry.time, cls: "dashboard-log-time" });
    }
  }
}
