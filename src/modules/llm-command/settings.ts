import { Setting } from "obsidian";
import { DashboardSettings } from "../../types";

export interface SettingsContext {
  settings: DashboardSettings;
  saveSettings: () => Promise<void>;
}

function addExampleHint(setting: Setting, example: string) {
  const input = setting.controlEl.querySelector("input");
  if (!input) return;
  const hint = createSpan({ cls: "dashboard-example-hint", text: "📋", attr: { "data-tooltip": example } });
  hint.addEventListener("click", () => {
    input.value = example;
    input.dispatchEvent(new Event("input"));
  });
  setting.controlEl.appendChild(hint);
}

export function renderLLMSettings(containerEl: HTMLElement, ctx: SettingsContext) {
  containerEl.createEl("h3", { text: "模型配置" });

  const s1 = new Setting(containerEl)
    .setName("API Base URL")
    .setDesc("OpenAI Compatible 接口地址")
    .addText((text) =>
      text
        .setPlaceholder("https://api.openai.com/v1")
        .setValue(ctx.settings.apiBaseUrl)
        .onChange(async (value) => {
          ctx.settings.apiBaseUrl = value;
          await ctx.saveSettings();
        })
    );
  addExampleHint(s1, "https://api.openai.com/v1");

  new Setting(containerEl)
    .setName("API Key")
    .setDesc("你的 API 密钥。⚠ 明文保存在 data.json，若启用 Git 同步请确认已忽略该文件")
    .addText((text) => {
      text
        .setPlaceholder("sk-...")
        .setValue(ctx.settings.apiKey)
        .onChange(async (value) => {
          ctx.settings.apiKey = value;
          await ctx.saveSettings();
        });
      text.inputEl.type = "password";
    });

  const s2 = new Setting(containerEl)
    .setName("模型名称")
    .addText((text) =>
      text
        .setPlaceholder("gpt-4o")
        .setValue(ctx.settings.modelName)
        .onChange(async (value) => {
          ctx.settings.modelName = value;
          await ctx.saveSettings();
        })
    );
  addExampleHint(s2, "gpt-4o");

  new Setting(containerEl)
    .setName("Temperature")
    .addSlider((slider) =>
      slider
        .setLimits(0, 2, 0.1)
        .setValue(ctx.settings.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          ctx.settings.temperature = value;
          await ctx.saveSettings();
        })
    );

  new Setting(containerEl)
    .setName("Max Tokens")
    .addText((text) =>
      text
        .setValue(String(ctx.settings.maxTokens))
        .onChange(async (value) => {
          const n = parseInt(value);
          if (!isNaN(n)) {
            ctx.settings.maxTokens = n;
            await ctx.saveSettings();
          }
        })
    );

  new Setting(containerEl)
    .setName("用量接口地址")
    .setDesc("选填。填写后优先使用接口数据，否则用本地统计")
    .addText((text) =>
      text
        .setPlaceholder("https://...")
        .setValue(ctx.settings.tokenUsageApiUrl)
        .onChange(async (value) => {
          ctx.settings.tokenUsageApiUrl = value;
          await ctx.saveSettings();
        })
    );

  const s3 = new Setting(containerEl)
    .setName("余额接口地址")
    .setDesc("选填。如 DeepSeek: https://api.deepseek.com/user/balance")
    .addText((text) =>
      text
        .setPlaceholder("https://...")
        .setValue(ctx.settings.tokenBalanceApiUrl)
        .onChange(async (value) => {
          ctx.settings.tokenBalanceApiUrl = value;
          await ctx.saveSettings();
        })
    );
  addExampleHint(s3, "https://api.deepseek.com/user/balance");
}
