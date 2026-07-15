import { App, TFile } from "obsidian";
import { BaseComponent } from "./BaseComponent";
import { DashboardSettings } from "../../types";

interface SearchIndexEntry {
  path: string;
  basename: string;
  title: string;
  aliases: string[];
  tags: string[];
  searchText: string;
}

type MatchType = "filename" | "title" | "alias" | "tag" | "fuzzy";

export class SearchComponent extends BaseComponent {
  private index: SearchIndexEntry[] = [];
  private searchInput: HTMLInputElement | null = null;
  private resultDropdown: HTMLElement | null = null;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

  get id(): string { return "search"; }

  async render(container: HTMLElement): Promise<void> {
    const searchWrap = container.createDiv("dashboard-search-wrap");
    this.searchInput = searchWrap.createEl("input", {
      cls: "dashboard-search-input",
      placeholder: "搜索笔记 (支持标签#、标题、别名)...",
    }) as HTMLInputElement;

    this.resultDropdown = searchWrap.createDiv("dashboard-search-dropdown");
    this.resultDropdown.style.display = "none";

    this.buildIndex();

    this.searchInput.addEventListener("input", () => this.doSearch());
    this.searchInput.addEventListener("focus", () => {
      this.buildIndex();
      this.doSearch();
    });
    this.searchInput.addEventListener("blur", () => {
      this.blurTimer = setTimeout(() => {
        if (this.resultDropdown) this.resultDropdown.style.display = "none";
      }, 200);
    });
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (this.resultDropdown) this.resultDropdown.style.display = "none";
        this.searchInput?.blur();
      } else if (e.key === "Enter") {
        const firstItem = this.resultDropdown?.querySelector(".dashboard-search-item") as HTMLElement;
        if (firstItem) firstItem.click();
      }
    });
  }

  async update(_data?: any): Promise<void> {
    this.buildIndex();
  }

  private buildIndex() {
    this.index = [];
    const files = this.app.vault.getFiles().filter(f => f.extension === "md");
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter;
      const title = (frontmatter?.title as string) ?? "";
      const aliases: string[] = [];
      if (frontmatter?.aliases) {
        if (Array.isArray(frontmatter.aliases)) aliases.push(...frontmatter.aliases.map(String));
        else aliases.push(String(frontmatter.aliases));
      }
      const tags: string[] = [];
      if (frontmatter?.tags) {
        const rawTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
        for (const t of rawTags) {
          const s = String(t).replace(/^#/, "");
          tags.push(s);
        }
      }
      if (cache?.tags) {
        for (const t of cache.tags) {
          const s = t.tag.replace(/^#/, "");
          if (!tags.includes(s)) tags.push(s);
        }
      }

      const searchText = [file.basename, title, ...aliases, ...tags].join(" ").toLowerCase();
      this.index.push({
        path: file.path,
        basename: file.basename,
        title,
        aliases,
        tags,
        searchText,
      });
    }
  }

  private fuzzyMatch(text: string, query: string): boolean {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    let qi = 0;
    for (let pi = 0; pi < t.length && qi < q.length; pi++) {
      if (t[pi] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  private doSearch() {
    const q = this.searchInput!.value.trim();
    if (this.blurTimer) { clearTimeout(this.blurTimer); this.blurTimer = null; }

    if (!this.resultDropdown) return;

    if (!q) {
      this.resultDropdown.empty();
      this.resultDropdown.style.display = "none";
      return;
    }

    const isTagSearch = q.startsWith("#");
    const query = isTagSearch ? q.slice(1) : q;
    const lowerQuery = query.toLowerCase();

    const scored: { entry: SearchIndexEntry; score: number; matchType: MatchType }[] = [];

    for (const entry of this.index) {
      let bestScore = 0;
      let matchType: MatchType = "fuzzy";

      if (isTagSearch) {
        const exactTag = entry.tags.some(t => t.toLowerCase() === lowerQuery);
        const partialTag = entry.tags.some(t => t.toLowerCase().includes(lowerQuery));
        if (exactTag) { bestScore = 50; matchType = "tag"; }
        else if (partialTag) { bestScore = 40; matchType = "tag"; }
      }

      if (entry.basename.toLowerCase() === lowerQuery) { bestScore = Math.max(bestScore, 60); matchType = "filename"; }
      else if (entry.basename.toLowerCase().startsWith(lowerQuery)) { bestScore = Math.max(bestScore, 55); matchType = "filename"; }
      else if (this.fuzzyMatch(entry.basename, query)) { bestScore = Math.max(bestScore, 35); matchType = "fuzzy"; }

      if (entry.title && entry.title.toLowerCase() === lowerQuery) { bestScore = Math.max(bestScore, 45); matchType = "title"; }
      else if (entry.title && entry.title.toLowerCase().includes(lowerQuery)) { bestScore = Math.max(bestScore, 30); matchType = "title"; }

      for (const alias of entry.aliases) {
        if (alias.toLowerCase() === lowerQuery) { bestScore = Math.max(bestScore, 42); matchType = "alias"; }
        else if (alias.toLowerCase().includes(lowerQuery)) { bestScore = Math.max(bestScore, 28); matchType = "alias"; }
      }

      if (!isTagSearch && this.fuzzyMatch(entry.searchText, query) && bestScore === 0) {
        bestScore = 10; matchType = "fuzzy";
      }

      if (bestScore > 0) scored.push({ entry, score: bestScore, matchType });
    }

    scored.sort((a, b) => b.score - a.score);
    const results = scored.slice(0, 10);

    this.resultDropdown.empty();

    if (results.length === 0) {
      this.resultDropdown.style.display = "none";
      return;
    }

    for (const { entry, matchType } of results) {
      const item = this.resultDropdown.createDiv("dashboard-search-item");
      const nameEl = item.createEl("span", { text: entry.basename, cls: "dashboard-search-item-name" });
      item.createEl("span", { text: entry.path, cls: "dashboard-search-item-path" });

      const typeLabels: Record<MatchType, string> = {
        filename: "文件", title: "标题", alias: "别名", tag: "标签", fuzzy: "匹配",
      };
      const typeBadge = item.createEl("span", {
        text: typeLabels[matchType],
        cls: `dashboard-search-result-type dashboard-search-type-${matchType}`,
      });

      item.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        if (this.resultDropdown) this.resultDropdown.style.display = "none";
        if (this.searchInput) this.searchInput.value = "";
        const f = this.app.vault.getAbstractFileByPath(entry.path);
        if (f instanceof TFile) await this.app.workspace.getLeaf(false).openFile(f);
      });
    }

    this.resultDropdown.style.display = "block";
  }
}
