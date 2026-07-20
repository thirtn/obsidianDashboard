import { App, Modal, Notice } from "obsidian";
import { DashboardSettings } from "../../types";

const DEFAULT_WHISPER_URL = "https://api.openai.com/v1";
const DEFAULT_WHISPER_MODEL = "whisper-1";

export class VoiceConfigModal extends Modal {
  private settings: DashboardSettings;

  constructor(
    app: App,
    settings: DashboardSettings,
    private onSave: (s: DashboardSettings) => Promise<void>
  ) {
    super(app);
    this.settings = JSON.parse(JSON.stringify(settings));
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "语音转文字配置" });

    // Whisper API 地址
    this.createTextField(
      contentEl,
      "Whisper API 地址",
      "whisperApiBaseUrl",
      "text",
      "https://api.openai.com/v1"
    );

    // 模型名称
    this.createTextField(
      contentEl,
      "Whisper 模型名称",
      "whisperModelName",
      "text",
      DEFAULT_WHISPER_MODEL
    );

    contentEl.createDiv({
      text: "留空则使用 Dashboard 设置的 API Base URL。如果服务商不支持 Whisper（如 DeepSeek），请填入 OpenAI 的地址。",
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
      new Notice("语音转文字配置已保存");
    });
  }

  private createTextField(
    parent: HTMLElement,
    label: string,
    key: keyof DashboardSettings,
    type: string,
    placeholder: string
  ) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const inputWrap = row.createDiv("dashboard-input-wrap");
    const input = inputWrap.createEl("input") as HTMLInputElement;
    input.type = type;
    input.placeholder = placeholder;
    input.value = String(this.settings[key] ?? "");
    input.addEventListener("input", () => {
      (this.settings as any)[key] = input.value;
    });

    // Clickable example hint
    const hint = inputWrap.createEl("span", {
      cls: "dashboard-example-hint",
      text: "\uD83D\uDCCB",
      attr: { "data-tooltip": placeholder },
    });
    hint.addEventListener("click", () => {
      input.value = placeholder;
      input.dispatchEvent(new Event("input"));
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
