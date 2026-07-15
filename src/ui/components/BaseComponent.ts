import { App } from "obsidian";
import { DashboardSettings } from "../../types";

export abstract class BaseComponent {
  protected app: App;
  protected settings: DashboardSettings;
  protected containerEl: HTMLElement | null = null;
  protected lastHash = "";

  constructor(app: App, settings: DashboardSettings) {
    this.app = app;
    this.settings = settings;
  }

  /** Unique identifier for this component (used for module ordering) */
  abstract get id(): string;

  /** Full initial render into a container element */
  abstract render(container: HTMLElement): Promise<void>;

  /** Incremental update. Called when data may have changed.
   *  Default no-op — override in components that support incrementality. */
  async update(_data?: any): Promise<void> {
    // no-op
  }

  updateSettings(settings: DashboardSettings): void {
    this.settings = settings;
  }

  /** Clean up any timers, listeners, etc. */
  destroy(): void {
    this.containerEl = null;
  }

  /** Compute a stable hash of data to detect changes.
   *  Subclasses call this in update() to skip re-rendering when data is unchanged. */
  protected dataHash(data: any): string {
    try {
      return JSON.stringify(data).slice(0, 2000);
    } catch {
      return "";
    }
  }

  protected hasChanged(data: any): boolean {
    const hash = this.dataHash(data);
    if (hash === this.lastHash && this.lastHash !== "") return false;
    this.lastHash = hash;
    return true;
  }
}
