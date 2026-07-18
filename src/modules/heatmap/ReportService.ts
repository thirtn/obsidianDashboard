import { App, Modal, Notice, TFile } from "obsidian";
import { DashboardSettings } from "../../types";
import { ReportType, REPORT_LABELS } from "./types";

export interface MissingReport {
  type: ReportType;
  label: string;
  path: string;
  date: Date;
}

export class ReportService {
  constructor(
    private app: App,
    private settings: DashboardSettings
  ) {}

  updateSettings(settings: DashboardSettings) {
    this.settings = settings;
  }

  static formatMomentDate(date: Date, format: string): string {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());

    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(
      1 +
        Math.round(
          ((temp.getTime() - week1.getTime()) / 86400000 -
            3 +
            ((week1.getDay() + 6) % 7)) /
            7
        )
    );

    const Q = String(Math.floor(date.getMonth() / 3) + 1);

    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result
      .replace(/YYYY/g, y)
      .replace(/YY/g, y.slice(2))
      .replace(/MM/g, m.padStart(2, "0"))
      .replace(/DD/g, d.padStart(2, "0"))
      .replace(/ww/g, w.padStart(2, "0"))
      .replace(/M/g, m)
      .replace(/D/g, d)
      .replace(/w/g, w)
      .replace(/Q/g, Q);

    return result;
  }

  resolveReportPath(type: ReportType, date: Date): string {
    const cfg = this.settings.reportConfigs[type];
    const relPath = ReportService.formatMomentDate(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    return dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
  }

  reportExists(type: ReportType, date: Date): boolean {
    const path = this.resolveReportPath(type, date);
    const file = this.app.vault.getAbstractFileByPath(path);
    return file instanceof TFile;
  }

  /** Reference date for the current reporting period */
  getPeriodDate(type: ReportType, ref: Date = new Date()): Date {
    switch (type) {
      case "daily":
        return new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      case "weekly": {
        const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return d;
      }
      case "monthly":
        return new Date(ref.getFullYear(), ref.getMonth(), 1);
      case "quarterly":
        return new Date(ref.getFullYear(), Math.floor(ref.getMonth() / 3) * 3, 1);
      case "yearly":
        return new Date(ref.getFullYear(), 0, 1);
    }
  }

  getMissingReports(ref: Date = new Date()): MissingReport[] {
    const missing: MissingReport[] = [];
    for (const type of Object.keys(REPORT_LABELS) as ReportType[]) {
      const cfg = this.settings.reportConfigs[type];
      if (!cfg.enabled) continue;
      const date = this.getPeriodDate(type, ref);
      if (!this.reportExists(type, date)) {
        missing.push({
          type,
          label: REPORT_LABELS[type],
          path: this.resolveReportPath(type, date),
          date,
        });
      }
    }
    return missing;
  }

  async openOrCreateReport(type: ReportType, date: Date): Promise<void> {
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
        if (tpl instanceof TFile) {
          content = ReportService.formatMomentDate(date, await this.app.vault.read(tpl));
        }
      }
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try {
            await this.app.vault.createFolder(acc);
          } catch {
            /* race */
          }
        }
      }
      const created = await this.app.vault.create(path, content);
      await this.app.workspace.getLeaf(false).openFile(created);
    };

    if (cfg.confirmBeforeCreate) {
      const name = REPORT_LABELS[type];
      new (class extends Modal {
        onOpen() {
          this.contentEl.createEl("p", { text: `${name}不存在，是否新建？` });
          this.contentEl.createEl("p", { text: path, cls: "dashboard-field-hint" });
          const btns = this.contentEl.createDiv("dashboard-confirm-btns");
          btns.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
          btns.createEl("button", { text: "新建", cls: "mod-cta" }).addEventListener("click", async () => {
            this.close();
            try {
              await doCreate();
            } catch (e: any) {
              new Notice(`创建失败: ${e.message}`);
            }
          });
        }
        onClose() {
          this.contentEl.empty();
        }
      })(this.app).open();
    } else {
      try {
        await doCreate();
      } catch (e: any) {
        new Notice(`创建${REPORT_LABELS[type]}失败: ${e.message}`);
      }
    }
  }
}
