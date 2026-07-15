import { App, Modal, Notice, TFile } from "obsidian";
import { BaseComponent } from "./BaseComponent";
import { DashboardSettings } from "../../types";
import { GitService, GitFileStatus } from "../../services/GitService";
import { GitConfigModal } from "../../modals/GitConfigModal";

export class GitSyncComponent extends BaseComponent {
  private gitService: GitService;
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;
  private onAutoPushSetup: () => void;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private autoPushTimer: ReturnType<typeof setInterval> | null = null;
  private autoPushDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    app: App,
    settings: DashboardSettings,
    gitService: GitService,
    onSettingsChange: (s: DashboardSettings) => Promise<void>,
    onAutoPushSetup: () => void
  ) {
    super(app, settings);
    this.gitService = gitService;
    this.onSettingsChange = onSettingsChange;
    this.onAutoPushSetup = onAutoPushSetup;
  }

  get id(): string { return "git-sync"; }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-git-module";
    await this.buildContent(mod);
  }

  async update(): Promise<void> {
    const mod = document.getElementById("dashboard-git-module");
    if (!mod) return;
    mod.empty();
    await this.buildContent(mod);
  }

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.update(), 5000);
  }

  stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  setupAutoPush() {
    if (this.autoPushTimer) { clearInterval(this.autoPushTimer); this.autoPushTimer = null; }

    if (!this.settings.gitEnabled || !this.settings.gitAutoPushEnabled) return;
    if (this.gitService.isMobile) return;
    if (!this.settings.gitRemoteURL) return;

    const interval = this.settings.gitAutoPushInterval;
    if (interval > 0) {
      this.autoPushTimer = setInterval(() => {
        this.doAutoPush();
      }, interval * 60 * 1000);
    }
  }

  destroy(): void {
    this.stopPolling();
    if (this.autoPushTimer) { clearInterval(this.autoPushTimer); this.autoPushTimer = null; }
    if (this.autoPushDebounceTimer) { clearTimeout(this.autoPushDebounceTimer); this.autoPushDebounceTimer = null; }
    super.destroy();
  }

  // Called by external vault change handler for auto-push on change (interval === 0)
  triggerAutoPushDebounce() {
    if (
      this.settings.gitEnabled &&
      this.settings.gitAutoPushEnabled &&
      this.settings.gitAutoPushInterval === 0
    ) {
      if (this.autoPushDebounceTimer) clearTimeout(this.autoPushDebounceTimer);
      this.autoPushDebounceTimer = setTimeout(() => {
        this.doAutoPush();
      }, 5000);
    }
  }

  // ── Internal ──

  private async buildContent(mod: HTMLElement) {
    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    const titleWrap = header.createDiv();
    titleWrap.style.cssText = "display:flex;align-items:center;gap:8px;";
    titleWrap.createEl("span", { text: "🔗 Git 同步", cls: "dashboard-module-title" });

    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "Git 同步配置" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => {
      new GitConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
        this.settings = s;
        this.setupAutoPush();
        await this.update();
      }).open();
    });

    const body = mod.createDiv("dashboard-module-body");

    if (!this.settings.gitEnabled) {
      body.createDiv({
        text: "Git 同步未启用。请在设置中配置 GitHub 仓库信息并开启同步。",
        cls: "dashboard-git-mobile-hint",
      });
      const settingsBtn = body.createEl("button", { text: "打开设置", cls: "mod-cta" });
      settingsBtn.style.cssText = "width:100%;margin-top:8px;";
      settingsBtn.addEventListener("click", () => {
        const settingTabs = (this.app as any).setting;
        if (settingTabs) {
          settingTabs.open();
          settingTabs.openTabById("yy-obsidian-dashboard");
        }
      });
      return;
    }

    if (this.gitService.isMobile) {
      body.createDiv({
        text: "Git 同步仅在桌面端 Obsidian 可用。请使用桌面端进行 Push/Pull 操作。",
        cls: "dashboard-git-mobile-hint",
      });
      return;
    }

    const isRepo = await this.gitService.isGitRepo();

    if (!isRepo) {
      body.createDiv({
        text: "当前 vault 尚未初始化 Git 仓库",
        cls: "dashboard-git-notice",
      });
      const initBtn = body.createEl("button", { text: "初始化 Git 仓库", cls: "mod-cta dashboard-git-init-btn" });
      initBtn.addEventListener("click", async () => {
        initBtn.disabled = true;
        initBtn.textContent = "初始化中...";
        try {
          await this.gitService.initRepo();
          if (this.settings.gitRemoteURL) {
            await this.gitService.ensureRemote(this.settings.gitRemoteURL, this.settings.gitRemoteName);
          }
          new Notice("Git 仓库初始化成功");
          await this.update();
        } catch (e: any) {
          new Notice(`初始化失败: ${e.message}`);
          initBtn.disabled = false;
          initBtn.textContent = "初始化 Git 仓库";
        }
      });
      return;
    }

    let remoteOk = true;
    if (this.settings.gitRemoteURL) {
      try {
        await this.gitService.ensureRemote(this.settings.gitRemoteURL, this.settings.gitRemoteName);
      } catch {
        remoteOk = false;
      }
    }

    let status = { clean: true, files: [] as string[], ahead: 0, behind: 0 };
    try { status = await this.gitService.getStatus(); } catch { /* ignore */ }

    // Status row
    const statusRow = body.createDiv("dashboard-git-status");
    const dot = statusRow.createDiv(`dashboard-git-status-dot ${status.clean ? "clean" : "dirty"}`);
    const statusText = statusRow.createDiv("dashboard-git-status-text");
    if (status.clean && status.ahead === 0 && status.behind === 0) {
      statusText.createEl("span", { text: "已同步，工作区干净" });
    } else {
      if (!status.clean) {
        const fileSpan = statusText.createEl("span", {
          text: `${status.files.length} 个文件已变更`,
          cls: "dashboard-git-files-link",
        });
        this.attachFileListPopover(fileSpan, status.files);
      }
      if (status.ahead > 0) {
        if (!status.clean) statusText.createEl("span", { text: " | " });
        statusText.createEl("span", { text: `领先 ${status.ahead} 个提交` });
      }
      if (status.behind > 0) {
        if (!status.clean || status.ahead > 0) statusText.createEl("span", { text: " | " });
        statusText.createEl("span", { text: `落后 ${status.behind} 个提交` });
      }
    }

    if (!remoteOk) {
      statusRow.createDiv({ text: "未能配置远程仓库，请检查仓库地址", cls: "dashboard-git-warn" });
    }

    // Action buttons
    const actions = body.createDiv("dashboard-git-actions");

    const pullBtn = actions.createEl("button", { text: "⬇ Pull", cls: "dashboard-git-btn", title: "从远程拉取最新代码" });
    pullBtn.addEventListener("click", async () => {
      pullBtn.disabled = true;
      pullBtn.textContent = "拉取中...";
      try {
        const result = await this.gitService.pull(
          this.settings.gitRemoteName, this.settings.gitBranchName,
          this.settings.gitUsername || undefined, this.settings.gitPassword || undefined
        );
        new Notice(result);
        await this.update();
      } catch (e: any) {
        new Notice(`Pull 失败: ${e.message}`);
      } finally {
        pullBtn.disabled = false;
        pullBtn.textContent = "⬇ Pull";
      }
    });

    const pushBtn = actions.createEl("button", { text: "⬆ Push", cls: "mod-cta dashboard-git-btn", title: "提交并推送所有变更" });
    pushBtn.addEventListener("click", async () => {
      const files = await this.gitService.getStatusFiles();
      if (files.length === 0) {
        new Notice("没有需要提交的文件");
        return;
      }
      this.showPushConfirmModal(files);
    });

    const rollbackBtn = actions.createEl("button", { text: "↩ Rollback", cls: "dashboard-git-btn", title: "回滚未暂存的变更" });
    rollbackBtn.addEventListener("click", async () => {
      const files = await this.gitService.getStatusFiles();
      if (files.length === 0) {
        new Notice("没有可以回滚的变更");
        return;
      }
      this.showRollbackConfirmModal(files);
    });

    // Auto-push toggle
    const autoRow = body.createDiv("dashboard-git-auto-row");
    const autoLabel = autoRow.createEl("label", { cls: "dashboard-git-auto-label" });
    autoLabel.createEl("span", { text: "自动 Push" });
    const autoToggle = autoLabel.createEl("input") as HTMLInputElement;
    autoToggle.type = "checkbox";
    autoToggle.checked = this.settings.gitAutoPushEnabled;
    autoToggle.addEventListener("change", async () => {
      this.settings.gitAutoPushEnabled = autoToggle.checked;
      await this.onSettingsChange(this.settings);
      this.setupAutoPush();
    });
    autoRow.createEl("span", {
      text: this.settings.gitAutoPushInterval === 0
        ? "每次变更后自动推送"
        : `每 ${this.settings.gitAutoPushInterval} 分钟自动推送`,
      cls: "dashboard-git-auto-hint",
    });

    // Recent commits
    const commits = await this.gitService.getRecentCommits(5);
    if (commits.length > 0) {
      const commitSection = body.createDiv("dashboard-git-commits");
      commitSection.createEl("span", { text: "最近提交", cls: "dashboard-git-commits-title" });
      for (const c of commits) {
        const row = commitSection.createDiv("dashboard-git-commit-row");
        const hashEl = row.createEl("span", { text: c.hash, cls: "dashboard-git-commit-hash" });
        hashEl.style.cursor = "pointer";
        this.attachCommitFilePopover(hashEl, c.hash);
        row.createEl("span", { text: c.author, cls: "dashboard-git-commit-author" });
        row.createEl("span", { text: c.message, cls: "dashboard-git-commit-msg" });
        row.createEl("span", { text: this.formatGitDate(c.date), cls: "dashboard-git-commit-date" });
      }
    }
  }

  // ── Auto push ──

  private async doAutoPush() {
    if (this.gitService.isMobile) return;
    try {
      const isRepo = await this.gitService.isGitRepo();
      if (!isRepo) return;
      const msg = this.buildCommitMessage();
      await this.gitService.pushAll(
        this.settings.gitRemoteName, this.settings.gitBranchName, msg,
        this.settings.gitUsername || undefined, this.settings.gitPassword || undefined
      );
      console.log("[yyDashboard] Auto push completed");
    } catch (e: any) {
      console.log(`[yyDashboard] Auto push failed: ${e.message}`);
    }
  }

  private buildCommitMessage(): string {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toTimeString().slice(0, 8);
    return this.settings.gitCommitTemplate
      .replace(/\{\{date\}\}/g, date)
      .replace(/\{\{time\}\}/g, time);
  }

  private formatGitDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 60000);
      if (diff < 1) return "刚刚";
      if (diff < 60) return `${diff} 分钟前`;
      if (diff < 1440) return `${Math.floor(diff / 60)} 小时前`;
      if (diff < 43200) return `${Math.floor(diff / 1440)} 天前`;
      return dateStr.slice(0, 10);
    } catch { return dateStr; }
  }

  // ── Popovers ──

  private attachFileListPopover(trigger: HTMLElement, files: string[]) {
    let popover: HTMLElement | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
    const remove = () => { clearTimer(); if (popover) { popover.remove(); popover = null; } };

    const show = () => {
      clearTimer();
      remove();
      popover = document.body.createDiv("dashboard-popover");
      popover.createDiv("dashboard-popover-title").textContent = `变更文件 (${files.length})`;
      for (const filePath of files) {
        popover.createDiv("dashboard-popover-item").textContent = filePath;
      }
      const rect = trigger.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
      popover.addEventListener("mouseenter", clearTimer);
      popover.addEventListener("mouseleave", () => { hideTimer = setTimeout(remove, 200); });
    };

    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", () => { hideTimer = setTimeout(remove, 200); });
  }

  private attachCommitFilePopover(trigger: HTMLElement, commitHash: string) {
    let popover: HTMLElement | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => { if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; } };
    const remove = () => { clearTimer(); if (popover) { popover.remove(); popover = null; } };

    const show = async () => {
      clearTimer();
      remove();
      popover = document.body.createDiv("dashboard-popover");
      popover.createDiv("dashboard-popover-title").textContent = "加载中...";
      const rect = trigger.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
      popover.addEventListener("mouseenter", clearTimer);
      popover.addEventListener("mouseleave", () => { hideTimer = setTimeout(remove, 200); });

      const files = await this.gitService.getCommitFiles(commitHash);
      popover.empty();
      popover.createDiv("dashboard-popover-title").textContent = `提交 ${commitHash} (${files.length} 个文件)`;

      if (files.length === 0) {
        popover.createDiv("dashboard-popover-item").textContent = "无法获取文件列表";
      } else {
        for (const filePath of files) {
          const item = popover.createDiv("dashboard-popover-item");
          item.textContent = filePath;
          item.style.cursor = "pointer";
          item.addEventListener("mousedown", async (e) => {
            e.preventDefault();
            const f = this.app.vault.getAbstractFileByPath(filePath);
            if (f instanceof TFile) await this.app.workspace.getLeaf(false).openFile(f);
            remove();
          });
        }
      }
    };

    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", () => { hideTimer = setTimeout(remove, 200); });
  }

  // ── Push confirm modal ──

  private showPushConfirmModal(files: GitFileStatus[]) {
    const gitService = this.gitService;
    const settings = this.settings;
    const view = this;

    const STATUS_LABELS: Record<string, string> = {
      " M": "已修改", "??": "新增", " A": "新增(已暂存)", "AM": "新增(有冲突)",
      " D": "已删除", "M ": "已暂存", "A ": "已暂存", "D ": "已删除(已暂存)",
      "MM": "有冲突", "R ": "已重命名",
    };

    new (class extends Modal {
      private checkboxes: { file: GitFileStatus; cb: HTMLInputElement }[] = [];
      private allCb!: HTMLInputElement;

      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("dashboard-push-confirm-modal");
        contentEl.createEl("h3", { text: "确认推送" });
        contentEl.createEl("p", { text: `共 ${files.length} 个文件变更，勾选需要提交的文件：`, cls: "dashboard-push-confirm-hint" });

        const commitMsg = contentEl.createDiv("dashboard-push-commit-row");
        commitMsg.createEl("label", { text: "Commit 消息：" });
        const msgInput = commitMsg.createEl("input", { cls: "dashboard-push-commit-input" }) as HTMLInputElement;
        msgInput.value = view.buildCommitMessage();

        const list = contentEl.createDiv("dashboard-push-file-list");

        const selectAllRow = list.createDiv("dashboard-push-select-all");
        const selectAllLabel = selectAllRow.createEl("label", { cls: "dashboard-push-check-label" });
        this.allCb = selectAllLabel.createEl("input") as HTMLInputElement;
        this.allCb.type = "checkbox";
        this.allCb.checked = true;
        selectAllLabel.createEl("span", { text: "全选 / 取消全选" });
        this.allCb.addEventListener("change", () => {
          for (const { cb } of this.checkboxes) cb.checked = this.allCb.checked;
        });

        for (const f of files) {
          const row = list.createDiv("dashboard-push-file-row");
          const checkLabel = row.createEl("label", { cls: "dashboard-push-check-label" });
          const cb = checkLabel.createEl("input") as HTMLInputElement;
          cb.type = "checkbox";
          cb.checked = true;
          this.checkboxes.push({ file: f, cb });
          cb.addEventListener("change", () => {
            const allChecked = this.checkboxes.every((c) => c.cb.checked);
            this.allCb.checked = allChecked;
          });
          row.createEl("span", {
            text: STATUS_LABELS[f.status] ?? f.status,
            cls: `dashboard-push-status dashboard-push-status-${f.staged ? "staged" : "unstaged"}`,
          });
          row.createEl("span", { text: f.path, cls: "dashboard-push-file-path" });
        }

        const actions = contentEl.createDiv("dashboard-modal-actions");
        actions.style.cssText = "justify-content:flex-end;";
        actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());

        const confirmBtn = actions.createEl("button", { text: "确认推送", cls: "mod-cta" });
        confirmBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) { new Notice("请至少选择一个文件"); return; }
          confirmBtn.disabled = true;
          confirmBtn.textContent = "推送中...";
          try {
            await gitService.stageFiles(selected);
            await gitService.commit(msgInput.value.trim() || view.buildCommitMessage());
            await gitService.push(settings.gitRemoteName, settings.gitBranchName,
              settings.gitUsername || undefined, settings.gitPassword || undefined);
            new Notice(`已推送 ${selected.length} 个文件`);
            this.close();
            await view.update();
          } catch (e: any) {
            new Notice(`Push 失败: ${e.message}`);
            confirmBtn.disabled = false;
            confirmBtn.textContent = "确认推送";
          }
        });
      }

      onClose() { this.contentEl.empty(); }
    })(this.app).open();
  }

  // ── Rollback confirm modal ──

  private showRollbackConfirmModal(files: GitFileStatus[]) {
    const gitService = this.gitService;
    const view = this;

    const STATUS_LABELS: Record<string, string> = {
      " M": "已修改", "??": "新增", " D": "已删除",
    };

    new (class extends Modal {
      private checkboxes: { file: GitFileStatus; cb: HTMLInputElement }[] = [];
      private allCb!: HTMLInputElement;

      onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("dashboard-push-confirm-modal");
        contentEl.createEl("h3", { text: "确认回滚" });
        contentEl.createEl("p", { text: `共 ${files.length} 个文件有变更，勾选需要回滚的文件：`, cls: "dashboard-push-confirm-hint" });
        const warn = contentEl.createEl("p", { text: "⚠ 回滚将丢弃所有未提交的变更，此操作不可撤销！", cls: "dashboard-push-confirm-hint" });
        warn.style.cssText = "color:var(--text-error);font-weight:600;";

        const list = contentEl.createDiv("dashboard-push-file-list");

        const selectAllRow = list.createDiv("dashboard-push-select-all");
        const selectAllLabel = selectAllRow.createEl("label", { cls: "dashboard-push-check-label" });
        this.allCb = selectAllLabel.createEl("input") as HTMLInputElement;
        this.allCb.type = "checkbox";
        this.allCb.checked = true;
        selectAllLabel.createEl("span", { text: "全选 / 取消全选" });
        this.allCb.addEventListener("change", () => {
          for (const { cb } of this.checkboxes) cb.checked = this.allCb.checked;
        });

        for (const f of files) {
          const row = list.createDiv("dashboard-push-file-row");
          const checkLabel = row.createEl("label", { cls: "dashboard-push-check-label" });
          const cb = checkLabel.createEl("input") as HTMLInputElement;
          cb.type = "checkbox";
          cb.checked = true;
          this.checkboxes.push({ file: f, cb });
          cb.addEventListener("change", () => {
            const allChecked = this.checkboxes.every((c) => c.cb.checked);
            this.allCb.checked = allChecked;
          });
          row.createEl("span", { text: STATUS_LABELS[f.status] ?? f.status, cls: "dashboard-push-status dashboard-push-status-unstaged" });
          row.createEl("span", { text: f.path, cls: "dashboard-push-file-path" });
        }

        const actions = contentEl.createDiv("dashboard-modal-actions");
        actions.style.cssText = "justify-content:flex-end;";
        actions.createEl("button", { text: "取消" }).addEventListener("click", () => this.close());

        const confirmBtn = actions.createEl("button", { text: "确认回滚", cls: "mod-cta" });
        confirmBtn.style.cssText = "background-color:var(--text-error);";
        confirmBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) { new Notice("请至少选择一个文件"); return; }
          confirmBtn.disabled = true;
          confirmBtn.textContent = "回滚中...";
          try {
            const restored = await gitService.restoreFiles(selected);
            new Notice(`已回滚 ${restored.length} 个文件`);
            this.close();
            await view.update();
          } catch (e: any) {
            new Notice(`回滚失败: ${e.message}`);
            confirmBtn.disabled = false;
            confirmBtn.textContent = "确认回滚";
          }
        });
      }

      onClose() { this.contentEl.empty(); }
    })(this.app).open();
  }
}
