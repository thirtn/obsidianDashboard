import { App, Notice, Platform } from "obsidian";
import { BaseComponent } from "../../shared/BaseComponent";
import { DashboardSettings } from "../../types";
import { VoiceTranscriptionService } from "./VoiceTranscriptionService";
import { VoiceConfigModal } from "./VoiceConfigModal";
import type { RecorderState } from "./types";

export class VoiceTranscriptionComponent extends BaseComponent {
  private service: VoiceTranscriptionService;
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;
  private modEl: HTMLElement | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  private state: RecorderState = "idle";
  private recordingSeconds = 0;
  private errorText = "";
  private resultText = "";

  constructor(
    app: App,
    settings: DashboardSettings,
    onSettingsChange: (s: DashboardSettings) => Promise<void>
  ) {
    super(app, settings);
    this.service = new VoiceTranscriptionService();
    this.onSettingsChange = onSettingsChange;
  }

  get id(): string {
    return "voice-transcription";
  }

  async render(container: HTMLElement): Promise<void> {
    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-voice-module";
    this.modEl = mod;
    this.buildHeader(mod);
    const body = mod.createDiv("dashboard-module-body");
    body.addClass("dashboard-voice-body");
    await this.buildBodyContent(body);
  }

  async update(): Promise<void> {
    const mod = this.modEl;
    if (!mod || !mod.isConnected) return;
    const existingBody = mod.querySelector(".dashboard-module-body");
    if (existingBody) existingBody.remove();
    const body = mod.createDiv("dashboard-module-body");
    body.addClass("dashboard-voice-body");
    await this.buildBodyContent(body);
  }

  destroy(): void {
    this.stopTimer();
    this.service.cancelRecording();
    super.destroy();
  }

  // ── Internal ──

  private buildHeader(mod: HTMLElement) {
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "\uD83C\uDFA4", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "语音转文字", cls: "dashboard-module-title" });

    const gearBtn = header.createEl("button", {
      cls: "dashboard-heatmap-config-btn",
      title: "语音转文字配置",
    });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => {
      new VoiceConfigModal(
        this.app,
        this.settings,
        async (s) => {
          await this.onSettingsChange(s);
          this.settings = s;
        }
      ).open();
    });
  }

  private async buildBodyContent(body: HTMLElement) {
    if (Platform.isMobile) {
      body.createDiv({
        text: "语音转文字仅在桌面端可用，请使用桌面端 Obsidian。",
        cls: "dashboard-voice-hint",
      });
      return;
    }

    // Check browser support
    if (!navigator.mediaDevices?.getUserMedia) {
      body.createDiv({
        text: "当前环境不支持麦克风录音。请在桌面端 Obsidian 中使用此功能。",
        cls: "dashboard-voice-hint",
      });
      return;
    }

    // Main content area
    const content = body.createDiv("dashboard-voice-content");

    // Button wrapper — the button itself is recreated each state change
    const btnWrap = content.createDiv("dashboard-voice-btn-wrap");

    // Timer display
    const timerEl = content.createDiv("dashboard-voice-timer");

    // Error / status area
    const statusEl = content.createDiv("dashboard-voice-status");

    // Result area
    const resultWrap = content.createDiv("dashboard-voice-result-wrap");

    // Build UI based on current state
    this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
  }

  private buildStateUI(
    btnWrap: HTMLElement,
    timerEl: HTMLElement,
    statusEl: HTMLElement,
    resultWrap: HTMLElement
  ) {
    // Always create a fresh button to clear stale event listeners
    btnWrap.empty();
    const recordBtn = btnWrap.createEl("button", {
      cls: "dashboard-voice-record-btn",
    });

    timerEl.empty();
    statusEl.empty();
    resultWrap.empty();

    if (this.state === "idle") {
      recordBtn.textContent = "● 开始录音";
      recordBtn.addEventListener("click", () => this.handleStart(btnWrap, timerEl, statusEl, resultWrap));
    } else if (this.state === "recording") {
      recordBtn.textContent = "■ 停止录音";
      recordBtn.addClass("recording");
      recordBtn.addEventListener("click", () => this.handleStop(btnWrap, timerEl, statusEl, resultWrap));
      timerEl.textContent = this.formatSeconds(this.recordingSeconds);
      this.startTimer(timerEl);
    } else if (this.state === "transcribing") {
      recordBtn.textContent = "● 开始录音";
      recordBtn.disabled = true;
      statusEl.createDiv({ text: "转写中...", cls: "dashboard-voice-transcribing" });
      const spinner = statusEl.createDiv("dashboard-voice-spinner");
      spinner.style.cssText =
        "width:24px;height:24px;border:3px solid var(--background-modifier-border);border-top-color:var(--interactive-accent);border-radius:50%;margin-top:8px;animation:dashboard-voice-spin 0.8s linear infinite;";
    } else if (this.state === "done") {
      recordBtn.textContent = "● 开始录音";
      recordBtn.addEventListener("click", () => this.handleStart(btnWrap, timerEl, statusEl, resultWrap));

      if (this.resultText) {
        const textarea = resultWrap.createEl("textarea", {
          cls: "dashboard-voice-result",
          attr: { readonly: "true" },
        }) as HTMLTextAreaElement;
        textarea.value = this.resultText;

        const actions = resultWrap.createDiv("dashboard-voice-actions");
        const insertBtn = actions.createEl("button", {
          text: "插入到编辑器",
          cls: "mod-cta",
        });
        insertBtn.addEventListener("click", () => this.insertToEditor());

        const copyBtn = actions.createEl("button", {
          text: "复制",
        });
        copyBtn.addEventListener("click", () => this.copyToClipboard());
      }
    }

    if (this.errorText) {
      statusEl.createDiv({ text: this.errorText, cls: "dashboard-voice-error" });
    }
  }

  // ── Handlers ──

  private async handleStart(
    btnWrap: HTMLElement,
    timerEl: HTMLElement,
    statusEl: HTMLElement,
    resultWrap: HTMLElement
  ) {
    this.errorText = "";
    this.resultText = "";
    this.recordingSeconds = 0;

    try {
      await this.service.startRecording();
      this.state = "recording";
      this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
    } catch (e: any) {
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        this.errorText = "麦克风权限被拒绝，请在系统设置中允许 Obsidian 访问麦克风。";
      } else {
        this.errorText = `无法开始录音: ${e.message}`;
      }
      this.state = "idle";
      this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
    }
  }

  private async handleStop(
    btnWrap: HTMLElement,
    timerEl: HTMLElement,
    statusEl: HTMLElement,
    resultWrap: HTMLElement
  ) {
    this.stopTimer();
    this.state = "transcribing";
    this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);

    try {
      const blob = await this.service.stopRecording();
      const model = this.settings.whisperModelName || "whisper-1";
      const apiUrl = this.settings.whisperApiBaseUrl || this.settings.apiBaseUrl;
      const text = await this.service.transcribe(
        blob,
        apiUrl,
        this.settings.apiKey,
        model
      );
      this.resultText = text;
      this.state = "done";
    } catch (e: any) {
      this.errorText = `转写失败: ${e.message}`;
      this.state = "idle";
    }

    this.buildStateUI(btnWrap, timerEl, statusEl, resultWrap);
  }

  private insertToEditor() {
    const editor = this.app.workspace.activeEditor?.editor;
    if (editor) {
      editor.replaceSelection(this.resultText);
      new Notice("已插入到编辑器");
    } else {
      new Notice("没有打开的编辑器");
    }
  }

  private async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.resultText);
      new Notice("已复制到剪贴板");
    } catch {
      new Notice("复制失败");
    }
  }

  // ── Timer ──

  private startTimer(displayEl: HTMLElement) {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.recordingSeconds++;
      displayEl.textContent = this.formatSeconds(this.recordingSeconds);
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private formatSeconds(total: number): string {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
}
