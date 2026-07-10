import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { DashboardSettings, DEFAULT_SETTINGS } from "./types";
import { DashboardView, DASHBOARD_VIEW_TYPE } from "./ui/DashboardView";

export default class LLMWikiDashboardPlugin extends Plugin {
  settings!: DashboardSettings;

  async onload() {
    await this.loadSettings();

    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) =>
      new DashboardView(leaf, this.settings, this.saveSettings.bind(this))
    );

    this.addRibbonIcon("layout-dashboard", "yyObsidianDashboard", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-dashboard",
      name: "打开 yyObsidianDashboard",
      callback: () => this.activateView(),
    });

    this.addSettingTab(new DashboardSettingTab(this.app, this));
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
  }

  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);

    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(settings?: DashboardSettings) {
    if (settings) this.settings = settings;
    await this.saveData(this.settings);

    // Propagate to all open views
    this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DashboardView) {
        view.updateSettings(this.settings);
      }
    });
  }
}

class DashboardSettingTab extends PluginSettingTab {
  plugin: LLMWikiDashboardPlugin;

  constructor(app: App, plugin: LLMWikiDashboardPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "yyObsidianDashboard 设置" });

    new Setting(containerEl)
      .setName("API Base URL")
      .setDesc("OpenAI Compatible 接口地址")
      .addText((text) =>
        text
          .setPlaceholder("https://api.openai.com/v1")
          .setValue(this.plugin.settings.apiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiBaseUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("API Key")
      .setDesc("你的 API 密钥")
      .addText((text) => {
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("模型名称")
      .addText((text) =>
        text
          .setPlaceholder("gpt-4o")
          .setValue(this.plugin.settings.modelName)
          .onChange(async (value) => {
            this.plugin.settings.modelName = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Temperature")
      .addSlider((slider) =>
        slider
          .setLimits(0, 2, 0.1)
          .setValue(this.plugin.settings.temperature)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.temperature = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Max Tokens")
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.maxTokens))
          .onChange(async (value) => {
            const n = parseInt(value);
            if (!isNaN(n)) {
              this.plugin.settings.maxTokens = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("用量接口地址")
      .setDesc("选填。填写后优先使用接口数据，否则用本地统计")
      .addText((text) =>
        text
          .setPlaceholder("https://...")
          .setValue(this.plugin.settings.tokenUsageApiUrl)
          .onChange(async (value) => {
            this.plugin.settings.tokenUsageApiUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("余额接口地址")
      .setDesc("选填。如 DeepSeek: https://api.deepseek.com/user/balance")
      .addText((text) =>
        text
          .setPlaceholder("https://...")
          .setValue(this.plugin.settings.tokenBalanceApiUrl)
          .onChange(async (value) => {
            this.plugin.settings.tokenBalanceApiUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("统计文件夹")
      .setDesc("逗号分隔的文件夹路径列表，如 raw, wiki, raw/子目录")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.trackedFolders.join(", "))
          .onChange(async (value) => {
            this.plugin.settings.trackedFolders = value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          })
      );
  }
}
