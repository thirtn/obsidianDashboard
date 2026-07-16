import { App, Modal, Notice, TFile } from "obsidian";
import { BaseComponent } from "./BaseComponent";
import { DashboardSettings, ReportType } from "../../types";
import { HeatmapService } from "../../services/HeatmapService";
import { ReportConfigModal } from "../../modals/ReportConfigModal";
import { fmtDate } from "./utils";

export class HeatmapComponent extends BaseComponent {
  private heatmapService: HeatmapService;
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;
  private currentYear = new Date().getFullYear();

  constructor(
    app: App,
    settings: DashboardSettings,
    heatmapService: HeatmapService,
    onSettingsChange: (s: DashboardSettings) => Promise<void>
  ) {
    super(app, settings);
    this.heatmapService = heatmapService;
    this.onSettingsChange = onSettingsChange;
  }

  get id(): string { return "heatmap"; }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const hmTitleWrap = header.createDiv("dashboard-module-title-wrap");
    hmTitleWrap.createEl("span", { text: "🗓", cls: "dashboard-module-icon" });
    hmTitleWrap.createEl("span", { text: "工作热力图", cls: "dashboard-module-title" });

    const yearNav = header.createDiv("dashboard-heatmap-year-nav");
    const prevBtn = yearNav.createEl("span", { text: "◀", cls: "dashboard-heatmap-year-arrow" });
    const yearLabel = yearNav.createEl("span", { text: String(this.currentYear), cls: "dashboard-heatmap-year-label clickable" });
    yearLabel.addEventListener("click", () => {
      if (this.settings.reportConfigs.yearly.enabled) {
        this.openOrCreateReport("yearly", new Date(this.currentYear, 0, 1));
      }
    });
    const nextBtn = yearNav.createEl("span", { text: "▶", cls: "dashboard-heatmap-year-arrow" });

    const cfgBtn = yearNav.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "日报/周报配置" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ReportConfigModal(this.app, this.settings.reportConfigs, async (configs) => {
        this.settings.reportConfigs = configs;
        await this.onSettingsChange(this.settings);
      }).open();
    });

    const thisYear = new Date().getFullYear();
    if (this.currentYear >= thisYear) nextBtn.addClass("disabled");

    prevBtn.addEventListener("click", () => {
      this.currentYear--;
      this.render(container);
    });
    nextBtn.addEventListener("click", () => {
      if (this.currentYear < thisYear) {
        this.currentYear++;
        this.render(container);
      }
    });

    const body = mod.createDiv("dashboard-module-body");
    const now = new Date();
    const todayStr = fmtDate(now);
    const data = this.heatmapService.getDataSync();
    const maxVal = Math.max(...Object.values(data), 1);
    const year = this.currentYear;

    const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

    const mainWrap = body.createDiv("dashboard-heatmap-main-wrap");

    const dayCol = mainWrap.createDiv("dashboard-heatmap-days");
    dayCol.createDiv({ cls: "dashboard-heatmap-days-spacer" });
    for (const d of DAYS) {
      dayCol.createDiv({ text: d, cls: "dashboard-heatmap-day-label" });
    }

    const monthsWrap = mainWrap.createDiv("dashboard-heatmap-months-wrap");

    for (let m = 0; m < 12; m++) {
      const monthBlock = monthsWrap.createDiv("dashboard-heatmap-month-block");

      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthLabel = monthBlock.createDiv({ text: MONTHS[m], cls: "dashboard-heatmap-month-label clickable" });
      monthLabel.addEventListener("click", () => {
        if (this.settings.reportConfigs.monthly.enabled) {
          this.openOrCreateReport("monthly", new Date(year, m, 1));
        }
      });

      const firstDay = new Date(year, m, 1);
      const firstDow = firstDay.getDay();
      const startOffset = firstDow === 0 ? 6 : firstDow - 1;
      const daysInMonth = new Date(year, m + 1, 0).getDate();

      const grid = monthBlock.createDiv("dashboard-heatmap-grid");

      for (let p = 0; p < startOffset; p++) {
        grid.createDiv({ cls: "dashboard-heatmap-cell future" });
      }

      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, m, day);
        const dateStr = fmtDate(cellDate);
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

    // Legend + stats
    const legendRow = body.createDiv("dashboard-heatmap-legend-row");
    const legend = legendRow.createDiv("dashboard-heatmap-legend");
    legend.createEl("span", { text: "少", cls: "dashboard-heatmap-legend-label" });
    for (let i = 0; i <= 4; i++) {
      legend.createDiv({ cls: `dashboard-heatmap-cell level-${i} legend-cell` });
    }
    legend.createEl("span", { text: "多", cls: "dashboard-heatmap-legend-label" });

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
        if (d >= fmtDate(startOfWeek)) weekCount += c;
        if (d >= fmtDate(startOfMonth)) monthCount += c;
        if (d >= fmtDate(startOfYear)) yearCount += c;
      }
      statsRow.createEl("span", { text: `本周 ${weekCount} 次` });
      statsRow.createEl("span", { text: `本月 ${monthCount} 次` });
      statsRow.createEl("span", { text: `今年 ${yearCount} 次` });
    } else {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      const endOfYearStr = fmtDate(endOfYear);
      let yearCount = 0;
      for (const [d, c] of Object.entries(data)) {
        if (d >= fmtDate(startOfYear) && d < endOfYearStr) yearCount += c;
      }
      statsRow.createEl("span", { text: `${year} 年 ${yearCount} 次` });
    }
  }

  // ── Report helpers ──

  private REPORT_NAMES: Record<string, string> = {
    daily: "日报", weekly: "周报", monthly: "月报", quarterly: "季报", yearly: "年报",
  };

  private resolveReportPath(type: ReportType, date: Date): string {
    const cfg = this.settings.reportConfigs[type];
    const relPath = HeatmapComponent.formatMomentDate(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    return dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
  }

  private async openOrCreateReport(type: ReportType, date: Date) {
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
        if (tpl instanceof TFile) content = HeatmapComponent.formatMomentDate(date, await this.app.vault.read(tpl));
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
          btns.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
          btns.createEl("button", { text: "新建", cls: "mod-cta" }).addEventListener("click", async () => {
            this.close();
            try { await doCreate(); } catch (e: any) { new Notice(`创建失败: ${e.message}`); }
          });
        }
        onClose() { this.contentEl.empty(); }
      })(this.app).open();
    } else {
      try { await doCreate(); } catch (e: any) { new Notice(`创建${name}失败: ${e.message}`); }
    }
  }

  static formatMomentDate(date: Date, format: string): string {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());

    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7));

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
}
