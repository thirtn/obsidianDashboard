import { App, Modal } from "obsidian";
import { TaskDefaults } from "./types";
import { DashboardSettings } from "../../types";

export class TaskDefaultsModal extends Modal {
  private taskDefaults: TaskDefaults;
  private onSave: () => void;

  constructor(
    app: App,
    taskDefaults: TaskDefaults,
    onSave: () => void
  ) {
    super(app);
    this.taskDefaults = { ...taskDefaults };
    this.onSave = onSave;
  }

  onOpen() {
    const { contentEl } = this;
    const td = this.taskDefaults;
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
      this.onSave();
      this.close();
    });
  }

  onClose() { this.contentEl.empty(); }
}
