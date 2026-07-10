import { App, Modal, Notice, TFolder } from "obsidian";
import { ReportType, ReportSettings } from "../types";

const REPORT_LABELS: Record<ReportType, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
  quarterly: "季报",
  yearly: "年报",
};

const TOKEN_HELP = "格式令牌: YYYY(年) YY(年后两位) MM(月补零) M(月) DD(日补零) D(日) ww(周补零) w(周) Q(季度) [文字](原文输出)";
const EXAMPLE: Record<ReportType, string> = {
  daily: "YYYY/MM/YYYY-MM-DD",
  weekly: "YYYY/MM/YYYY-[W]ww",
  monthly: "YYYY/MM/YYYY-MM",
  quarterly: "YYYY/MM/YYYY-[Q]Q",
  yearly: "YYYY/YYYY",
};

export class ReportConfigModal extends Modal {
  private configs: ReportSettings;
  private mdFiles: { path: string; name: string }[] = [];
  private folders: string[] = [];

  constructor(
    app: App,
    configs: ReportSettings,
    private onSave: (configs: ReportSettings) => void
  ) {
    super(app);
    this.configs = JSON.parse(JSON.stringify(configs));

    // Collect all markdown files (strip .md suffix)
    const files = this.app.vault.getMarkdownFiles();
    this.mdFiles = files
      .map((f) => ({ path: f.path.replace(/\.md$/, ""), name: f.path }))
      .sort((a, b) => a.name.localeCompare(b.name));

    // Collect all vault folders
    const dirSet = new Set<string>();
    dirSet.add("");
    for (const f of this.app.vault.getAllLoadedFiles()) {
      if (f instanceof TFolder) dirSet.add(f.path);
    }
    this.folders = [...dirSet].sort();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "报表配置" });

    const activeTab: Record<string, HTMLElement> = {};
    let currentType: ReportType = "daily";

    const tabBar = contentEl.createDiv("dashboard-report-tabs");
    const panel = contentEl.createDiv("dashboard-report-panel");

    const showTab = (type: ReportType) => {
      currentType = type;
      for (const [t, el] of Object.entries(activeTab)) {
        el.classList.toggle("active", t === type);
      }
      this.renderTabContent(panel, type);
    };

    for (const type of Object.keys(REPORT_LABELS) as ReportType[]) {
      const tab = tabBar.createEl("button", {
        text: REPORT_LABELS[type],
        cls: "dashboard-report-tab",
      });
      tab.addEventListener("click", () => showTab(type));
      activeTab[type] = tab;
    }

    showTab("daily");

    contentEl.createDiv({ text: TOKEN_HELP, cls: "dashboard-field-hint" });

    const actions = contentEl.createDiv("dashboard-modal-actions");
    const saveBtn = actions.createEl("button", { text: "保存", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.configs);
      this.close();
      new Notice("报表配置已保存");
    });
  }

  private renderTabContent(panel: HTMLElement, type: ReportType) {
    panel.empty();
    const cfg = this.configs[type];

    this.createToggle(panel, "启用", cfg.enabled, (v) => (cfg.enabled = v));
    this.createToggle(panel, "新建时弹窗确认", cfg.confirmBeforeCreate, (v) => (cfg.confirmBeforeCreate = v));

    this.createDirectorySelect(panel, cfg);
    this.createFormatField(panel, cfg, type);
    this.createTemplateSelect(panel, cfg);
  }

  private createToggle(parent: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const toggle = row.createEl("label", { cls: "dashboard-toggle" });
    const cb = toggle.createEl("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = value;
    cb.addEventListener("change", () => onChange(cb.checked));
    toggle.createEl("span", { cls: "dashboard-toggle-slider" });
  }

  private createDirectorySelect(parent: HTMLElement, cfg: { directory: string }) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "存放目录" });

    const wrap = row.createDiv("dashboard-select-wrap");
    const select = wrap.createEl("select") as HTMLSelectElement;

    for (const f of this.folders) {
      const label = f || "（vault 根目录）";
      const opt = select.createEl("option", { value: f, text: label });
      if (f === cfg.directory) opt.selected = true;
    }

    // If current value not in list, add it
    if (cfg.directory && !this.folders.includes(cfg.directory)) {
      const opt = select.createEl("option", { value: cfg.directory, text: `${cfg.directory}（自定义）` });
      opt.selected = true;
    }

    select.addEventListener("change", () => {
      cfg.directory = select.value;
    });
  }

  private createFormatField(parent: HTMLElement, cfg: { filenameFormat: string }, type: ReportType) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "文件路径格式" });
    const input = row.createEl("input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = EXAMPLE[type];
    input.value = cfg.filenameFormat;

    const preview = row.createDiv("dashboard-format-preview");
    const updatePreview = () => {
      try {
        preview.textContent = `示例: ${this.formatMomentDate(new Date(), input.value || EXAMPLE[type])}`;
      } catch {
        preview.textContent = "示例: （格式无效）";
      }
    };
    updatePreview();
    input.addEventListener("input", () => {
      cfg.filenameFormat = input.value.trim();
      updatePreview();
    });
  }

  private formatMomentDate(date: Date, format: string): string {
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
      .replace(/YYYY/g, y).replace(/YY/g, y.slice(2))
      .replace(/MM/g, m.padStart(2, '0')).replace(/DD/g, d.padStart(2, '0'))
      .replace(/ww/g, w.padStart(2, '0'))
      .replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }

  private createTemplateSelect(parent: HTMLElement, cfg: { templatePath: string }) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "模板文件" });

    const wrap = row.createDiv("dashboard-select-wrap");
    const select = wrap.createEl("select") as HTMLSelectElement;

    // "No template" option
    const noneOpt = select.createEl("option", { value: "", text: "（不使用模板）" });
    if (!cfg.templatePath) noneOpt.selected = true;

    for (const f of this.mdFiles) {
      const opt = select.createEl("option", { value: f.path, text: f.path });
      if (f.path === cfg.templatePath) opt.selected = true;
    }

    select.addEventListener("change", () => {
      cfg.templatePath = select.value;
    });
  }

  private createTextField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const input = row.createEl("input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
  }

  onClose() {
    this.contentEl.empty();
  }
}
