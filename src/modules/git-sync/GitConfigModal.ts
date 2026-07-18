import { App, Modal, Notice } from "obsidian";
import { DashboardSettings } from "../../types";

export class GitConfigModal extends Modal {
  private settings: DashboardSettings;

  constructor(
    app: App,
    settings: DashboardSettings,
    private onSave: (s: DashboardSettings) => Promise<void>
  ) {
    super(app);
    // Deep clone so cancel doesn't mutate original
    this.settings = JSON.parse(JSON.stringify(settings));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.addClass("dashboard-git-config-modal");
    contentEl.createEl("h2", { text: "Git 同步配置" });

    // Enable toggle
    this.createToggle(contentEl, "启用 Git 同步", this.settings.gitEnabled, (v) => {
      this.settings.gitEnabled = v;
    });

    // Remote URL
    this.createTextField(
      contentEl,
      "仓库地址",
      this.settings.gitRemoteURL,
      (v) => (this.settings.gitRemoteURL = v.trim()),
      "https://github.com/username/repo.git"
    );

    // Remote name + Branch in one row
    const row1 = contentEl.createDiv("dashboard-git-config-row");
    this.createTextFieldInRow(
      row1,
      "远程名称",
      this.settings.gitRemoteName,
      (v) => (this.settings.gitRemoteName = v.trim() || "origin"),
      "origin"
    );
    this.createTextFieldInRow(
      row1,
      "分支名",
      this.settings.gitBranchName,
      (v) => (this.settings.gitBranchName = v.trim() || "main"),
      "main"
    );

    // Username + Token in one row
    const row2 = contentEl.createDiv("dashboard-git-config-row");
    this.createTextFieldInRow(
      row2,
      "GitHub 用户名",
      this.settings.gitUsername,
      (v) => (this.settings.gitUsername = v.trim()),
      "your-username"
    );
    this.createPasswordFieldInRow(
      row2,
      "GitHub Token",
      this.settings.gitPassword,
      (v) => (this.settings.gitPassword = v.trim()),
      "your-token"
    );

    // Auto push toggle + interval
    this.createToggle(contentEl, "自动 Push", this.settings.gitAutoPushEnabled, (v) => {
      this.settings.gitAutoPushEnabled = v;
    });

    if (this.settings.gitAutoPushEnabled) {
      this.createTextField(
        contentEl,
        "自动 Push 间隔（分钟）",
        String(this.settings.gitAutoPushInterval),
        (v) => {
          const n = parseInt(v);
          if (!isNaN(n) && n >= 0) this.settings.gitAutoPushInterval = n;
        },
        "0 = 每次变更后推送"
      );
    }

    // Git status polling interval
    this.createTextField(
      contentEl,
      "状态刷新间隔（秒）",
      String(this.settings.gitPollInterval),
      (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n >= 0) this.settings.gitPollInterval = n;
      },
      "30（0 = 关闭轮询，仅在 vault 变更时刷新）"
    );

    // Push/Pull timeout
    this.createTextField(
      contentEl,
      "Push/Pull 超时（分钟）",
      String(this.settings.gitPushTimeout),
      (v) => {
        const n = parseInt(v);
        if (!isNaN(n) && n >= 0) this.settings.gitPushTimeout = n;
      },
      "5（0 = 不限时；大仓库首次推送可设 10 或更大）"
    );

    // Commit template with preview
    this.createTextFieldWithPreview(
      contentEl,
      "Commit 消息模板",
      this.settings.gitCommitTemplate,
      (v) => (this.settings.gitCommitTemplate = v.trim()),
      "auto: {{date}} {{time}}"
    );

    // Token help text
    contentEl.createDiv({
      text: "Token 获取地址: https://github.com/settings/tokens",
      cls: "dashboard-field-hint",
    });

    // Buttons
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "保存", cls: "mod-cta" });
    saveBtn.addEventListener("click", async () => {
      await this.onSave(this.settings);
      this.close();
      new Notice("Git 配置已保存");
    });
  }

  private createToggle(
    parent: HTMLElement,
    label: string,
    value: boolean,
    onChange: (v: boolean) => void
  ) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const toggle = row.createEl("label", { cls: "dashboard-toggle" });
    const cb = toggle.createEl("input") as HTMLInputElement;
    cb.type = "checkbox";
    cb.checked = value;
    cb.addEventListener("change", () => onChange(cb.checked));
    toggle.createEl("span", { cls: "dashboard-toggle-slider" });
  }

  private createTextField(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    example?: string
  ) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const wrap = row.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
    this.addExampleHint(wrap, input, example ?? placeholder);
  }

  private createTextFieldInRow(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string,
    example?: string
  ) {
    const field = parent.createDiv("dashboard-git-config-half");
    field.createEl("label", { text: label, cls: "dashboard-git-config-label" });
    const wrap = field.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.style.width = "100%";
    input.addEventListener("input", () => onChange(input.value));
    this.addExampleHint(wrap, input, example ?? placeholder);
  }

  private createPasswordFieldInRow(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) {
    const field = parent.createDiv("dashboard-git-config-half");
    field.createEl("label", { text: label, cls: "dashboard-git-config-label" });
    const input = field.createEl("input") as HTMLInputElement;
    input.type = "password";
    input.placeholder = placeholder;
    input.value = value;
    input.style.width = "100%";
    input.addEventListener("input", () => onChange(input.value));
  }

  private createTextFieldWithPreview(
    parent: HTMLElement,
    label: string,
    value: string,
    onChange: (v: string) => void,
    placeholder: string
  ) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const wrap = row.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input") as HTMLInputElement;
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    const preview = row.createDiv("dashboard-format-preview");
    const updatePreview = () => {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const time = now.toTimeString().slice(0, 8);
      const example = (input.value || placeholder)
        .replace(/\{\{date\}\}/g, date)
        .replace(/\{\{time\}\}/g, time);
      preview.textContent = `示例: ${example}`;
    };
    input.addEventListener("input", () => {
      onChange(input.value);
      updatePreview();
    });
    updatePreview();
    this.addExampleHint(wrap, input, placeholder);
  }

  private addExampleHint(wrap: HTMLElement, input: HTMLInputElement, example: string) {
    if (!example || example === "sk-..." || example === "https://..." || example === "your-token") return;
    const hint = wrap.createEl("span", { cls: "dashboard-example-hint", text: "📋", attr: { "data-tooltip": example } });
    hint.addEventListener("click", () => {
      input.value = example;
      input.dispatchEvent(new Event("input"));
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
