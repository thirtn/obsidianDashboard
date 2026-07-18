import { App, Notice } from "obsidian";
import { BaseComponent } from "../../shared/BaseComponent";
import { DashboardSettings } from "../../types";
import { PluginManageService } from "./PluginManageService";

export class PluginManageComponent extends BaseComponent {
  private pluginService: PluginManageService;

  constructor(app: App, settings: DashboardSettings) {
    super(app, settings);
    this.pluginService = new PluginManageService(app);
  }

  get id(): string { return "plugin-manage"; }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const pmTitleWrap = header.createDiv("dashboard-module-title-wrap");
    pmTitleWrap.createEl("span", { text: "🔌", cls: "dashboard-module-icon" });
    pmTitleWrap.createEl("span", { text: "插件管理", cls: "dashboard-module-title" });

    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "Obsidian 插件设置" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.pluginService.openPluginSettings());

    const body = mod.createDiv("dashboard-module-body");
    const plugins = this.pluginService.getInstalledPlugins();

    if (plugins.length === 0) {
      body.createDiv({ text: "未检测到已安装插件", cls: "dashboard-empty" });
    } else {
      const table = body.createEl("table", { cls: "dashboard-plugin-table" });
      const hr = table.createEl("thead").createEl("tr");
      for (const h of ["插件名称", "说明", "版本", "启用", "设置"]) hr.createEl("th", { text: h });
      const tbody = table.createEl("tbody");

      for (const p of plugins) {
        const tr = tbody.createEl("tr");
        const nameTd = tr.createEl("td");
        if (p.hasSettings) {
          const link = nameTd.createEl("a", { text: p.name, cls: "dashboard-plugin-link" });
          link.addEventListener("click", () => this.pluginService.openSpecificPluginSettings(p.id));
        } else {
          nameTd.textContent = p.name;
        }

        const descTd = tr.createEl("td", { cls: "dashboard-plugin-desc" });
        descTd.textContent = p.description || "—";
        tr.createEl("td", { text: p.version, cls: "dashboard-plugin-version" });

        const toggleTd = tr.createEl("td");
        const toggle = toggleTd.createEl("label", { cls: "dashboard-toggle" });
        const cb = toggle.createEl("input") as HTMLInputElement;
        cb.type = "checkbox"; cb.checked = p.enabled;
        toggle.createEl("span", { cls: "dashboard-toggle-slider" });
        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try {
            await this.pluginService.togglePlugin(p.id, cb.checked);
            new Notice(`${p.name} 已${cb.checked ? "启用" : "禁用"}`);
          } catch (e: any) {
            new Notice(`操作失败: ${e.message}`);
            cb.checked = !cb.checked;
          } finally { cb.disabled = false; }
        });

        const settingsTd = tr.createEl("td");
        const settingsBtn = settingsTd.createEl("button", { cls: "dashboard-icon-btn", title: `${p.name} 设置` });
        settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
        settingsBtn.addEventListener("click", () => { this.pluginService.openSpecificPluginSettings(p.id); });
      }
    }
  }
}
