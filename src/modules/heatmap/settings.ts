import { Setting } from "obsidian";
import { ReportType } from "./types";
import type { SettingsContext } from "../llm-command/settings";

const reportLabels: Record<ReportType, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
  quarterly: "季报",
  yearly: "年报",
};

export function renderReportSettings(containerEl: HTMLElement, ctx: SettingsContext) {
  containerEl.createEl("h3", { text: "报表配置" });

  for (const type of Object.keys(reportLabels) as ReportType[]) {
    const cfg = ctx.settings.reportConfigs[type];
    containerEl.createEl("h4", { text: reportLabels[type] });

    new Setting(containerEl)
      .setName("启用")
      .addToggle((toggle) =>
        toggle
          .setValue(cfg.enabled)
          .onChange(async (value) => {
            cfg.enabled = value;
            await ctx.saveSettings();
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
            await ctx.saveSettings();
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
            await ctx.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("文件路径格式")
      .setDesc("支持 YYYY/YY/MM/M/DD/D 等 moment.js 格式令牌。如 YYYY/MM/YYYY-MM-DD")
      .addText((text) =>
        text
          .setValue(cfg.filenameFormat)
          .onChange(async (value) => {
            cfg.filenameFormat = value.trim();
            await ctx.saveSettings();
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
            await ctx.saveSettings();
          })
      );
  }
}
