import { App, Notice } from "obsidian";
import { BaseComponent } from "./BaseComponent";
import { DashboardSettings } from "../../types";
import { LLMService } from "../../services/LLMService";
import { LogService } from "../../services/LogService";

export class LLMCommandComponent extends BaseComponent {
  private llmService: LLMService;
  private logService: LogService;
  private onTokenRefresh: () => void;
  private executing = false;

  constructor(
    app: App,
    settings: DashboardSettings,
    llmService: LLMService,
    onTokenRefresh: () => void
  ) {
    super(app, settings);
    this.llmService = llmService;
    this.logService = new LogService(app);
    this.onTokenRefresh = onTokenRefresh;
  }

  get id(): string { return "llm-command"; }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    const llmHeader = mod.createDiv("dashboard-module-header");
    const llmTitleWrap = llmHeader.createDiv("dashboard-module-title-wrap");
    llmTitleWrap.createEl("span", { text: "⚡", cls: "dashboard-module-icon" });
    llmTitleWrap.createEl("span", { text: "LLM 指令执行", cls: "dashboard-module-title" });
    const body = mod.createDiv("dashboard-module-body");

    const commandSelect = body.createEl("select", { cls: "dashboard-select" }) as HTMLSelectElement;
    for (const cmd of ["query", "ingest", "lint-wiki"]) {
      commandSelect.createEl("option", { value: cmd, text: cmd });
    }

    const placeholders: Record<string, string> = {
      query: "请输入查询问题...",
      ingest: "请粘贴需要处理的原始内容...",
      "lint-wiki": "请粘贴需要检查的 wiki 内容...",
    };

    const inputArea = body.createEl("textarea", { cls: "dashboard-cmd-input" }) as HTMLTextAreaElement;
    inputArea.placeholder = placeholders["query"];

    commandSelect.addEventListener("change", () => {
      inputArea.placeholder = placeholders[commandSelect.value] ?? "请输入内容...";
    });

    const execBtn = body.createEl("button", { text: "▶ 执行", cls: "mod-cta dashboard-exec-btn" });
    const resultEl = body.createEl("pre", { cls: "dashboard-result-pre" });
    resultEl.textContent = "（执行结果将显示在此处）";

    const resultActions = body.createDiv("dashboard-result-actions");
    resultActions.style.display = "none";
    const exportBtn = resultActions.createEl("button", { text: "导出到 outputs", cls: "dashboard-link-btn" });

    const errorEl = body.createDiv("dashboard-exec-error");
    errorEl.style.display = "none";

    execBtn.addEventListener("click", async () => {
      if (this.executing) return;
      const input = inputArea.value.trim();
      if (!input) { new Notice("请输入内容"); return; }
      if (!this.settings.apiKey) { new Notice("请先配置 API Key"); return; }

      this.executing = true;
      execBtn.disabled = true;
      execBtn.textContent = "执行中...";
      errorEl.style.display = "none";
      resultEl.textContent = "";
      resultActions.style.display = "none";

      try {
        const result = await this.llmService.executeCommand(
          commandSelect.value as "ingest" | "query" | "lint-wiki",
          input
        );
        resultEl.textContent = result;
        resultActions.style.display = "";

        const logType = commandSelect.value === "lint-wiki" ? "lint"
          : commandSelect.value as "ingest" | "query";
        this.logService.writeLog(logType, input.slice(0, 80));

        exportBtn.onclick = async () => {
          const filename = `outputs/${commandSelect.value}-${Date.now()}.md`;
          try {
            await this.app.vault.create(filename, result);
          } catch {
            await this.app.vault.adapter.mkdir("outputs");
            await this.app.vault.create(filename, result);
          }
          new Notice(`已导出到 ${filename}`);
        };
      } catch (e: any) {
        errorEl.textContent = `⚠ ${e.message}`;
        errorEl.style.display = "";
      } finally {
        this.executing = false;
        execBtn.disabled = false;
        execBtn.textContent = "▶ 执行";
        this.onTokenRefresh();
      }
    });
  }
}
