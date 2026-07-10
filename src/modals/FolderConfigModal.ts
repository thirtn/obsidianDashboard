import { App, Modal, Notice } from "obsidian";
import { DashboardSettings } from "../types";
import { FileService } from "../services/FileService";

export class FolderConfigModal extends Modal {
  private settings: DashboardSettings;
  private onSave: (settings: DashboardSettings) => void;
  private fileService: FileService;
  private selected: Set<string>;

  constructor(
    app: App,
    settings: DashboardSettings,
    fileService: FileService,
    onSave: (settings: DashboardSettings) => void
  ) {
    super(app);
    this.settings = { ...settings };
    this.fileService = fileService;
    this.onSave = onSave;
    this.selected = new Set(settings.trackedFolders);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");

    contentEl.createEl("h2", { text: "统计文件夹配置" });
    contentEl.createEl("p", {
      text: "选择需要单独统计数量的文件夹。未选中的文件夹仍计入 Vault 总数。",
      cls: "dashboard-modal-desc",
    });

    const vaultPaths = this.fileService.getFolderPaths();
    // Merge: vault paths + tracked paths (so users can uncheck non-existent folders)
    const allPaths = [...new Set([...vaultPaths, ...this.settings.trackedFolders])].sort();

    const checkboxWrap = contentEl.createDiv("dashboard-checkbox-grid");
    const existingSet = new Set(vaultPaths);

    for (const path of allPaths) {
      const exists = existingSet.has(path);
      const label = checkboxWrap.createEl("label", { cls: "dashboard-checkbox-label" });
      const cb = label.createEl("input", { type: "checkbox" } as any) as HTMLInputElement;
      cb.checked = this.selected.has(path);
      label.appendText(path);
      if (!exists) {
        label.createEl("span", { text: " (不存在)", cls: "dashboard-checkbox-missing" });
      }
      cb.addEventListener("change", () => {
        if (cb.checked) this.selected.add(path);
        else this.selected.delete(path);
      });
    }

    const saveBtn = contentEl.createEl("button", { text: "保存", cls: "mod-cta dashboard-save-btn" });
    saveBtn.addEventListener("click", () => {
      this.settings.trackedFolders = [...this.selected];
      this.onSave(this.settings);
      this.close();
      new Notice("文件夹配置已保存");
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
