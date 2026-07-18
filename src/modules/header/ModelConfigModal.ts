import { App, Modal, Notice, requestUrl } from "obsidian";
import { DashboardSettings } from "../../types";
import { LLMService } from "../llm-command/LLMService";

export class ModelConfigModal extends Modal {
  private settings: DashboardSettings;
  private onSave: (settings: DashboardSettings) => void;
  private llmService: LLMService;
  private statusEl: HTMLElement | null = null;
  private modelSelect: HTMLSelectElement | null = null;

  constructor(
    app: App,
    settings: DashboardSettings,
    onSave: (settings: DashboardSettings) => void
  ) {
    super(app);
    this.settings = { ...settings };
    this.onSave = onSave;
    this.llmService = new LLMService(this.app, this.settings);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "设置" });

    contentEl.createEl("h3", { text: "标签设置" });
    this.createTextField(contentEl, "标签页标题", "dashboardTitle", "text", "Dashboard");
    this.createTextField(contentEl, "标签页描述", "dashboardDesc", "text", "禹思天下有溺者，由己溺之也");

    contentEl.createEl("h3", { text: "模型配置" });
    this.createTextField(contentEl, "API Base URL", "apiBaseUrl", "text", "https://api.openai.com/v1");
    this.createTextField(contentEl, "API Key", "apiKey", "password", "sk-...");
    this.createModelField(contentEl);
    this.createNumberField(contentEl, "Temperature", "temperature", 0, 2, 0.1);
    this.createNumberField(contentEl, "Max Tokens", "maxTokens", 256, 32768, 1);
    this.createTextField(contentEl, "用量接口地址（选填，未填则用本地统计）", "tokenUsageApiUrl", "text", "https://...");
    this.createTextField(contentEl, "余额接口地址（选填，如 DeepSeek: https://api.deepseek.com/user/balance）", "tokenBalanceApiUrl", "text", "https://...", "https://api.deepseek.com/user/balance");

    const actionsRow = contentEl.createDiv("dashboard-modal-actions");
    const testBtn = actionsRow.createEl("button", { text: "测试连接", cls: "mod-cta" });
    this.statusEl = actionsRow.createDiv("dashboard-connection-status");

    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      testBtn.textContent = "连接中...";
      if (this.statusEl) this.statusEl.textContent = "";

      try {
        this.llmService.updateSettings(this.settings);
        const models = await this.fetchModels();

        if (models.length > 0) {
          this.populateModelSelect(models);
          this.statusEl!.textContent = `✅ 连接正常，获取到 ${models.length} 个模型`;
          this.statusEl!.className = "dashboard-connection-status ok";
        } else {
          this.statusEl!.textContent = "✅ 连接正常";
          this.statusEl!.className = "dashboard-connection-status ok";
        }

        this.settings.lastConnectionStatus = "ok";
        this.settings.lastConnectionTime = new Date().toLocaleTimeString();
      } catch (e: any) {
        this.statusEl!.textContent = `❌ ${e.message}`;
        this.statusEl!.className = "dashboard-connection-status error";
        this.settings.lastConnectionStatus = "error";
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = "测试连接";
      }
    });

    const saveBtn = contentEl.createEl("button", { text: "保存", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.settings);
      this.close();
      new Notice("模型配置已保存");
    });

    const btnRow = contentEl.createDiv("dashboard-modal-actions");
    btnRow.style.cssText = "justify-content:flex-end;";
    btnRow.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());
    btnRow.appendChild(saveBtn);
  }

  private createModelField(parent: HTMLElement) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "模型名称" });

    const wrap = row.createDiv("dashboard-model-select-wrap");

    this.modelSelect = wrap.createEl("select", { cls: "dashboard-model-select" }) as HTMLSelectElement;
    const defaultOpt = this.modelSelect.createEl("option", {
      value: this.settings.modelName,
      text: this.settings.modelName,
    });
    defaultOpt.selected = true;

    this.modelSelect.addEventListener("change", () => {
      this.settings.modelName = this.modelSelect!.value;
    });

    const hint = wrap.createDiv({ text: "点击「测试连接」自动获取可用模型列表", cls: "dashboard-field-hint" });
  }

  private populateModelSelect(models: string[]) {
    if (!this.modelSelect) return;
    const current = this.settings.modelName;
    this.modelSelect.empty();

    for (const m of models) {
      const opt = this.modelSelect.createEl("option", { value: m, text: m });
      if (m === current) opt.selected = true;
    }

    // If current model not in list, auto-select the first real model from API
    if (!models.includes(current) && models.length > 0) {
      (this.modelSelect.options[0] as HTMLOptionElement).selected = true;
      this.settings.modelName = models[0];
    } else {
      this.settings.modelName = this.modelSelect.value;
    }

    const hint = this.modelSelect.parentElement?.querySelector(".dashboard-field-hint");
    if (hint) hint.textContent = `共 ${models.length} 个可用模型`;
  }

  private async fetchModels(): Promise<string[]> {
    const resp = await requestUrl({
      url: `${this.settings.apiBaseUrl}/models`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      throw: false,
    });

    if (resp.status === 401) throw new Error("401: API Key 无效");
    if (resp.status === 404) throw new Error("404: Base URL 不正确，DeepSeek 请填 https://api.deepseek.com/v1，OpenAI 请填 https://api.openai.com/v1");
    if (resp.status >= 400) throw new Error(`连接失败 (${resp.status})`);

    const data = resp.json;
    const items: any[] = data?.data ?? [];
    return items
      .map((m: any) => m.id as string)
      .filter(Boolean)
      .sort();
  }

  private createTextField(
    parent: HTMLElement,
    label: string,
    key: keyof DashboardSettings,
    type: string,
    placeholder: string,
    example?: string
  ): HTMLElement {
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
    const exampleVal = example || (placeholder && placeholder !== "https://..." && placeholder !== "sk-..." ? placeholder : "");
    if (exampleVal) {
      const hint = inputWrap.createEl("span", { cls: "dashboard-example-hint", text: "📋", attr: { "data-tooltip": exampleVal } });
      hint.addEventListener("click", () => {
        input.value = exampleVal;
        input.dispatchEvent(new Event("input"));
      });
    }
    return row;
  }

  private createNumberField(
    parent: HTMLElement,
    label: string,
    key: keyof DashboardSettings,
    min: number,
    max: number,
    step: number,
    example?: number
  ): HTMLElement {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const inputWrap = row.createDiv("dashboard-input-wrap");
    const input = inputWrap.createEl("input") as HTMLInputElement;
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.settings[key] ?? "");
    input.addEventListener("input", () => {
      (this.settings as any)[key] = parseFloat(input.value);
    });
    if (example !== undefined) {
      const hint = inputWrap.createEl("span", { cls: "dashboard-example-hint", text: "📋", attr: { "data-tooltip": String(example) } });
      hint.addEventListener("click", () => {
        input.value = String(example);
        input.dispatchEvent(new Event("input"));
      });
    }
    return row;
  }

  onClose() {
    this.contentEl.empty();
  }
}
