import { Setting } from "obsidian";
import type { SettingsContext } from "../llm-command/settings";

export function renderFileStatsSettings(containerEl: HTMLElement, ctx: SettingsContext) {
  containerEl.createEl("h3", { text: "文件统计" });

  new Setting(containerEl)
    .setName("统计文件夹")
    .setDesc("逗号分隔的文件夹路径列表，如 raw, wiki, raw/子目录")
    .addText((text) =>
      text
        .setValue(ctx.settings.trackedFolders.join(", "))
        .onChange(async (value) => {
          ctx.settings.trackedFolders = value
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
          await ctx.saveSettings();
        })
    );
}
