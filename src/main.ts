import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { DashboardSettings, DEFAULT_SETTINGS, MODULE_IDS, MODULE_LABELS, defaultModuleVisibility } from "./types";
import { DashboardView, DASHBOARD_VIEW_TYPE } from "./ui/DashboardView";
import { renderLLMSettings, type SettingsContext } from "./modules/llm-command/settings";
import { renderFileStatsSettings } from "./modules/file-stats/settings";
import { renderReportSettings } from "./modules/heatmap/settings";
import { renderGitSettings } from "./modules/git-sync/settings";

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

    // Open dashboard on startup if enabled
    if (this.settings.openOnStartup) {
      this.app.workspace.onLayoutReady(() => this.activateView());
    }
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
    // Migrate moduleOrder: drop unknown ids, append any new modules
    const known = new Set<string>(MODULE_IDS);
    this.settings.moduleOrder = this.settings.moduleOrder.filter((id) => known.has(id));
    const orderSet = new Set(this.settings.moduleOrder);
    for (const mid of MODULE_IDS) {
      if (!orderSet.has(mid)) this.settings.moduleOrder.push(mid);
    }
    // Merge moduleVisibility with defaults
    this.settings.moduleVisibility = Object.assign(
      defaultModuleVisibility(),
      this.settings.moduleVisibility ?? {}
    );
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

    const ctx: SettingsContext = {
      settings: this.plugin.settings,
      saveSettings: () => this.plugin.saveSettings(),
    };

    const s1 = new Setting(containerEl)
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
    this.addExampleHint(s1, "Dashboard");

    const s2 = new Setting(containerEl)
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
    this.addExampleHint(s2, "禹思天下有溺者，由己溺之也");

    new Setting(containerEl)
      .setName("启动时自动打开 Dashboard")
      .setDesc("Obsidian 启动、布局就绪后自动打开 Dashboard 面板")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.openOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    containerEl.createEl("h3", { text: "模块显示" });
    containerEl.createEl("p", {
      text: "关闭后该模块不在 Dashboard 中显示；可在 Dashboard 中拖拽排序、点击标题折叠。",
      cls: "dashboard-field-hint",
    });
    for (const mid of MODULE_IDS) {
      new Setting(containerEl)
        .setName(MODULE_LABELS[mid])
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.moduleVisibility?.[mid] !== false)
            .onChange(async (value) => {
              if (!this.plugin.settings.moduleVisibility) {
                this.plugin.settings.moduleVisibility = {};
              }
              this.plugin.settings.moduleVisibility[mid] = value;
              await this.plugin.saveSettings();
            })
        );
    }

    renderLLMSettings(containerEl, ctx);
    renderFileStatsSettings(containerEl, ctx);
    renderReportSettings(containerEl, ctx);
    renderGitSettings(containerEl, ctx);
  }

  private addExampleHint(setting: Setting, example: string) {
    const input = setting.controlEl.querySelector("input");
    if (!input) return;
    const hint = createSpan({ cls: "dashboard-example-hint", text: "📋", attr: { "data-tooltip": example } });
    hint.addEventListener("click", () => {
      input.value = example;
      input.dispatchEvent(new Event("input"));
    });
    setting.controlEl.appendChild(hint);
  }
}
