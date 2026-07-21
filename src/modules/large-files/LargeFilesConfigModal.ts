import { App, Modal, Notice } from "obsidian";
import { DashboardSettings } from "../../types";

export class LargeFilesConfigModal extends Modal {
  private settings: DashboardSettings;
  private onSave: (settings: DashboardSettings) => void;
  private minSizeKB: number;
  private maxCount: number;

  constructor(
    app: App,
    settings: DashboardSettings,
    onSave: (settings: DashboardSettings) => void
  ) {
    super(app);
    this.settings = { ...settings };
    this.onSave = onSave;
    this.minSizeKB = settings.largeFilesMinSizeKB;
    this.maxCount = settings.largeFilesMaxCount;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");

    contentEl.createEl("h2", { text: "大文件配置" });

    // Min size input
    const field1 = contentEl.createDiv("dashboard-field");
    field1.createEl("label", { text: "最小文件大小（KB），低于此大小的文件不显示" });
    const input1 = field1.createEl("input", {
      type: "number",
      value: String(this.minSizeKB),
      attr: { min: "0", step: "1" },
    }) as HTMLInputElement;
    input1.addEventListener("change", () => {
      this.minSizeKB = Math.max(0, parseInt(input1.value) || 0);
    });

    // Max count input
    const field2 = contentEl.createDiv("dashboard-field");
    field2.createEl("label", { text: "最多显示条数" });
    const input2 = field2.createEl("input", {
      type: "number",
      value: String(this.maxCount),
      attr: { min: "1", max: "100", step: "1" },
    }) as HTMLInputElement;
    input2.addEventListener("change", () => {
      this.maxCount = Math.max(1, Math.min(100, parseInt(input2.value) || 20));
    });

    // Actions
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "保存", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.settings.largeFilesMinSizeKB = this.minSizeKB;
      this.settings.largeFilesMaxCount = this.maxCount;
      this.onSave(this.settings);
      this.close();
      new Notice("大文件配置已保存");
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
