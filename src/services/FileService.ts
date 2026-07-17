import { App, TFile, TFolder } from "obsidian";
import { FileStats, FolderStat } from "../types";

export interface RecentFile {
  path: string;
  mtime: number;
}

export class FileService {
  constructor(private app: App) {}

  async getStats(trackedFolders: string[]): Promise<FileStats> {
    const allFiles = this.app.vault.getFiles();
    const total = allFiles.length;

    const folderStats: FolderStat[] = trackedFolders.map((folderPath) => {
      const count = this.countFilesInFolder(folderPath, allFiles);
      return { name: folderPath, count };
    });

    const mdFiles = allFiles.filter((f) => f.extension === "md");
    const linkedFiles = new Set<string>();
    const filesWithSource = new Set<string>();

    for (const file of mdFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const links = cache?.links ?? [];
      const embeds = cache?.embeds ?? [];

      for (const link of [...links, ...embeds]) {
        const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (resolved) linkedFiles.add(resolved.path);
      }

      const fm = cache?.frontmatter;
      if (fm && (fm["source"] || fm["sources"] || fm["origin"])) {
        filesWithSource.add(file.path);
      }
    }

    const orphanFilesArr = mdFiles.filter((f) => !linkedFiles.has(f.path));
    const nosourceFilesArr = mdFiles.filter((f) => !filesWithSource.has(f.path));
    const orphanCount = orphanFilesArr.length;
    const nosourceCount = nosourceFilesArr.length;

    const emptyFilesArr: string[] = [];
    const maybeEmpty = mdFiles.filter((f) => f.stat.size === 0);
    for (const f of maybeEmpty) emptyFilesArr.push(f.path);

    const smallFiles = mdFiles.filter(
      (f) => f.stat.size > 0 && f.stat.size <= 256 && !emptyFilesArr.includes(f.path)
    );
    if (smallFiles.length > 0) {
      const checks = await Promise.all(
        smallFiles.map(async (f) => {
          const content = await this.app.vault.cachedRead(f);
          return content.trim().length === 0 ? f.path : null;
        })
      );
      for (const p of checks) {
        if (p) emptyFilesArr.push(p);
      }
    }
    const emptyCount = emptyFilesArr.length;

    const healthScore = this.calcHealthScore(mdFiles.length, orphanCount, nosourceCount, emptyCount);

    return {
      total,
      folderStats,
      orphanCount,
      nosourceCount,
      emptyCount,
      healthScore,
      orphanFiles: orphanFilesArr.map((f) => f.path),
      nosourceFiles: nosourceFilesArr.map((f) => f.path),
      emptyFilesList: emptyFilesArr,
    };
  }

  private countFilesInFolder(folderPath: string, allFiles: TFile[]): number {
    const folder = this.findFolder(folderPath);
    if (folder) {
      const prefix = folder.path + "/";
      return allFiles.filter((f) => f.path.startsWith(prefix)).length;
    }
    // Fallback: direct prefix match (works even before folder is loaded)
    return allFiles.filter((f) => f.path.startsWith(folderPath + "/")).length;
  }

  private findFolder(path: string): TFolder | null {
    // getAbstractFileByPath doesn't work for folders, so iterate
    const pathLower = path.toLowerCase();
    let found: TFolder | null = null;
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof TFolder && f.path.toLowerCase() === pathLower) {
        found = f;
      }
    });
    return found;
  }

  private calcHealthScore(total: number, orphan: number, nosource: number, empty: number): number {
    if (total === 0) return 100;
    const score =
      100 -
      (orphan / total) * 40 -
      (nosource / total) * 30 -
      (empty / total) * 30;
    return Math.max(0, Math.round(score));
  }

  getFolderPaths(): string[] {
    const paths: string[] = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof TFolder && f.path !== "/") {
        paths.push(f.path);
      }
    });
    return [...new Set(paths)].sort();
  }

  async openFile(path: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }

  // ─── Recently modified files ──────────────────────────────────────────

  getRecentlyModified(limit: number = 5): RecentFile[] {
    const mdFiles = this.app.vault.getFiles().filter(f => f.extension === "md");
    return mdFiles
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, limit)
      .map(f => ({ path: f.path, mtime: f.stat.mtime }));
  }

  getLatestInFolder(folderPrefix: string): RecentFile | null {
    const prefix = folderPrefix.replace(/^\/+|\/+$/g, "") + "/";
    const files = this.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith(prefix))
      .sort((a, b) => b.stat.mtime - a.stat.mtime);
    if (files.length === 0) return null;
    const f = files[0];
    return { path: f.path, mtime: f.stat.mtime };
  }

  async toggleFolderInExplorer(name: string): Promise<void> {
    let leaves = this.app.workspace.getLeavesOfType("file-explorer");
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getLeftLeaf(false);
      if (leaf) await leaf.setViewState({ type: "file-explorer" });
      leaves = this.app.workspace.getLeavesOfType("file-explorer");
    }
    if (leaves.length === 0) return;

    const view = leaves[0].view as any;
    const fileItems = view.fileItems;
    if (!fileItems) return;

    const isMap = fileItems instanceof Map;

    // Case-insensitive key lookup
    const findKey = (target: string): string | null => {
      if (isMap ? fileItems.has(target) : target in fileItems) return target;
      const lower = target.toLowerCase();
      const keys = isMap ? [...fileItems.keys()] : Object.keys(fileItems);
      for (const key of keys) {
        if (key.toLowerCase() === lower) return key;
      }
      return null;
    };

    const matchKey = findKey(name);
    if (!matchKey) return;

    const item = isMap ? fileItems.get(matchKey) : fileItems[matchKey];
    if (!item) return;

    const findTreeComponent = (it: any): any => {
      if (!it) return null;
      if (typeof it.setCollapsed === "function") return it;
      const vc = it.vChildren;
      if (!vc) return null;
      if (typeof vc.setCollapsed === "function") return vc;
      for (const kid of vc._children ?? []) {
        if (typeof kid.setCollapsed === "function") return kid;
      }
      return null;
    };

    // Expand ancestors
    const parts = matchKey.split("/");
    let ancPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      ancPath += (ancPath ? "/" : "") + parts[i];
      const ancItem = isMap ? fileItems.get(ancPath) : fileItems[ancPath];
      const anc = findTreeComponent(ancItem);
      if (ancItem?.collapsed && typeof anc?.setCollapsed === "function") {
        anc.setCollapsed(false);
        await new Promise((r) => setTimeout(r, 50));
        // Collapse auto-expanded siblings (except the one on our target path)
        const nextPart = parts[i + 1].toLowerCase();
        const siblings = anc.vChildren?._children ?? [];
        for (const sib of siblings) {
          const sibName = sib?.file?.name?.toLowerCase() ?? "";
          if (sibName && sibName !== nextPart && typeof sib.setCollapsed === "function") {
            sib.setCollapsed(true);
          }
        }
      }
    }

    const comp = findTreeComponent(item);
    if (comp && typeof comp.setCollapsed === "function") {
      comp.setCollapsed(!(item.collapsed ?? true));
    }
  }
}
