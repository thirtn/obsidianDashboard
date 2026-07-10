import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { DashboardSettings, DEFAULT_SETTINGS, ReportType } from "./types";
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
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    // Deep-merge reportConfigs so new fields get defaults
    if (saved?.reportConfigs) {
      this.settings.reportConfigs = Object.assign({}, DEFAULT_SETTINGS.reportConfigs);
      for (const key of Object.keys(this.settings.reportConfigs)) {
        if ((saved.reportConfigs as any)[key]) {
          Object.assign((this.settings.reportConfigs as any)[key], (saved.reportConfigs as any)[key]);
        }
      }
    }
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

    // ─── Report Configs ──────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "报表配置" });

    const reportLabels: Record<ReportType, string> = {
      daily: "日报",
      weekly: "周报",
      monthly: "月报",
      quarterly: "季报",
      yearly: "年报",
    };

    for (const type of Object.keys(reportLabels) as ReportType[]) {
      const cfg = this.plugin.settings.reportConfigs[type];
      containerEl.createEl("h4", { text: reportLabels[type] });

      new Setting(containerEl)
        .setName("启用")
        .addToggle((toggle) =>
          toggle
            .setValue(cfg.enabled)
            .onChange(async (value) => {
              cfg.enabled = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("新建时弹窗确认")
        .setDesc("点击没有对应报告的日期时，是否先弹窗确认再新建")
        .addToggle((toggle) =>
          toggle
            .setValue(cfg.confirmBeforeCreate)
            .onChange(async (value) => {
              cfg.confirmBeforeCreate = value;
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("存放目录")
        .setDesc("文件存储的根目录")
        .addText((text) =>
          text
            .setValue(cfg.directory)
            .onChange(async (value) => {
              cfg.directory = value.trim();
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("文件路径格式")
        .setDesc(`支持 YYYY/YY/MM/M/DD/D 等 moment.js 格式令牌。如 YYYY/MM/YYYY-MM-DD`)
        .addText((text) =>
          text
            .setValue(cfg.filenameFormat)
            .onChange(async (value) => {
              cfg.filenameFormat = value.trim();
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("模板路径")
        .setDesc("vault 中的模板文件路径（不含 .md 后缀），留空则不使用模板")
        .addText((text) =>
          text
            .setValue(cfg.templatePath)
            .onChange(async (value) => {
              cfg.templatePath = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }
  }
}
