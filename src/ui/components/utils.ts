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

/**
 * Creates a gear icon SVG button element.
 */
export function createGearIcon(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
}
