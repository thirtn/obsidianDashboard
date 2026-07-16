import { ItemView, WorkspaceLeaf } from "obsidian";
import { DashboardSettings } from "../types";
import { FileService } from "../services/FileService";
import { LogService } from "../services/LogService";
import { LLMService } from "../services/LLMService";
import { PluginManageService } from "../services/PluginManageService";
import { HeatmapService } from "../services/HeatmapService";
import { GitService } from "../services/GitService";
import { RemotelySaveService } from "../services/RemotelySaveService";
import { BaseComponent } from "./components/BaseComponent";
import { HeaderComponent } from "./components/HeaderComponent";
import { SearchComponent } from "./components/SearchComponent";
import { FileStatsComponent } from "./components/FileStatsComponent";
import { HeatmapComponent } from "./components/HeatmapComponent";
import { LLMCommandComponent } from "./components/LLMCommandComponent";
import { GitSyncComponent } from "./components/GitSyncComponent";
import { RemotelySaveComponent } from "./components/RemotelySaveComponent";
import { TaskQuickAddComponent } from "./components/TaskQuickAddComponent";
import { PluginManageComponent } from "./components/PluginManageComponent";

export const DASHBOARD_VIEW_TYPE = "yy-obsidian-dashboard";

export class DashboardView extends ItemView {
  private settings: DashboardSettings;
  private onSettingsChange: (s: DashboardSettings) => Promise<void>;

  // Services
  private fileService: FileService;
  private logService: LogService;
  private llmService: LLMService;
  private pluginService: PluginManageService;
  private heatmapService: HeatmapService;
  private gitService: GitService;
  private remotelySaveService: RemotelySaveService;

  // Components
  private headerComponent!: HeaderComponent;
  private searchComponent!: SearchComponent;
  private fileStatsComponent!: FileStatsComponent;
  private heatmapComponent!: HeatmapComponent;
  private llmCommandComponent!: LLMCommandComponent;
  private gitSyncComponent!: GitSyncComponent;
  private remotelySaveComponent!: RemotelySaveComponent;
  private taskQuickAddComponent!: TaskQuickAddComponent;
  private pluginManageComponent!: PluginManageComponent;

  // Component map by ID (for moduleOrder lookup)
  private components: Record<string, BaseComponent> = {};

  // State
  private rendering = false;
  private needsRerender = false;
  private lastRenderTime = 0;
  private autoRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityTimer: ReturnType<typeof setInterval> | null = null;
  private onVaultChange?: (file: any) => void;
  private onActiveLeafChange?: (leaf: WorkspaceLeaf) => void;
  private gitRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly AUTO_REFRESH_COOLDOWN = 5 * 60 * 1000;
  private readonly VISIBILITY_CHECK_INTERVAL = 30 * 60 * 1000;

  constructor(
    leaf: WorkspaceLeaf,
    settings: DashboardSettings,
    onSettingsChange: (s: DashboardSettings) => Promise<void>
  ) {
    super(leaf);
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;

    // Initialize services
    this.fileService = new FileService(this.app);
    this.logService = new LogService(this.app);
    this.llmService = new LLMService(settings, settings.tokenUsageDataPath);
    this.pluginService = new PluginManageService(this.app);
    this.heatmapService = new HeatmapService(this.app, settings.heatmapDataPath);
    this.gitService = new GitService(this.app);
    this.remotelySaveService = new RemotelySaveService();

    // Wire up vault persistence on LLMService
    this.llmService.setApp(this.app);

    // Initialize components
    this.headerComponent = new HeaderComponent(
      this.app, settings, this.llmService,
      async (s) => { await this.onSettingsChange(s); this.updateSettings(s); },
      () => this.render()
    );
    this.searchComponent = new SearchComponent(this.app, settings);
    this.fileStatsComponent = new FileStatsComponent(
      this.app, settings,
      async (s) => { await this.onSettingsChange(s); this.updateSettings(s); }
    );
    this.heatmapComponent = new HeatmapComponent(
      this.app, settings, this.heatmapService,
      async (s) => { await this.onSettingsChange(s); this.updateSettings(s); }
    );
    this.llmCommandComponent = new LLMCommandComponent(
      this.app, settings, this.llmService,
      () => this.headerComponent.refreshTokenBar()
    );
    this.gitSyncComponent = new GitSyncComponent(
      this.app, settings, this.gitService,
      async (s) => { await this.onSettingsChange(s); this.updateSettings(s); },
      () => this.gitSyncComponent.setupAutoPush()
    );
    this.remotelySaveComponent = new RemotelySaveComponent(this.app, settings);
    this.taskQuickAddComponent = new TaskQuickAddComponent(
      this.app, settings,
      async (s) => { await this.onSettingsChange(s); this.updateSettings(s); }
    );
    this.pluginManageComponent = new PluginManageComponent(this.app, settings);

    // Build component map
    this.components = {
      "header": this.headerComponent,
      "search": this.searchComponent,
      "file-stats": this.fileStatsComponent,
      "heatmap": this.heatmapComponent,
      "llm-command": this.llmCommandComponent,
      "git-sync": this.gitSyncComponent,
      "remotely-save": this.remotelySaveComponent,
      "task-quickadd": this.taskQuickAddComponent,
      "plugin-manage": this.pluginManageComponent,
    };
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return this.settings.dashboardTitle || "Dashboard"; }
  getIcon() { return "layout-dashboard"; }

  updateSettings(settings: DashboardSettings) {
    this.settings = settings;
    this.llmService.updateSettings(settings);
    // Propagate settings to all components
    for (const comp of Object.values(this.components)) {
      comp.updateSettings(settings);
    }
    this.updateTabTitle();
    this.render();
  }

  private updateTabTitle() {
    const title = this.settings.dashboardTitle || "Dashboard";

    const viewHeaderTitle = this.containerEl.querySelector(".view-header-title");
    if (viewHeaderTitle) viewHeaderTitle.textContent = title;

    const leafAny = this.leaf as any;
    const tabTitleEl = leafAny.tabHeaderEl?.querySelector(".workspace-tab-header-inner-title");
    if (tabTitleEl) {
      tabTitleEl.textContent = title;
      return;
    }

    const leafContent = this.containerEl.closest(".workspace-leaf");
    if (!leafContent) return;

    const workspaceTabs = leafContent.closest(".workspace-tabs");
    if (!workspaceTabs) return;

    const tabContainer = workspaceTabs.querySelector(":scope > .workspace-tab-container");
    const leaves = tabContainer
      ? Array.from(tabContainer.querySelectorAll(":scope > .workspace-leaf"))
      : [];
    const leafIndex = leaves.indexOf(leafContent);
    if (leafIndex < 0) return;

    const headerInner = workspaceTabs.querySelector(
      ":scope > .workspace-tab-header-container > .workspace-tab-header-container-inner"
    );
    const tabHeaders = headerInner
      ? Array.from(headerInner.querySelectorAll(":scope > .workspace-tab-header"))
      : [];
    const targetHeader = tabHeaders[leafIndex];
    if (targetHeader) {
      const innerTitle = targetHeader.querySelector(".workspace-tab-header-inner-title");
      if (innerTitle) innerTitle.textContent = title;
    }
  }

  async onOpen() {
    this.heatmapService.startTracking();

    // Vault change handler — debounced targeted updates
    this.onVaultChange = () => {
      if (this.autoRefreshTimer) clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = setTimeout(async () => {
        const statsContainer = document.getElementById("dashboard-file-stats-container");
        if (statsContainer) await this.fileStatsComponent.renderFileStats(statsContainer);
        const recentContainer = document.getElementById("dashboard-recent-container");
        if (recentContainer) this.fileStatsComponent.renderRecentFiles(recentContainer);
      }, 800);

      // Refresh git on vault change (debounced to avoid excessive calls)
      if (this.settings.gitEnabled) {
        if (this.gitRefreshTimer) clearTimeout(this.gitRefreshTimer);
        this.gitRefreshTimer = setTimeout(() => {
          this.gitSyncComponent.update();
        }, 3000);
      }

      // Auto-push on vault change (when interval === 0)
      this.gitSyncComponent.triggerAutoPushDebounce();
    };
    this.app.vault.on("modify", this.onVaultChange);
    this.app.vault.on("create", this.onVaultChange);
    this.app.vault.on("delete", this.onVaultChange);
    this.app.vault.on("rename", this.onVaultChange);

    // Git polling
    this.gitSyncComponent.setupAutoPush();
    this.gitSyncComponent.startPolling();

    // Auto-refresh when switching back to this tab; pause git polling when away
    this.onActiveLeafChange = (leaf: WorkspaceLeaf) => {
      if (leaf.view === this) {
        this.gitSyncComponent.startPolling();
        const elapsed = Date.now() - this.lastRenderTime;
        if (elapsed > this.AUTO_REFRESH_COOLDOWN) {
          this.render();
        }
      } else {
        this.gitSyncComponent.stopPolling();
      }
    };
    this.app.workspace.on("active-leaf-change", this.onActiveLeafChange);

    // Periodic visibility check
    this.visibilityTimer = setInterval(() => {
      if (this.app.workspace.activeLeaf?.view === this) {
        const elapsed = Date.now() - this.lastRenderTime;
        if (elapsed > this.VISIBILITY_CHECK_INTERVAL) {
          this.render();
        }
      }
    }, this.VISIBILITY_CHECK_INTERVAL);

    await this.render();
  }

  async onClose() {
    this.heatmapService.stopTracking();
    if (this.onVaultChange) {
      this.app.vault.off("modify", this.onVaultChange);
      this.app.vault.off("create", this.onVaultChange);
      this.app.vault.off("delete", this.onVaultChange);
      this.app.vault.off("rename", this.onVaultChange);
    }
    if (this.onActiveLeafChange) {
      this.app.workspace.off("active-leaf-change", this.onActiveLeafChange);
    }
    if (this.autoRefreshTimer) clearTimeout(this.autoRefreshTimer);
    if (this.gitRefreshTimer) clearTimeout(this.gitRefreshTimer);
    if (this.visibilityTimer) clearInterval(this.visibilityTimer);

    // Destroy components that hold timers
    this.gitSyncComponent.destroy();
  }

  async render() {
    if (this.rendering) {
      this.needsRerender = true;
      return;
    }
    this.rendering = true;
    this.needsRerender = false;
    try {
      // Clean up orphaned floating elements
      document.body.querySelectorAll(".dashboard-heatmap-tip, .dashboard-popover").forEach((el) => el.remove());
      this.lastRenderTime = Date.now();
      const container = this.containerEl.children[1] as HTMLElement;

      // Save scroll positions
      const oldScroll = container.querySelector(".dashboard-scroll") as HTMLElement | null;
      const scrollTop = oldScroll?.scrollTop ?? 0;
      const containerScrollTop = container.scrollTop;

      // Build offscreen
      const offscreen = document.createElement("div");
      offscreen.addClass("dashboard-root");

      // Header + Search (always first, outside scroll)
      await this.headerComponent.render(offscreen);
      await this.searchComponent.render(offscreen);

      const scroll = offscreen.createDiv("dashboard-scroll");

      // Render modules in configured order
      const order = this.settings.moduleOrder || [];
      for (const moduleId of order) {
        const comp = this.components[moduleId];
        if (comp) {
          await comp.render(scroll);
        }
      }

      // Drag-and-drop module reordering
      const moduleEls = scroll.querySelectorAll<HTMLElement>(".dashboard-module");
      moduleEls.forEach((modEl, index) => {
        const moduleId = order[index];
        if (!moduleId) return;

        modEl.setAttribute("data-module-id", moduleId);

        const header = modEl.querySelector<HTMLElement>(".dashboard-module-header");
        if (!header) return;

        const handle = document.createElement("span");
        handle.className = "dashboard-module-drag-handle";
        handle.innerHTML = "⋮⋮";
        handle.setAttribute("draggable", "true");
        handle.setAttribute("title", "拖拽排序");

        handle.addEventListener("dragstart", (e) => {
          e.dataTransfer!.effectAllowed = "move";
          e.dataTransfer!.setData("text/plain", moduleId);
          modEl.classList.add("dragging");
        });

        handle.addEventListener("dragend", () => {
          modEl.classList.remove("dragging");
          scroll.querySelectorAll(".dashboard-module").forEach(el => el.classList.remove("drag-over"));
        });

        header.prepend(handle);

        modEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer!.dropEffect = "move";
          const dragging = scroll.querySelector(".dashboard-module.dragging");
          if (!dragging || dragging === modEl) return;
          modEl.classList.add("drag-over");
        });

        modEl.addEventListener("dragleave", (e) => {
          if (!modEl.contains(e.relatedTarget as Node)) {
            modEl.classList.remove("drag-over");
          }
        });

        modEl.addEventListener("drop", async (e) => {
          e.preventDefault();
          modEl.classList.remove("drag-over");
          const fromId = e.dataTransfer!.getData("text/plain");
          if (!fromId || fromId === moduleId) return;

          const newOrder = [...this.settings.moduleOrder];
          const fromIdx = newOrder.indexOf(fromId);
          const toIdx = newOrder.indexOf(moduleId);
          if (fromIdx === -1 || toIdx === -1) return;

          newOrder.splice(fromIdx, 1);
          newOrder.splice(toIdx, 0, fromId);
          this.settings.moduleOrder = newOrder;
          await this.onSettingsChange(this.settings);
        });
      });

      // Atomic swap + restore scroll
      container.replaceChildren(offscreen);
      container.scrollTop = containerScrollTop;
      scroll.scrollTop = scrollTop;
    } finally {
      this.rendering = false;
      if (this.needsRerender) {
        this.needsRerender = false;
        await this.render();
      }
    }
  }
}
