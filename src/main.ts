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

    this.addRibbonIcon("layout-dashboard", "打开 Dashboard", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-dashboard",
      name: "打开 Dashboard",
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
    // Deep-merge taskDefaults
    if (saved?.taskDefaults) {
      this.settings.taskDefaults = Object.assign({}, DEFAULT_SETTINGS.taskDefaults, saved.taskDefaults);
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
    containerEl.createEl("h2", { text: "Dashboard 设置" });

    new Setting(containerEl)
      .setName("标签页标题")
      .setDesc("自定义 Dashboard 标签页显示的名称，可随时修改")
      .addText((text) =>
        text
          .setPlaceholder("Dashboard")
          .setValue(this.plugin.settings.dashboardTitle)
          .onChange(async (value) => {
            this.plugin.settings.dashboardTitle = value.trim() || "Dashboard";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("标签页描述")
      .setDesc("显示在标签页标题下方的描述文字")
      .addText((text) =>
        text
          .setPlaceholder("禹思天下有溺者，由己溺之也")
          .setValue(this.plugin.settings.dashboardDesc)
          .onChange(async (value) => {
            this.plugin.settings.dashboardDesc = value.trim();
            await this.plugin.saveSettings();
          })
      );

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

    // ─── Git Sync Config ──────────────────────────────────────────────────────

    containerEl.createEl("h3", { text: "Git 同步 (Gitee)" });

    new Setting(containerEl)
      .setName("启用 Git 同步")
      .setDesc("开启后可在 Dashboard 中进行 Push/Pull 操作")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.gitEnabled)
          .onChange(async (value) => {
            this.plugin.settings.gitEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("仓库地址")
      .setDesc("Gitee 仓库 HTTPS 地址，如 https://gitee.com/username/repo.git")
      .addText((text) =>
        text
          .setPlaceholder("https://gitee.com/username/repo.git")
          .setValue(this.plugin.settings.gitRemoteURL)
          .onChange(async (value) => {
            this.plugin.settings.gitRemoteURL = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("远程名称")
      .setDesc("Git remote 名称，默认 origin")
      .addText((text) =>
        text
          .setPlaceholder("origin")
          .setValue(this.plugin.settings.gitRemoteName)
          .onChange(async (value) => {
            this.plugin.settings.gitRemoteName = value.trim() || "origin";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("分支名")
      .setDesc("默认分支名，如 main 或 master")
      .addText((text) =>
        text
          .setPlaceholder("main")
          .setValue(this.plugin.settings.gitBranchName)
          .onChange(async (value) => {
            this.plugin.settings.gitBranchName = value.trim() || "main";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Gitee 用户名")
      .setDesc("Gitee 登录用户名或邮箱")
      .addText((text) =>
        text
          .setPlaceholder("your-username")
          .setValue(this.plugin.settings.gitUsername)
          .onChange(async (value) => {
            this.plugin.settings.gitUsername = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Gitee Token")
      .setDesc("Gitee 私人令牌（https://gitee.com/profile/personal_access_tokens），存储于本地 data.json 中")
      .addText((text) => {
        text
          .setPlaceholder("your-token")
          .setValue(this.plugin.settings.gitPassword)
          .onChange(async (value) => {
            this.plugin.settings.gitPassword = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("自动 Push")
      .setDesc("开启后按设定的时间间隔自动 push")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.gitAutoPushEnabled)
          .onChange(async (value) => {
            this.plugin.settings.gitAutoPushEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("自动 Push 间隔（分钟）")
      .setDesc("设为 0 表示每次 vault 变更后自动 push")
      .addText((text) =>
        text
          .setPlaceholder("30")
          .setValue(String(this.plugin.settings.gitAutoPushInterval))
          .onChange(async (value) => {
            const n = parseInt(value);
            if (!isNaN(n) && n >= 0) {
              this.plugin.settings.gitAutoPushInterval = n;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Commit 消息模板")
      .setDesc("支持 {{date}} 和 {{time}} 占位符")
      .addText((text) =>
        text
          .setPlaceholder("auto: {{date}} {{time}}")
          .setValue(this.plugin.settings.gitCommitTemplate)
          .onChange(async (value) => {
            this.plugin.settings.gitCommitTemplate = value.trim();
            await this.plugin.saveSettings();
          })
      );
  }
}
