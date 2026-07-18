/**
 * Shared utility functions extracted from DashboardView.
 */

/** Format a relative time string like "刚刚", "3分钟前", etc. */
export function formatRelativeTime(mtime: number): string {
  const diff = Math.floor((Date.now() - mtime) / 60000);
  if (diff < 1) return "刚刚";
  if (diff < 60) return `${diff}分钟前`;
  if (diff < 1440) return `${Math.floor(diff / 60)}小时前`;
  return `${Math.floor(diff / 1440)}天前`;
}

/** Format a date to YYYY-MM-DD string */
export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Attach a hover popover to a trigger element showing a list of file paths.
 * Used by FileStatsComponent (anomaly badges) and GitSyncComponent (file lists).
 */
export function attachFileListPopover(
  trigger: HTMLElement,
  files: string[],
  title: string,
  onFileClick?: (filePath: string) => void
): void {
  let popover: HTMLElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  };

  const remove = () => {
    clearTimer();
    if (popover) { popover.remove(); popover = null; }
  };

  const show = () => {
    clearTimer();
    remove();
    popover = document.body.createDiv("dashboard-popover");
    popover.createDiv("dashboard-popover-title").textContent = `${title} (${files.length})`;
    for (const filePath of files) {
      const item = popover.createDiv("dashboard-popover-item");
      item.textContent = `• ${filePath}`;
      if (onFileClick) {
        item.addEventListener("mousedown", async (e) => {
          e.preventDefault();
          onFileClick(filePath);
          remove();
        });
      }
    }
    const rect = trigger.getBoundingClientRect();
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
    popover.addEventListener("mouseenter", clearTimer);
    popover.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(remove, 200);
    });
  };

  trigger.addEventListener("mouseenter", show);
  trigger.addEventListener("mouseleave", () => {
    hideTimer = setTimeout(remove, 200);
  });
}

/** localStorage key for module collapsed state */
const MODULE_COLLAPSE_KEY = "llm-wiki-dashboard-module-collapsed";

export function loadModuleCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MODULE_COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function isModuleCollapsed(moduleId: string): boolean {
  return !!loadModuleCollapsed()[moduleId];
}

export function setModuleCollapsed(moduleId: string, collapsed: boolean): void {
  const state = loadModuleCollapsed();
  if (collapsed) state[moduleId] = true;
  else delete state[moduleId];
  localStorage.setItem(MODULE_COLLAPSE_KEY, JSON.stringify(state));
}

export const LAST_LLM_OUTPUT_KEY = "llm-wiki-dashboard-last-output";

export function saveLastLlmOutput(path: string): void {
  localStorage.setItem(LAST_LLM_OUTPUT_KEY, JSON.stringify({ path, time: Date.now() }));
}

export function loadLastLlmOutput(): { path: string; time: number } | null {
  try {
    const raw = localStorage.getItem(LAST_LLM_OUTPUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Human-readable remote type label for Remotely Save sessions */
export function formatRemoteType(remoteType: string): string {
  if (!remoteType) return "未知";
  const map: Record<string, string> = {
    onedrive: "OneDrive",
    dropbox: "Dropbox",
    webdav: "WebDAV",
    s3: "S3",
    googledrive: "Google Drive",
    box: "Box",
    pcloud: "pCloud",
    yandexdisk: "Yandex Disk",
    koofr: "Koofr",
    azureblobstorage: "Azure Blob",
  };
  const key = remoteType.toLowerCase().replace(/[^a-z0-9]/g, "");
  return map[key] ?? remoteType;
}
