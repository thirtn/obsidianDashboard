import { Setting } from "obsidian";
import type { SettingsContext } from "../llm-command/settings";

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

function addCommitPreview(setting: Setting) {
  const input = setting.controlEl.querySelector("input") as HTMLInputElement;
  if (!input) return;
  const preview = createSpan({ cls: "dashboard-format-preview" });
  const updatePreview = () => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toTimeString().slice(0, 8);
    const val = input.value || input.placeholder;
    const example = val
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{time\}\}/g, time);
    preview.textContent = `示例: ${example}`;
  };
  updatePreview();
  input.addEventListener("input", updatePreview);
  setting.descEl.appendChild(preview);
}

export function renderGitSettings(containerEl: HTMLElement, ctx: SettingsContext) {
  containerEl.createEl("h3", { text: "Git 同步 (GitHub)" });

  new Setting(containerEl)
    .setName("启用 Git 同步")
    .setDesc("开启后可在 Dashboard 中进行 Push/Pull 操作")
    .addToggle((toggle) =>
      toggle
        .setValue(ctx.settings.gitEnabled)
        .onChange(async (value) => {
          ctx.settings.gitEnabled = value;
          await ctx.saveSettings();
        })
    );

  const s1 = new Setting(containerEl)
    .setName("仓库地址")
    .setDesc("GitHub 仓库 HTTPS 地址，如 https://github.com/username/repo.git")
    .addText((text) =>
      text
        .setPlaceholder("https://github.com/username/repo.git")
        .setValue(ctx.settings.gitRemoteURL)
        .onChange(async (value) => {
          ctx.settings.gitRemoteURL = value.trim();
          await ctx.saveSettings();
        })
    );
  addExampleHint(s1, "https://github.com/username/repo.git");

  const s2 = new Setting(containerEl)
    .setName("远程名称")
    .setDesc("Git remote 名称，默认 origin")
    .addText((text) =>
      text
        .setPlaceholder("origin")
        .setValue(ctx.settings.gitRemoteName)
        .onChange(async (value) => {
          ctx.settings.gitRemoteName = value.trim() || "origin";
          await ctx.saveSettings();
        })
    );
  addExampleHint(s2, "origin");

  const s3 = new Setting(containerEl)
    .setName("分支名")
    .setDesc("默认分支名，如 main 或 master")
    .addText((text) =>
      text
        .setPlaceholder("main")
        .setValue(ctx.settings.gitBranchName)
        .onChange(async (value) => {
          ctx.settings.gitBranchName = value.trim() || "main";
          await ctx.saveSettings();
        })
    );
  addExampleHint(s3, "main");

  const s4 = new Setting(containerEl)
    .setName("GitHub 用户名")
    .setDesc("GitHub 登录用户名或邮箱")
    .addText((text) =>
      text
        .setPlaceholder("your-username")
        .setValue(ctx.settings.gitUsername)
        .onChange(async (value) => {
          ctx.settings.gitUsername = value.trim();
          await ctx.saveSettings();
        })
    );
  addExampleHint(s4, "your-username");

  new Setting(containerEl)
    .setName("GitHub Token")
    .setDesc("GitHub 私人令牌（https://github.com/settings/tokens）。⚠ 明文保存在 data.json，请务必将该文件加入 .gitignore")
    .addText((text) => {
      text
        .setPlaceholder("your-token")
        .setValue(ctx.settings.gitPassword)
        .onChange(async (value) => {
          ctx.settings.gitPassword = value.trim();
          await ctx.saveSettings();
        });
      text.inputEl.type = "password";
    });

  new Setting(containerEl)
    .setName("自动 Push")
    .setDesc("开启后按设定的时间间隔自动 push")
    .addToggle((toggle) =>
      toggle
        .setValue(ctx.settings.gitAutoPushEnabled)
        .onChange(async (value) => {
          ctx.settings.gitAutoPushEnabled = value;
          await ctx.saveSettings();
        })
    );

  const s5 = new Setting(containerEl)
    .setName("自动 Push 间隔（分钟）")
    .setDesc("设为 0 表示每次 vault 变更后自动 push")
    .addText((text) =>
      text
        .setPlaceholder("30")
        .setValue(String(ctx.settings.gitAutoPushInterval))
        .onChange(async (value) => {
          const n = parseInt(value);
          if (!isNaN(n) && n >= 0) {
            ctx.settings.gitAutoPushInterval = n;
            await ctx.saveSettings();
          }
        })
    );
  addExampleHint(s5, "30");

  const sPoll = new Setting(containerEl)
    .setName("Git 状态刷新间隔（秒）")
    .setDesc("Dashboard 中 Git 模块自动刷新 status 的间隔。设为 0 表示不轮询（仍会在 vault 变更时刷新）")
    .addText((text) =>
      text
        .setPlaceholder("30")
        .setValue(String(ctx.settings.gitPollInterval))
        .onChange(async (value) => {
          const n = parseInt(value);
          if (!isNaN(n) && n >= 0) {
            ctx.settings.gitPollInterval = n;
            await ctx.saveSettings();
          }
        })
    );
  addExampleHint(sPoll, "30");

  const sTimeout = new Setting(containerEl)
    .setName("Push/Pull 超时（分钟）")
    .setDesc("网络传输超时时间。设为 0 表示不限时；大仓库首次推送建议设 10 或更大")
    .addText((text) =>
      text
        .setPlaceholder("5")
        .setValue(String(ctx.settings.gitPushTimeout))
        .onChange(async (value) => {
          const n = parseInt(value);
          if (!isNaN(n) && n >= 0) {
            ctx.settings.gitPushTimeout = n;
            await ctx.saveSettings();
          }
        })
    );
  addExampleHint(sTimeout, "5");

  const s6 = new Setting(containerEl)
    .setName("Commit 消息模板")
    .setDesc("支持 {{date}} 和 {{time}} 占位符")
    .addText((text) =>
      text
        .setPlaceholder("auto: {{date}} {{time}}")
        .setValue(ctx.settings.gitCommitTemplate)
        .onChange(async (value) => {
          ctx.settings.gitCommitTemplate = value.trim();
          await ctx.saveSettings();
        })
    );
  addExampleHint(s6, "auto: {{date}} {{time}}");
  addCommitPreview(s6);
}
