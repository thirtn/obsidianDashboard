import { App, Notice, Modal, TFile } from "obsidian";
import { BaseComponent } from "./BaseComponent";
import { DashboardSettings } from "../../types";

const TASK_SECTIONS = [
  { key: "urgent", label: "🔴 紧急", section: "### 🔴 紧急/重要", placeholder: "紧急任务..." },
  { key: "normal", label: "🟡 一般", section: "### 🟡 一般", placeholder: "一般任务..." },
  { key: "low", label: "🟢 低优先级", section: "### 🟢 低优先级", placeholder: "低优先级任务..." },
];

export class TaskQuickAddComponent extends BaseComponent {
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;

  constructor(app: App, settings: DashboardSettings, onSettingsChange: (s: DashboardSettings) => Promise<void>) {
    super(app, settings);
    this.onSettingsChange = onSettingsChange;
  }

  get id(): string { return "task-quickadd"; }

  async render(container: HTMLElement): Promise<void> {
    const td = this.settings.taskDefaults;
    const mod = container.createDiv("dashboard-module");

    const header = mod.createDiv("dashboard-module-header");
    const tqTitleWrap = header.createDiv("dashboard-module-title-wrap");
    tqTitleWrap.createEl("span", { text: "📝", cls: "dashboard-module-icon" });
    tqTitleWrap.createEl("span", { text: "快速添加任务", cls: "dashboard-module-title" });

    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "配置默认内容" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.openTaskDefaultsModal());

    const body = mod.createDiv("dashboard-module-body");
    body.style.cssText = "display:flex;flex-direction:column;gap:6px;";

    for (const cfg of TASK_SECTIONS) {
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
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") doAdd(); });
    }

    // Ongoing task
    const ongoingRow = body.createDiv("dashboard-task-row");
    ongoingRow.createEl("span", { text: "🔄 持续任务", cls: "dashboard-task-label" });
    const ongoingInput = ongoingRow.createEl("input", { cls: "dashboard-task-input", placeholder: "持续任务..." }) as HTMLInputElement;
    ongoingInput.value = td.ongoing || "";
    const pctInput = ongoingRow.createEl("input", { cls: "dashboard-task-pct-input", placeholder: "%" }) as HTMLInputElement;
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
    ongoingInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doAddOngoing(); });
    pctInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doAddOngoing(); });
  }

  private openTaskDefaultsModal() {
    const td = this.settings.taskDefaults;
    const saveSettings = this.onSettingsChange;
    const currentSettings = this.settings;
    new (class extends Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.addClass("dashboard-task-defaults-modal");
        contentEl.createEl("h3", { text: "快速任务默认值" });
        const addRow = (label: string, value: string, placeholder: string, onChange: (v: string) => void) => {
          const row = contentEl.createDiv("dashboard-task-modal-row");
          row.createEl("label", { text: label, cls: "dashboard-task-modal-label" });
          const input = row.createEl("input", { cls: "dashboard-task-modal-input", placeholder }) as HTMLInputElement;
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
        });
      }
      onClose() { this.contentEl.empty(); }
    })(this.app).open();
  }

  private async appendBulletToReport(sectionMarker: string, text: string): Promise<void> {
    const cfg = this.settings.reportConfigs.daily;
    const date = new Date();
    const relPath = this.formatDatePath(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, '');
    const path = dir ? `${dir}/${relPath}.md` : `${relPath}.md`;

    const file = this.app.vault.getAbstractFileByPath(path);
    let content = "";
    if (file instanceof TFile) {
      content = await this.app.vault.read(file);
    } else {
      content = TaskQuickAddComponent.getDefaultReportTemplate();
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
    let sectionIdx = -1, nextHeadingIdx = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === sectionMarker) {
        sectionIdx = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim().startsWith("## ") || lines[j].trim().startsWith("### ")) {
            nextHeadingIdx = j; break;
          }
        }
        break;
      }
    }
    if (sectionIdx === -1) {
      if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
      lines.push(sectionMarker, "", bullet, "");
    } else {
      if (nextHeadingIdx > 0 && lines[nextHeadingIdx - 1] !== "") lines.splice(nextHeadingIdx, 0, "");
      let insertAt = sectionIdx + 1;
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() === "") insertAt++;
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() !== "") insertAt++;
      if (insertAt < lines.length && lines[insertAt] !== "") lines.splice(insertAt, 0, "");
      lines.splice(insertAt, 0, bullet);
    }

    const newContent = lines.join("\n");
    if (file instanceof TFile) {
      await this.app.vault.modify(file, newContent);
    } else {
      await this.app.vault.create(path, newContent);
    }
  }

  private formatDatePath(date: Date, format: string): string {
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
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, '0'))
      .replace(/DD/g, d.padStart(2, '0')).replace(/ww/g, w.padStart(2, '0'))
      .replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }

  static getDefaultReportTemplate(): string {
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
}
