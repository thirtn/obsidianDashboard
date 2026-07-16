var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => LLMWikiDashboardPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian20 = require("obsidian");

// src/types.ts
var defaultReportConfigs = {
  daily: { enabled: true, confirmBeforeCreate: true, directory: "raw/dayReport", filenameFormat: "YYYY/MM/YYYY-MM-DD", templatePath: "raw/dayReport/template" },
  weekly: { enabled: false, confirmBeforeCreate: true, directory: "raw/weekReport", filenameFormat: "YYYY/MM/YYYY-[W]ww", templatePath: "raw/weekReport/template" },
  monthly: { enabled: false, confirmBeforeCreate: true, directory: "raw/monthReport", filenameFormat: "YYYY/MM/YYYY-MM", templatePath: "raw/monthReport/template" },
  quarterly: { enabled: false, confirmBeforeCreate: true, directory: "raw/quarterReport", filenameFormat: "YYYY/MM/YYYY-[Q]Q", templatePath: "raw/quarterReport/template" },
  yearly: { enabled: false, confirmBeforeCreate: true, directory: "raw/yearReport", filenameFormat: "YYYY/YYYY", templatePath: "raw/yearReport/template" }
};
var DEFAULT_TASK_DEFAULTS = {
  urgent: "",
  normal: "",
  low: "",
  ongoing: "",
  ongoingPercent: "0"
};
var DEFAULT_SETTINGS = {
  apiBaseUrl: "https://api.openai.com/v1",
  apiKey: "",
  modelName: "gpt-4o",
  temperature: 0.7,
  maxTokens: 2048,
  tokenUsageApiUrl: "",
  tokenBalanceApiUrl: "",
  trackedFolders: ["raw", "wiki", "outputs", "concepts", "entities"],
  lastConnectionStatus: "untested",
  lastConnectionTime: "",
  reportConfigs: defaultReportConfigs,
  taskDefaults: DEFAULT_TASK_DEFAULTS,
  dashboardTitle: "Dashboard",
  dashboardDesc: "\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F\uFF1B\u7A37\u601D\u5929\u4E0B\u6709\u9965\u8005\uFF0C\u7531\u5DF1\u9965\u4E4B\u4E5F\u3002",
  gitEnabled: false,
  gitRemoteURL: "",
  gitRemoteName: "origin",
  gitBranchName: "main",
  gitUsername: "",
  gitPassword: "",
  gitAutoPushEnabled: false,
  gitAutoPushInterval: 30,
  gitCommitTemplate: "auto: {{date}} {{time}}",
  moduleOrder: ["file-stats", "heatmap", "llm-command", "git-sync", "remotely-save", "task-quickadd", "plugin-manage"],
  heatmapDataPath: ".dashboard/heatmap.json",
  tokenUsageDataPath: ".dashboard/token-usage.json"
};

// src/ui/DashboardView.ts
var import_obsidian19 = require("obsidian");

// src/services/FileService.ts
var import_obsidian = require("obsidian");
var FileService = class {
  constructor(app) {
    this.app = app;
  }
  async getStats(trackedFolders) {
    var _a, _b;
    const allFiles = this.app.vault.getFiles();
    const total = allFiles.length;
    const folderStats = trackedFolders.map((folderPath) => {
      const count = this.countFilesInFolder(folderPath, allFiles);
      return { name: folderPath, count };
    });
    const mdFiles = allFiles.filter((f) => f.extension === "md");
    const linkedFiles = /* @__PURE__ */ new Set();
    const filesWithSource = /* @__PURE__ */ new Set();
    for (const file of mdFiles) {
      const cache = this.app.metadataCache.getFileCache(file);
      const links = (_a = cache == null ? void 0 : cache.links) != null ? _a : [];
      const embeds = (_b = cache == null ? void 0 : cache.embeds) != null ? _b : [];
      for (const link of [...links, ...embeds]) {
        const resolved = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (resolved)
          linkedFiles.add(resolved.path);
      }
      const fm = cache == null ? void 0 : cache.frontmatter;
      if (fm && (fm["source"] || fm["sources"] || fm["origin"])) {
        filesWithSource.add(file.path);
      }
    }
    const orphanFilesArr = mdFiles.filter((f) => !linkedFiles.has(f.path));
    const nosourceFilesArr = mdFiles.filter((f) => !filesWithSource.has(f.path));
    const orphanCount = orphanFilesArr.length;
    const nosourceCount = nosourceFilesArr.length;
    const emptyChecks = await Promise.all(
      mdFiles.map(async (f) => {
        const content = await this.app.vault.cachedRead(f);
        return { path: f.path, empty: content.trim().length === 0 };
      })
    );
    const emptyFilesArr = emptyChecks.filter((c) => c.empty).map((c) => c.path);
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
      emptyFilesList: emptyFilesArr
    };
  }
  countFilesInFolder(folderPath, allFiles) {
    const folder = this.findFolder(folderPath);
    if (folder) {
      const prefix = folder.path + "/";
      return allFiles.filter((f) => f.path.startsWith(prefix)).length;
    }
    return allFiles.filter((f) => f.path.startsWith(folderPath + "/")).length;
  }
  findFolder(path) {
    const pathLower = path.toLowerCase();
    let found = null;
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof import_obsidian.TFolder && f.path.toLowerCase() === pathLower) {
        found = f;
      }
    });
    return found;
  }
  calcHealthScore(total, orphan, nosource, empty) {
    if (total === 0)
      return 100;
    const score = 100 - orphan / total * 40 - nosource / total * 30 - empty / total * 30;
    return Math.max(0, Math.round(score));
  }
  getFolderPaths() {
    const paths = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof import_obsidian.TFolder && f.path !== "/") {
        paths.push(f.path);
      }
    });
    return [...new Set(paths)].sort();
  }
  async openFile(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian.TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    }
  }
  // ─── Recently modified files ──────────────────────────────────────────
  getRecentlyModified(limit = 5) {
    const mdFiles = this.app.vault.getFiles().filter((f) => f.extension === "md");
    return mdFiles.sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, limit).map((f) => ({ path: f.path, mtime: f.stat.mtime }));
  }
  async toggleFolderInExplorer(name2) {
    var _a, _b, _c, _d, _e, _f;
    let leaves = this.app.workspace.getLeavesOfType("file-explorer");
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getLeftLeaf(false);
      if (leaf)
        await leaf.setViewState({ type: "file-explorer" });
      leaves = this.app.workspace.getLeavesOfType("file-explorer");
    }
    if (leaves.length === 0)
      return;
    const view = leaves[0].view;
    const fileItems = view.fileItems;
    if (!fileItems)
      return;
    const isMap = fileItems instanceof Map;
    const findKey = (target) => {
      if (isMap ? fileItems.has(target) : target in fileItems)
        return target;
      const lower = target.toLowerCase();
      const keys = isMap ? [...fileItems.keys()] : Object.keys(fileItems);
      for (const key of keys) {
        if (key.toLowerCase() === lower)
          return key;
      }
      return null;
    };
    const matchKey = findKey(name2);
    if (!matchKey)
      return;
    const item = isMap ? fileItems.get(matchKey) : fileItems[matchKey];
    if (!item)
      return;
    const findTreeComponent = (it) => {
      var _a2;
      if (!it)
        return null;
      if (typeof it.setCollapsed === "function")
        return it;
      const vc = it.vChildren;
      if (!vc)
        return null;
      if (typeof vc.setCollapsed === "function")
        return vc;
      for (const kid of (_a2 = vc._children) != null ? _a2 : []) {
        if (typeof kid.setCollapsed === "function")
          return kid;
      }
      return null;
    };
    const parts = matchKey.split("/");
    let ancPath = "";
    for (let i = 0; i < parts.length - 1; i++) {
      ancPath += (ancPath ? "/" : "") + parts[i];
      const ancItem = isMap ? fileItems.get(ancPath) : fileItems[ancPath];
      const anc = findTreeComponent(ancItem);
      if ((ancItem == null ? void 0 : ancItem.collapsed) && typeof (anc == null ? void 0 : anc.setCollapsed) === "function") {
        anc.setCollapsed(false);
        await new Promise((r) => setTimeout(r, 50));
        const nextPart = parts[i + 1].toLowerCase();
        const siblings = (_b = (_a = anc.vChildren) == null ? void 0 : _a._children) != null ? _b : [];
        for (const sib of siblings) {
          const sibName = (_e = (_d = (_c = sib == null ? void 0 : sib.file) == null ? void 0 : _c.name) == null ? void 0 : _d.toLowerCase()) != null ? _e : "";
          if (sibName && sibName !== nextPart && typeof sib.setCollapsed === "function") {
            sib.setCollapsed(true);
          }
        }
      }
    }
    const comp = findTreeComponent(item);
    if (comp && typeof comp.setCollapsed === "function") {
      comp.setCollapsed(!((_f = item.collapsed) != null ? _f : true));
    }
  }
};

// src/services/LogService.ts
var import_obsidian2 = require("obsidian");
var LogService = class {
  constructor(app) {
    this.app = app;
  }
  async getRecentLogs(count = 5) {
    const logFolder = this.app.vault.getAbstractFileByPath("wiki/log");
    if (!logFolder)
      return [];
    const logFiles = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof import_obsidian2.TFile && f.path.startsWith("wiki/log/") && f.extension === "md") {
        logFiles.push(f);
      }
    });
    if (logFiles.length === 0)
      return [];
    logFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
    const entries = [];
    for (const file of logFiles) {
      if (entries.length >= count)
        break;
      const content = await this.app.vault.cachedRead(file);
      const parsed = this.parseLogFile(content, file.basename);
      entries.push(...parsed);
    }
    return entries.slice(0, count);
  }
  parseLogFile(content, filename) {
    const entries = [];
    const lines = content.split("\n").filter((l) => l.trim().length > 0);
    for (const line of lines) {
      entries.push(this.parseLine(line, filename));
    }
    return entries.reverse();
  }
  parseLine(line, filename) {
    const lower = line.toLowerCase();
    let type = "unknown";
    if (lower.includes("ingest"))
      type = "ingest";
    else if (lower.includes("query"))
      type = "query";
    else if (lower.includes("lint"))
      type = "lint";
    const timeMatch = line.match(/\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)\]?/);
    const time = timeMatch ? timeMatch[1] : filename;
    const targetMatch = line.match(/(?:ingest|query|lint)[^\w]*([\w/\-. ]+)/i);
    const target = targetMatch ? targetMatch[1].trim() : line.slice(0, 40);
    return { type, target, time, raw: line };
  }
  async writeLog(type, target) {
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toISOString().slice(11, 19);
    const line = `[${dateStr} ${timeStr}] ${type} ${target}`;
    const dirPath = "wiki/log";
    const filePath = `${dirPath}/${dateStr}.md`;
    try {
      const dir = this.app.vault.getAbstractFileByPath(dirPath);
      if (!dir) {
        await this.app.vault.createFolder(dirPath);
      }
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (file) {
        await this.app.vault.append(file, `
${line}`);
      } else {
        await this.app.vault.create(filePath, line);
      }
    } catch (e) {
    }
  }
};

// src/services/LLMService.ts
var import_obsidian4 = require("obsidian");

// src/services/VaultPersistenceService.ts
var import_obsidian3 = require("obsidian");
var VaultPersistenceService = class {
  constructor(app) {
    this.app = app;
  }
  async readJSON(path) {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof import_obsidian3.TFile))
        return null;
      const raw = await this.app.vault.read(file);
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }
  async writeJSON(path, data) {
    try {
      const dir = path.split("/").slice(0, -1).join("/");
      if (dir && !this.app.vault.getAbstractFileByPath(dir)) {
        const segs = dir.split("/");
        let acc = "";
        for (const seg of segs) {
          acc += (acc ? "/" : "") + seg;
          if (!this.app.vault.getAbstractFileByPath(acc)) {
            try {
              await this.app.vault.createFolder(acc);
            } catch (e) {
            }
          }
        }
      }
      const file = this.app.vault.getAbstractFileByPath(path);
      const json = JSON.stringify(data, null, 2);
      if (file instanceof import_obsidian3.TFile) {
        await this.app.vault.modify(file, json);
      } else {
        await this.app.vault.create(path, json);
      }
    } catch (e) {
    }
  }
  getLocalStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  setLocalStore(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
    }
  }
};

// src/services/LLMService.ts
var LOCAL_STORAGE_KEY = "llm-wiki-dashboard-token-usage";
var LLMService = class {
  constructor(settings, vaultPath) {
    this.settings = settings;
    this.persistence = new VaultPersistenceService(null);
    this.vaultPath = vaultPath || ".dashboard/token-usage.json";
  }
  /** Must be called after construction to wire up the vault adapter */
  setApp(app) {
    this.persistence = new VaultPersistenceService(app);
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  async executeCommand(command, input, onChunk) {
    var _a, _b, _c, _d, _e, _f, _g;
    const systemPrompts = {
      ingest: "You are a knowledge ingestion assistant. Process the following content and extract key information for the wiki.",
      query: "You are a wiki assistant. Answer the following question based on the knowledge base.",
      "lint-wiki": "You are a wiki linter. Review the following content and suggest improvements for clarity, structure, and completeness."
    };
    const body = JSON.stringify({
      model: this.settings.modelName,
      temperature: this.settings.temperature,
      max_tokens: this.settings.maxTokens,
      messages: [
        { role: "system", content: (_a = systemPrompts[command]) != null ? _a : "You are a helpful assistant." },
        { role: "user", content: input }
      ]
    });
    const resp = await (0, import_obsidian4.requestUrl)({
      url: `${this.settings.apiBaseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.apiKey}`
      },
      body,
      throw: false
    });
    if (resp.status === 401)
      throw new Error("401: API Key \u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E");
    if (resp.status === 429)
      throw new Error("429: \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    if (resp.status === 408 || resp.status === 504)
      throw new Error("\u8D85\u65F6: \u8BF7\u6C42\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    if (resp.status >= 500)
      throw new Error(`\u670D\u52A1\u5668\u9519\u8BEF (${resp.status})\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5`);
    if (resp.status !== 200)
      throw new Error(`\u8BF7\u6C42\u5931\u8D25 (${resp.status}): ${resp.text}`);
    const data = resp.json;
    const content = (_e = (_d = (_c = (_b = data == null ? void 0 : data.choices) == null ? void 0 : _b[0]) == null ? void 0 : _c.message) == null ? void 0 : _d.content) != null ? _e : "";
    const totalTokens = (_g = (_f = data == null ? void 0 : data.usage) == null ? void 0 : _f.total_tokens) != null ? _g : 0;
    if (totalTokens > 0)
      this.recordLocalTokens(totalTokens);
    return content;
  }
  async testConnection() {
    const resp = await (0, import_obsidian4.requestUrl)({
      url: `${this.settings.apiBaseUrl}/models`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      throw: false
    });
    if (resp.status === 401)
      throw new Error("401: API Key \u65E0\u6548");
    if (resp.status === 404)
      throw new Error("404: Base URL \u4E0D\u6B63\u786E");
    if (resp.status >= 400)
      throw new Error(`\u8FDE\u63A5\u5931\u8D25 (${resp.status})`);
  }
  async getTokenUsage() {
    var _a, _b, _c, _d;
    const hasUsageApi = !!this.settings.tokenUsageApiUrl;
    const hasBalanceApi = !!this.settings.tokenBalanceApiUrl;
    const localUsage = await this.getLocalTokenUsage();
    const [apiUsage, balanceInfo] = await Promise.all([
      hasUsageApi ? this.fetchUsageApi() : null,
      hasBalanceApi ? this.fetchBalanceApi() : null
    ]);
    return {
      today: (_a = apiUsage == null ? void 0 : apiUsage.today) != null ? _a : localUsage.today,
      thisMonth: (_b = apiUsage == null ? void 0 : apiUsage.thisMonth) != null ? _b : localUsage.thisMonth,
      remaining: (_c = apiUsage == null ? void 0 : apiUsage.remaining) != null ? _c : null,
      dailyBreakdown: (_d = apiUsage == null ? void 0 : apiUsage.dailyBreakdown) != null ? _d : localUsage.dailyBreakdown,
      balanceInfo
    };
  }
  async getLocalTokenUsage() {
    var _a, _b;
    const vaultData = await this.persistence.readJSON(this.vaultPath);
    const localData = this.loadLocalStoreSync();
    let store = vaultData != null ? vaultData : localData;
    if (!vaultData && Object.keys(localData).length > 0) {
      this.persistence.writeJSON(this.vaultPath, localData).catch(() => {
      });
    } else if (vaultData) {
      let merged = false;
      for (const [date, tokens] of Object.entries(localData)) {
        if (!(date in vaultData) || localData[date] > ((_a = vaultData[date]) != null ? _a : 0)) {
          store[date] = tokens;
          merged = true;
        }
      }
      if (merged) {
        this.persistence.writeJSON(this.vaultPath, store).catch(() => {
        });
      }
    }
    const today = this.todayStr();
    const monthPrefix = today.slice(0, 7);
    const todayTokens = (_b = store[today]) != null ? _b : 0;
    let thisMonth = 0;
    const dailyBreakdown = [];
    for (const [date, tokens] of Object.entries(store)) {
      if (date.startsWith(monthPrefix)) {
        thisMonth += tokens;
        dailyBreakdown.push({ date, tokens });
      }
    }
    dailyBreakdown.sort((a, b) => b.date.localeCompare(a.date));
    return { today: todayTokens, thisMonth, remaining: null, dailyBreakdown: dailyBreakdown.slice(0, 30) };
  }
  async fetchUsageApi() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
      const resp = await (0, import_obsidian4.requestUrl)({
        url: this.settings.tokenUsageApiUrl,
        method: "GET",
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        throw: false
      });
      if (resp.status !== 200)
        return null;
      const data = resp.json;
      const today = (_c = (_b = (_a = data == null ? void 0 : data.daily) == null ? void 0 : _a.today) != null ? _b : data == null ? void 0 : data.today) != null ? _c : 0;
      const thisMonth = (_f = (_e = (_d = data == null ? void 0 : data.monthly) == null ? void 0 : _d.total) != null ? _e : data == null ? void 0 : data.this_month) != null ? _f : 0;
      const remaining = (_h = (_g = data == null ? void 0 : data.remaining) != null ? _g : data == null ? void 0 : data.quota_remaining) != null ? _h : null;
      return { today, thisMonth, remaining, dailyBreakdown: [] };
    } catch (e) {
      return null;
    }
  }
  async fetchBalanceApi() {
    try {
      const resp = await (0, import_obsidian4.requestUrl)({
        url: this.settings.tokenBalanceApiUrl,
        method: "GET",
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        throw: false
      });
      if (resp.status !== 200)
        return null;
      const data = resp.json;
      if (data == null ? void 0 : data.balance_infos)
        return data.balance_infos;
      if (data == null ? void 0 : data.currency)
        return [data];
      return null;
    } catch (e) {
      return null;
    }
  }
  recordLocalTokens(tokens) {
    var _a;
    const store = this.loadLocalStoreSync();
    const today = this.todayStr();
    store[today] = ((_a = store[today]) != null ? _a : 0) + tokens;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
    this.persistence.writeJSON(this.vaultPath, store).catch(() => {
    });
  }
  loadLocalStoreSync() {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  todayStr() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
};

// src/services/PluginManageService.ts
var ZH_DESCRIPTIONS = {
  "calendar": "\u5728\u4FA7\u8FB9\u680F\u663E\u793A\u65E5\u5386\u89C6\u56FE\uFF0C\u70B9\u51FB\u65E5\u671F\u5FEB\u901F\u8DF3\u8F6C\u5230\u5BF9\u5E94\u7684\u65E5\u8BB0\u6587\u4EF6",
  "editing-toolbar": "\u5728\u7F16\u8F91\u5668\u9876\u90E8\u6DFB\u52A0\u683C\u5F0F\u5316\u5DE5\u5177\u680F\uFF0C\u652F\u6301\u52A0\u7C97\u3001\u659C\u4F53\u3001\u6807\u9898\u7B49\u5E38\u7528\u6392\u7248\u64CD\u4F5C",
  "ishibashi-web-clipper": "\u4E00\u952E\u5C06\u7F51\u9875\u5185\u5BB9\u88C1\u526A\u4FDD\u5B58\u5230 Vault\uFF0C\u652F\u6301\u6B63\u6587\u63D0\u53D6\u548C Markdown \u8F6C\u6362",
  "karpathywiki": "\u57FA\u4E8E LLM \u7684\u77E5\u8BC6\u5E93\u7BA1\u7406\u5DE5\u5177\uFF0C\u652F\u6301 ingest / query / lint \u7B49 AI \u5DE5\u4F5C\u6D41",
  "notebook-navigator": "\u589E\u5F3A\u578B\u6587\u4EF6\u5939\u5BFC\u822A\u9762\u677F\uFF0C\u4EE5\u7B14\u8BB0\u672C\u5F62\u5F0F\u5C55\u793A Vault \u76EE\u5F55\u7ED3\u6784",
  "obsidian-excalidraw-plugin": "\u5728 Obsidian \u4E2D\u5D4C\u5165 Excalidraw \u767D\u677F\uFF0C\u652F\u6301\u624B\u7ED8\u56FE\u8868\u548C\u601D\u7EF4\u5BFC\u56FE",
  "periodic-notes": "\u7BA1\u7406\u65E5\u8BB0\u3001\u5468\u8BB0\u3001\u6708\u8BB0\u7B49\u5468\u671F\u6027\u7B14\u8BB0\uFF0C\u914D\u5408 Calendar \u63D2\u4EF6\u4F7F\u7528\u6548\u679C\u66F4\u4F73",
  "yy-obsidian-dashboard": "LLM Wiki \u5DE5\u4F5C\u6D41\u4EEA\u8868\u76D8\uFF0C\u96C6\u6210\u6587\u4EF6\u7EDF\u8BA1\u3001Token \u7528\u91CF\u3001\u6307\u4EE4\u6267\u884C\u7B49\u529F\u80FD"
};
var PluginManageService = class {
  constructor(app) {
    this.app = app;
  }
  getInstalledPlugins() {
    var _a, _b;
    const plugins = this.app.plugins;
    if (!plugins)
      return [];
    const manifests = (_a = plugins.manifests) != null ? _a : {};
    const enabledSet = (_b = plugins.enabledPlugins) != null ? _b : {};
    const isEnabled = (id) => {
      if (enabledSet instanceof Set)
        return enabledSet.has(id);
      return !!enabledSet[id];
    };
    return Object.entries(manifests).map(([id, manifest]) => {
      var _a2, _b2, _c, _d;
      return {
        id,
        name: (_a2 = manifest.name) != null ? _a2 : id,
        version: (_b2 = manifest.version) != null ? _b2 : "?",
        enabled: isEnabled(id),
        hasSettings: true,
        description: (_d = (_c = ZH_DESCRIPTIONS[id]) != null ? _c : manifest.description) != null ? _d : ""
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }
  async togglePlugin(pluginId, enable) {
    const plugins = this.app.plugins;
    if (!plugins)
      throw new Error("\u65E0\u6CD5\u8BBF\u95EE\u63D2\u4EF6\u7BA1\u7406\u5668");
    if (enable) {
      await plugins.enablePluginAndSave(pluginId);
    } else {
      await plugins.disablePluginAndSave(pluginId);
    }
  }
  openPluginSettings() {
    var _a, _b, _c, _d;
    (_b = (_a = this.app.setting) == null ? void 0 : _a.open) == null ? void 0 : _b.call(_a);
    (_d = (_c = this.app.setting) == null ? void 0 : _c.openTabById) == null ? void 0 : _d.call(_c, "community-plugins");
  }
  openSpecificPluginSettings(pluginId) {
    const setting = this.app.setting;
    if (!setting)
      return;
    setting.open();
    setTimeout(() => {
      var _a, _b;
      if (typeof setting.openTabById === "function") {
        setting.openTabById(pluginId);
      }
      const tab = (_a = setting.settingTabs) == null ? void 0 : _a.find(
        (t) => {
          var _a2, _b2;
          return t.id === pluginId || ((_b2 = (_a2 = t.plugin) == null ? void 0 : _a2.manifest) == null ? void 0 : _b2.id) === pluginId;
        }
      );
      (_b = tab == null ? void 0 : tab.navEl) == null ? void 0 : _b.click();
    }, 150);
  }
};

// src/services/HeatmapService.ts
var HEATMAP_KEY = "llm-wiki-dashboard-heatmap";
var HeatmapService = class {
  constructor(app, vaultPath) {
    this.app = app;
    this.unregister = null;
    this.cache = null;
    this.persistence = new VaultPersistenceService(app);
    this.vaultPath = vaultPath || ".dashboard/heatmap.json";
  }
  startTracking() {
    const handler = () => this.recordActivity();
    this.app.vault.on("modify", handler);
    this.unregister = () => this.app.vault.off("modify", handler);
  }
  stopTracking() {
    var _a;
    (_a = this.unregister) == null ? void 0 : _a.call(this);
    this.unregister = null;
  }
  recordActivity(count = 1) {
    var _a;
    const data = this.loadSync();
    const today = this.todayStr();
    data[today] = ((_a = data[today]) != null ? _a : 0) + count;
    localStorage.setItem(HEATMAP_KEY, JSON.stringify(data));
    this.cache = data;
    this.persistence.writeJSON(this.vaultPath, data).catch(() => {
    });
  }
  async getData() {
    var _a;
    if (this.cache)
      return this.cache;
    const vaultData = await this.persistence.readJSON(this.vaultPath);
    const localData = this.loadSync();
    if (vaultData) {
      this.cache = vaultData;
      let merged = false;
      for (const [date, count] of Object.entries(localData)) {
        if (!(date in vaultData) || localData[date] > ((_a = vaultData[date]) != null ? _a : 0)) {
          vaultData[date] = count;
          merged = true;
        }
      }
      if (merged) {
        this.cache = vaultData;
        localStorage.setItem(HEATMAP_KEY, JSON.stringify(vaultData));
        this.persistence.writeJSON(this.vaultPath, vaultData).catch(() => {
        });
      }
    } else {
      this.cache = localData;
      this.persistence.writeJSON(this.vaultPath, localData).catch(() => {
      });
    }
    return this.cache;
  }
  getDataSync() {
    return this.loadSync();
  }
  getMonthData(year, month) {
    const all = this.loadSync();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const result = {};
    for (const [date, count] of Object.entries(all)) {
      if (date.startsWith(prefix))
        result[date] = count;
    }
    return result;
  }
  loadSync() {
    try {
      const raw = localStorage.getItem(HEATMAP_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  todayStr() {
    const d = /* @__PURE__ */ new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
};

// src/services/GitService.ts
var import_obsidian5 = require("obsidian");
var GitService = class {
  constructor(app) {
    this.app = app;
    this.vaultPath = this.getVaultPath();
  }
  getVaultPath() {
    var _a, _b, _c;
    try {
      return (_c = (_b = (_a = this.app.vault.adapter).getBasePath) == null ? void 0 : _b.call(_a)) != null ? _c : "";
    } catch (e) {
      return "";
    }
  }
  get isMobile() {
    return import_obsidian5.Platform.isMobile;
  }
  exec(cmd) {
    if (this.isMobile) {
      throw new Error("Git \u64CD\u4F5C\u4EC5\u652F\u6301\u684C\u9762\u7AEF");
    }
    const { execSync } = require("child_process");
    try {
      const result = execSync(cmd, {
        cwd: this.vaultPath,
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 3e4
      }).toString();
      return result;
    } catch (e) {
      console.log(`[yyDashboard] exec failed (expected for --quiet checks): ${cmd}`);
      throw new Error(e.stderr || e.message || "Git \u547D\u4EE4\u6267\u884C\u5931\u8D25");
    }
  }
  async isGitRepo() {
    if (this.isMobile)
      return false;
    try {
      this.exec("git rev-parse --is-inside-work-tree");
      return true;
    } catch (e) {
      return false;
    }
  }
  async initRepo() {
    this.exec("git init");
  }
  async ensureRemote(url, name2) {
    let isNew = false;
    try {
      const existing = this.exec(`git remote get-url ${name2}`).trim();
      if (existing !== url) {
        this.exec(`git remote set-url ${name2} ${url}`);
      }
    } catch (e) {
      this.exec(`git remote add ${name2} ${url}`);
      isNew = true;
    }
    if (isNew) {
      try {
        this.exec(`git fetch ${name2}`);
      } catch (e) {
      }
    }
  }
  async hasCommits() {
    try {
      this.exec("git rev-parse HEAD");
      return true;
    } catch (e) {
      return false;
    }
  }
  parsePorcelainPath(line) {
    const clean = line.replace(/^\ufeff/, "");
    const pathPart = clean.slice(2).replace(/^ +/, "");
    const arrow = pathPart.indexOf(" -> ");
    return arrow > -1 ? pathPart.slice(arrow + 4) : pathPart;
  }
  async getStatus(remoteName, branchName) {
    if (this.isMobile)
      return { clean: true, files: [], ahead: 0, behind: 0 };
    let clean = true;
    let files = [];
    try {
      const output = this.exec("git -c core.quotePath=false status --porcelain");
      if (output.trim()) {
        clean = false;
        files = output.trim().split(/\r?\n/).map((line) => this.parsePorcelainPath(line));
      }
    } catch (e) {
    }
    let ahead = 0;
    let behind = 0;
    try {
      if (remoteName && branchName) {
        try {
          const counts = this.exec(
            `git rev-list --left-right --count ${remoteName}/${branchName}...${branchName}`
          );
          const parts = counts.trim().split("	");
          behind = parseInt(parts[0]) || 0;
          ahead = parseInt(parts[1]) || 0;
        } catch (e) {
        }
      } else {
        const branch = this.exec("git rev-parse --abbrev-ref HEAD").trim();
        const counts = this.exec(
          `git rev-list --left-right --count ${branch}@{upstream}...${branch}`
        );
        const parts = counts.trim().split("	");
        behind = parseInt(parts[0]) || 0;
        ahead = parseInt(parts[1]) || 0;
      }
    } catch (e) {
    }
    return { clean, files, ahead, behind };
  }
  async getStatusFiles() {
    if (this.isMobile)
      return [];
    try {
      const output = this.exec("git -c core.quotePath=false status --porcelain");
      if (!output.trim())
        return [];
      console.log("[yyDashboard] git status --porcelain raw output:", JSON.stringify(output));
      const lines = output.trim().split(/\r?\n/);
      if (lines.length > 0) {
        console.log("[yyDashboard] first line charCodes:", JSON.stringify([...lines[0]].map((c) => c.charCodeAt(0))));
      }
      const files = lines.map((line) => {
        const cleanLine = line.replace(/^\ufeff/, "");
        return {
          status: cleanLine.slice(0, 2),
          path: this.parsePorcelainPath(line),
          staged: cleanLine[0] !== " " && cleanLine[0] !== "?"
        };
      });
      console.log("[yyDashboard] getStatusFiles parsed:", JSON.stringify(files));
      return files;
    } catch (e) {
      console.error("[yyDashboard] getStatusFiles failed:", e.message);
      return [];
    }
  }
  async stageFiles(files) {
    console.log(`[yyDashboard] stageFiles called with ${files.length} files:`, JSON.stringify(files));
    const staged = [];
    const skipped = [];
    for (const f of files) {
      if (!f || !f.trim()) {
        console.log("[yyDashboard] Skipping empty/whitespace path");
        continue;
      }
      try {
        this.exec(`git add -- "${f.replace(/"/g, '\\"')}"`);
        staged.push(f);
        continue;
      } catch (e1) {
        try {
          this.exec(`git rm --cached -- "${f.replace(/"/g, '\\"')}"`);
          staged.push(f);
          continue;
        } catch (e) {
        }
        try {
          this.exec(`git add -A -- "${f.replace(/"/g, '\\"')}"`);
          staged.push(f);
          continue;
        } catch (e) {
        }
        try {
          this.exec(`git add -f -- "${f.replace(/"/g, '\\"')}"`);
          staged.push(f);
          continue;
        } catch (e3) {
          console.log(`[yyDashboard] Skipping file: "${f}", add error: ${e1.message}, rm error: ${e3.message}`);
          skipped.push(f);
        }
      }
    }
    console.log(`[yyDashboard] stageFiles result: staged=${staged.length}, skipped=${skipped.length}, skipped=`, JSON.stringify(skipped));
    if (staged.length === 0 && files.length > 0) {
      throw new Error("\u6CA1\u6709\u6587\u4EF6\u53EF\u4EE5\u6682\u5B58\uFF08\u6240\u6709\u6587\u4EF6\u5747\u5DF2\u4E0D\u5B58\u5728\uFF09");
    }
    return staged;
  }
  async restoreFiles(files) {
    console.log("[yyDashboard] restoreFiles called with:", JSON.stringify(files));
    const restored = [];
    for (const f of files) {
      let ok = false;
      try {
        this.exec(`git restore --staged -- "${f.replace(/"/g, '\\"')}"`);
      } catch (e) {
      }
      try {
        this.exec(`git restore -- "${f.replace(/"/g, '\\"')}"`);
        ok = true;
      } catch (e) {
      }
      if (!ok) {
        try {
          this.exec(`git checkout HEAD -- "${f.replace(/"/g, '\\"')}"`);
          ok = true;
        } catch (e) {
        }
      }
      if (!ok) {
        try {
          this.exec(`git checkout -- "${f.replace(/"/g, '\\"')}"`);
          ok = true;
        } catch (e) {
        }
      }
      if (ok) {
        restored.push(f);
      } else {
        console.log(`[yyDashboard] Failed to restore: ${f}`);
      }
    }
    if (restored.length === 0 && files.length > 0) {
      throw new Error("\u65E0\u6CD5\u56DE\u6EDA\u4EFB\u4F55\u6587\u4EF6");
    }
    return restored;
  }
  async commit(message) {
    try {
      this.exec("git diff --cached --quiet");
      return false;
    } catch (e) {
    }
    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    return true;
  }
  async stageAndCommit(message) {
    this.exec("git add -A");
    try {
      this.exec("git diff --cached --quiet");
      return false;
    } catch (e) {
    }
    this.exec(`git commit -m "${message.replace(/"/g, '\\"')}"`);
    return true;
  }
  async push(remote, branch, username, password) {
    if (username && password) {
      const remoteUrl = this.exec(`git remote get-url ${remote}`).trim();
      const authUrl = this.buildAuthUrl(remoteUrl, username, password);
      this.exec(`git push ${authUrl} ${branch}`);
    } else {
      this.exec(`git push ${remote} ${branch}`);
    }
    return "\u63A8\u9001\u6210\u529F";
  }
  async pull(remote, branch, username, password) {
    if (username && password) {
      const remoteUrl = this.exec(`git remote get-url ${remote}`).trim();
      const authUrl = this.buildAuthUrl(remoteUrl, username, password);
      const output2 = this.exec(`git pull ${authUrl} ${branch} --no-edit`);
      return output2.trim() || "\u62C9\u53D6\u5B8C\u6210";
    }
    const output = this.exec(`git pull ${remote} ${branch} --no-edit`);
    return output.trim() || "\u62C9\u53D6\u5B8C\u6210";
  }
  async pushAll(remote, branch, message, username, password) {
    const committed = await this.stageAndCommit(message);
    if (!committed) {
    }
    return this.push(remote, branch, username, password);
  }
  async getRecentCommits(n) {
    if (this.isMobile)
      return [];
    try {
      const output = this.exec(
        `git log --format="%H%x00%an%x00%s%x00%ai" -n ${n}`
      );
      return output.trim().split("\n").filter(Boolean).map((line) => {
        const parts = line.split("\0");
        return { hash: parts[0].slice(0, 7), message: parts[2], date: parts[3], author: parts[1] };
      });
    } catch (e) {
      return [];
    }
  }
  async getCommitFiles(hash) {
    if (this.isMobile)
      return [];
    try {
      const output = this.exec(
        `git diff-tree --no-commit-id --name-only -r ${hash}`
      );
      return output.trim().split("\n").filter(Boolean);
    } catch (e) {
      return [];
    }
  }
  buildAuthUrl(remoteUrl, username, password) {
    if (remoteUrl.startsWith("https://")) {
      const withoutProtocol = remoteUrl.slice(8);
      return `https://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${withoutProtocol}`;
    }
    return remoteUrl;
  }
};

// src/services/RemotelySaveService.ts
var RemotelySaveService = class {
  constructor() {
    this.dbName = "remotelysavedb";
    this.storeName = "syncplanshistory";
  }
  async openDB() {
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(this.dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(new Error("\u65E0\u6CD5\u6253\u5F00 Remotely Save \u6570\u636E\u5E93"));
        req.onblocked = () => {
          console.log("[yyDashboard] RS DB blocked \u2014 closing and retrying");
          if (req.result)
            req.result.close();
          reject(new Error("\u6570\u636E\u5E93\u88AB\u963B\u585E\uFF0C\u8BF7\u91CD\u8BD5"));
        };
      } catch (e) {
        reject(new Error("indexedDB not available: " + e.message));
      }
    });
  }
  async getTotalSyncCount() {
    let db = null;
    try {
      db = await this.openDB();
    } catch (e) {
      return 0;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const countReq = store.count();
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(0);
        tx.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }
  async getSyncHistory(limit = 10) {
    let db = null;
    try {
      db = await this.openDB();
    } catch (e) {
      console.log("[yyDashboard] Remotely Save DB not available:", e.message);
      return [];
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const sessions = [];
        store.openCursor(null, "prev").onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const record = cursor.value;
            try {
              const plan = typeof record.syncPlan === "string" ? JSON.parse(record.syncPlan) : record.syncPlan;
              const session = this.parseSyncPlan(record, plan);
              if (session && session.totalCount > 0) {
                sessions.push(session);
              }
            } catch (e) {
            }
            if (sessions.length >= limit) {
              resolve(sessions);
              return;
            }
            cursor.continue();
          } else {
            resolve(sessions);
          }
        };
        tx.onerror = () => resolve(sessions);
      } catch (e) {
        console.log("[yyDashboard] Error reading sync history:", e.message);
        resolve([]);
      }
    });
  }
  parseSyncPlan(record, plan) {
    if (!plan || typeof plan !== "object")
      return null;
    const uploads = [];
    const downloads = [];
    const deletions = [];
    for (const [key, info] of Object.entries(plan)) {
      if (!info || typeof info !== "object")
        continue;
      const decision = info.decision || "";
      const changed = info.change === true;
      if (!changed)
        continue;
      if (decision.startsWith("upload")) {
        uploads.push(key);
      } else if (decision.startsWith("download")) {
        downloads.push(key);
      } else if (decision.startsWith("delete") || decision.startsWith("remove")) {
        deletions.push(key);
      } else if (decision === "keepRemote" || decision === "overwrite") {
        downloads.push(key);
      } else if (decision === "keepLocal" || decision === "overwriteRemote") {
        uploads.push(key);
      } else if (changed && key) {
        uploads.push(key);
      }
    }
    return {
      ts: record.ts || 0,
      tsFmt: record.tsFmt || "",
      remoteType: record.remoteType || "",
      uploads,
      downloads,
      deletions,
      totalCount: uploads.length + downloads.length + deletions.length
    };
  }
};

// src/ui/components/HeaderComponent.ts
var import_obsidian7 = require("obsidian");

// src/ui/components/BaseComponent.ts
var BaseComponent = class {
  constructor(app, settings) {
    this.containerEl = null;
    this.lastHash = "";
    this.app = app;
    this.settings = settings;
  }
  /** Incremental update. Called when data may have changed.
   *  Default no-op — override in components that support incrementality. */
  async update(_data) {
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  /** Clean up any timers, listeners, etc. */
  destroy() {
    this.containerEl = null;
  }
  /** Compute a stable hash of data to detect changes.
   *  Subclasses call this in update() to skip re-rendering when data is unchanged. */
  dataHash(data) {
    try {
      return JSON.stringify(data).slice(0, 2e3);
    } catch (e) {
      return "";
    }
  }
  hasChanged(data) {
    const hash = this.dataHash(data);
    if (hash === this.lastHash && this.lastHash !== "")
      return false;
    this.lastHash = hash;
    return true;
  }
};

// src/modals/ModelConfigModal.ts
var import_obsidian6 = require("obsidian");
var ModelConfigModal = class extends import_obsidian6.Modal {
  constructor(app, settings, onSave) {
    super(app);
    this.statusEl = null;
    this.modelSelect = null;
    this.settings = { ...settings };
    this.onSave = onSave;
    this.llmService = new LLMService(this.settings);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u8BBE\u7F6E" });
    contentEl.createEl("h3", { text: "\u6807\u7B7E\u8BBE\u7F6E" });
    this.createTextField(contentEl, "\u6807\u7B7E\u9875\u6807\u9898", "dashboardTitle", "text", "Dashboard");
    this.createTextField(contentEl, "\u6807\u7B7E\u9875\u63CF\u8FF0", "dashboardDesc", "text", "\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F");
    contentEl.createEl("h3", { text: "\u6A21\u578B\u914D\u7F6E" });
    this.createTextField(contentEl, "API Base URL", "apiBaseUrl", "text", "https://api.openai.com/v1");
    this.createTextField(contentEl, "API Key", "apiKey", "password", "sk-...");
    this.createModelField(contentEl);
    this.createNumberField(contentEl, "Temperature", "temperature", 0, 2, 0.1);
    this.createNumberField(contentEl, "Max Tokens", "maxTokens", 256, 32768, 1);
    this.createTextField(contentEl, "\u7528\u91CF\u63A5\u53E3\u5730\u5740\uFF08\u9009\u586B\uFF0C\u672A\u586B\u5219\u7528\u672C\u5730\u7EDF\u8BA1\uFF09", "tokenUsageApiUrl", "text", "https://...");
    this.createTextField(contentEl, "\u4F59\u989D\u63A5\u53E3\u5730\u5740\uFF08\u9009\u586B\uFF0C\u5982 DeepSeek: https://api.deepseek.com/user/balance\uFF09", "tokenBalanceApiUrl", "text", "https://...", "https://api.deepseek.com/user/balance");
    const actionsRow = contentEl.createDiv("dashboard-modal-actions");
    const testBtn = actionsRow.createEl("button", { text: "\u6D4B\u8BD5\u8FDE\u63A5", cls: "mod-cta" });
    this.statusEl = actionsRow.createDiv("dashboard-connection-status");
    testBtn.addEventListener("click", async () => {
      testBtn.disabled = true;
      testBtn.textContent = "\u8FDE\u63A5\u4E2D...";
      if (this.statusEl)
        this.statusEl.textContent = "";
      try {
        this.llmService.updateSettings(this.settings);
        const models = await this.fetchModels();
        if (models.length > 0) {
          this.populateModelSelect(models);
          this.statusEl.textContent = `\u2705 \u8FDE\u63A5\u6B63\u5E38\uFF0C\u83B7\u53D6\u5230 ${models.length} \u4E2A\u6A21\u578B`;
          this.statusEl.className = "dashboard-connection-status ok";
        } else {
          this.statusEl.textContent = "\u2705 \u8FDE\u63A5\u6B63\u5E38";
          this.statusEl.className = "dashboard-connection-status ok";
        }
        this.settings.lastConnectionStatus = "ok";
        this.settings.lastConnectionTime = (/* @__PURE__ */ new Date()).toLocaleTimeString();
      } catch (e) {
        this.statusEl.textContent = `\u274C ${e.message}`;
        this.statusEl.className = "dashboard-connection-status error";
        this.settings.lastConnectionStatus = "error";
      } finally {
        testBtn.disabled = false;
        testBtn.textContent = "\u6D4B\u8BD5\u8FDE\u63A5";
      }
    });
    const saveBtn = contentEl.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.settings);
      this.close();
      new import_obsidian6.Notice("\u6A21\u578B\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
    const btnRow = contentEl.createDiv("dashboard-modal-actions");
    btnRow.style.cssText = "justify-content:flex-end;";
    btnRow.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    btnRow.appendChild(saveBtn);
  }
  createModelField(parent) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u6A21\u578B\u540D\u79F0" });
    const wrap = row.createDiv("dashboard-model-select-wrap");
    this.modelSelect = wrap.createEl("select", { cls: "dashboard-model-select" });
    const defaultOpt = this.modelSelect.createEl("option", {
      value: this.settings.modelName,
      text: this.settings.modelName
    });
    defaultOpt.selected = true;
    this.modelSelect.addEventListener("change", () => {
      this.settings.modelName = this.modelSelect.value;
    });
    const hint = wrap.createDiv({ text: "\u70B9\u51FB\u300C\u6D4B\u8BD5\u8FDE\u63A5\u300D\u81EA\u52A8\u83B7\u53D6\u53EF\u7528\u6A21\u578B\u5217\u8868", cls: "dashboard-field-hint" });
  }
  populateModelSelect(models) {
    var _a;
    if (!this.modelSelect)
      return;
    const current = this.settings.modelName;
    this.modelSelect.empty();
    for (const m of models) {
      const opt = this.modelSelect.createEl("option", { value: m, text: m });
      if (m === current)
        opt.selected = true;
    }
    if (!models.includes(current) && models.length > 0) {
      this.modelSelect.options[0].selected = true;
      this.settings.modelName = models[0];
    } else {
      this.settings.modelName = this.modelSelect.value;
    }
    const hint = (_a = this.modelSelect.parentElement) == null ? void 0 : _a.querySelector(".dashboard-field-hint");
    if (hint)
      hint.textContent = `\u5171 ${models.length} \u4E2A\u53EF\u7528\u6A21\u578B`;
  }
  async fetchModels() {
    var _a;
    const resp = await (0, import_obsidian6.requestUrl)({
      url: `${this.settings.apiBaseUrl}/models`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      throw: false
    });
    if (resp.status === 401)
      throw new Error("401: API Key \u65E0\u6548");
    if (resp.status === 404)
      throw new Error("404: Base URL \u4E0D\u6B63\u786E\uFF0CDeepSeek \u8BF7\u586B https://api.deepseek.com/v1\uFF0COpenAI \u8BF7\u586B https://api.openai.com/v1");
    if (resp.status >= 400)
      throw new Error(`\u8FDE\u63A5\u5931\u8D25 (${resp.status})`);
    const data = resp.json;
    const items = (_a = data == null ? void 0 : data.data) != null ? _a : [];
    return items.map((m) => m.id).filter(Boolean).sort();
  }
  createTextField(parent, label, key, type, placeholder, example) {
    var _a;
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const inputWrap = row.createDiv("dashboard-input-wrap");
    const input = inputWrap.createEl("input");
    input.type = type;
    input.placeholder = placeholder;
    input.value = String((_a = this.settings[key]) != null ? _a : "");
    input.addEventListener("input", () => {
      this.settings[key] = input.value;
    });
    const exampleVal = example || (placeholder && placeholder !== "https://..." && placeholder !== "sk-..." ? placeholder : "");
    if (exampleVal) {
      const hint = inputWrap.createEl("span", { cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": exampleVal } });
      hint.addEventListener("click", () => {
        input.value = exampleVal;
        input.dispatchEvent(new Event("input"));
      });
    }
    return row;
  }
  createNumberField(parent, label, key, min, max, step, example) {
    var _a;
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const inputWrap = row.createDiv("dashboard-input-wrap");
    const input = inputWrap.createEl("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String((_a = this.settings[key]) != null ? _a : "");
    input.addEventListener("input", () => {
      this.settings[key] = parseFloat(input.value);
    });
    if (example !== void 0) {
      const hint = inputWrap.createEl("span", { cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": String(example) } });
      hint.addEventListener("click", () => {
        input.value = String(example);
        input.dispatchEvent(new Event("input"));
      });
    }
    return row;
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/ui/components/HeaderComponent.ts
var HeaderComponent = class _HeaderComponent extends BaseComponent {
  constructor(app, settings, llmService, onSettingsChange, onRefresh) {
    super(app, settings);
    this.llmService = llmService;
    this.onSettingsChange = onSettingsChange;
    this.onRefresh = onRefresh;
  }
  get id() {
    return "header";
  }
  async render(container) {
    const header = container.createDiv("dashboard-header");
    const titleRow = header.createDiv("dashboard-header-title-row");
    titleRow.createEl("h2", { text: this.settings.dashboardTitle || "Dashboard", cls: "dashboard-title" });
    const actions = titleRow.createDiv("dashboard-header-actions");
    if (this.settings.dashboardDesc) {
      header.createDiv({ text: this.settings.dashboardDesc, cls: "dashboard-desc" });
    }
    const refreshBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "\u5237\u65B0" });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.onRefresh());
    const cfgBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "\u6A21\u578B\u914D\u7F6E" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ModelConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
      }).open();
    });
    const metaRow = header.createDiv("dashboard-header-meta");
    metaRow.createEl("span", { text: `\u6700\u540E\u5237\u65B0: ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`, cls: "dashboard-refresh-time" });
    const obsVersion = _HeaderComponent.getObsidianVersion(this.app);
    if (obsVersion) {
      metaRow.createEl("span", { text: `Obsidian v${obsVersion}`, cls: "dashboard-version-label" });
    }
    this.renderTokenBar(header);
  }
  renderTokenBar(header) {
    var _a;
    const bar = header.createDiv("dashboard-header-token");
    bar.setAttribute("id", "dashboard-token-bar");
    let today = 0, thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = _HeaderComponent.fmtDate(/* @__PURE__ */ new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = (_a = store[todayStr]) != null ? _a : 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix))
          thisMonth += tokens;
      }
    } catch (e) {
    }
    const makeChip = (label, value) => {
      const chip = bar.createDiv("dashboard-token-chip");
      chip.createEl("span", { text: label, cls: "dashboard-token-chip-label" });
      chip.createEl("span", { text: value, cls: "dashboard-token-chip-value" });
    };
    makeChip("\u4ECA\u65E5", `${today.toLocaleString()} tokens`);
    makeChip("\u672C\u6708", `${thisMonth.toLocaleString()} tokens`);
    if (this.settings.tokenBalanceApiUrl && this.settings.apiKey) {
      (async () => {
        var _a2;
        try {
          const resp = await (0, import_obsidian7.requestUrl)({
            url: this.settings.tokenBalanceApiUrl,
            method: "GET",
            headers: { Authorization: `Bearer ${this.settings.apiKey}` },
            throw: false
          });
          console.log("[Dashboard] \u4F59\u989DAPI status:", resp.status);
          if (resp.status === 200) {
            console.log("[Dashboard] \u4F59\u989DAPI body:", JSON.stringify(resp.json));
            if ((_a2 = resp.json) == null ? void 0 : _a2.balance_infos) {
              for (const item of resp.json.balance_infos) {
                makeChip(`\u4F59\u989D(${item.currency})`, item.total_balance);
              }
            } else {
              console.log("[Dashboard] \u4F59\u989DAPI \u7F3A\u5C11 balance_infos \u5B57\u6BB5");
            }
          } else {
            console.log("[Dashboard] \u4F59\u989DAPI \u8BF7\u6C42\u5931\u8D25, status:", resp.status);
          }
        } catch (e) {
          console.log("[Dashboard] \u4F59\u989DAPI \u5F02\u5E38:", e);
        }
      })();
    }
  }
  async refreshTokenBar() {
    var _a;
    const bar = document.getElementById("dashboard-token-bar");
    if (!bar)
      return;
    let today = 0, thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = _HeaderComponent.fmtDate(/* @__PURE__ */ new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = (_a = store[todayStr]) != null ? _a : 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix))
          thisMonth += tokens;
      }
    } catch (e) {
    }
    const chips = bar.querySelectorAll(".dashboard-token-chip-value");
    if (chips.length >= 2) {
      chips[0].textContent = `${today.toLocaleString()} tokens`;
      chips[1].textContent = `${thisMonth.toLocaleString()} tokens`;
    }
  }
  loadLocalTokenStore() {
    try {
      const raw = localStorage.getItem("llm-wiki-dashboard-token-usage");
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  static fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  static getObsidianVersion(app) {
    var _a, _b;
    try {
      const a = app;
      if (typeof a.version === "string")
        return a.version;
      if (typeof a.appVersion === "string")
        return a.appVersion;
      const ua = navigator.userAgent;
      const m = ua.match(/[Oo]bsidian\/([\d.]+)/);
      if (m)
        return m[1];
      const w = window;
      if ((_b = (_a = w.electronRemote) == null ? void 0 : _a.app) == null ? void 0 : _b.getVersion)
        return w.electronRemote.app.getVersion();
      return "";
    } catch (e) {
      return "";
    }
  }
};

// src/ui/components/SearchComponent.ts
var import_obsidian8 = require("obsidian");
var SearchComponent = class extends BaseComponent {
  constructor() {
    super(...arguments);
    this.index = [];
    this.searchInput = null;
    this.resultDropdown = null;
    this.blurTimer = null;
  }
  get id() {
    return "search";
  }
  async render(container) {
    const searchWrap = container.createDiv("dashboard-search-wrap");
    this.searchInput = searchWrap.createEl("input", {
      cls: "dashboard-search-input",
      placeholder: "\u641C\u7D22\u7B14\u8BB0 (\u652F\u6301\u6807\u7B7E#\u3001\u6807\u9898\u3001\u522B\u540D)..."
    });
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
        if (this.resultDropdown)
          this.resultDropdown.style.display = "none";
      }, 200);
    });
    this.searchInput.addEventListener("keydown", (e) => {
      var _a, _b;
      if (e.key === "Escape") {
        if (this.resultDropdown)
          this.resultDropdown.style.display = "none";
        (_a = this.searchInput) == null ? void 0 : _a.blur();
      } else if (e.key === "Enter") {
        const firstItem = (_b = this.resultDropdown) == null ? void 0 : _b.querySelector(".dashboard-search-item");
        if (firstItem)
          firstItem.click();
      }
    });
  }
  async update(_data) {
    this.buildIndex();
  }
  buildIndex() {
    var _a;
    this.index = [];
    const files = this.app.vault.getFiles().filter((f) => f.extension === "md");
    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache == null ? void 0 : cache.frontmatter;
      const title = (_a = frontmatter == null ? void 0 : frontmatter.title) != null ? _a : "";
      const aliases = [];
      if (frontmatter == null ? void 0 : frontmatter.aliases) {
        if (Array.isArray(frontmatter.aliases))
          aliases.push(...frontmatter.aliases.map(String));
        else
          aliases.push(String(frontmatter.aliases));
      }
      const tags = [];
      if (frontmatter == null ? void 0 : frontmatter.tags) {
        const rawTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
        for (const t of rawTags) {
          const s = String(t).replace(/^#/, "");
          tags.push(s);
        }
      }
      if (cache == null ? void 0 : cache.tags) {
        for (const t of cache.tags) {
          const s = t.tag.replace(/^#/, "");
          if (!tags.includes(s))
            tags.push(s);
        }
      }
      const searchText = [file.basename, title, ...aliases, ...tags].join(" ").toLowerCase();
      this.index.push({
        path: file.path,
        basename: file.basename,
        title,
        aliases,
        tags,
        searchText
      });
    }
  }
  fuzzyMatch(text, query) {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    let qi = 0;
    for (let pi = 0; pi < t.length && qi < q.length; pi++) {
      if (t[pi] === q[qi])
        qi++;
    }
    return qi === q.length;
  }
  doSearch() {
    const q = this.searchInput.value.trim();
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    if (!this.resultDropdown)
      return;
    if (!q) {
      this.resultDropdown.empty();
      this.resultDropdown.style.display = "none";
      return;
    }
    const isTagSearch = q.startsWith("#");
    const query = isTagSearch ? q.slice(1) : q;
    const lowerQuery = query.toLowerCase();
    const scored = [];
    for (const entry of this.index) {
      let bestScore = 0;
      let matchType = "fuzzy";
      if (isTagSearch) {
        const exactTag = entry.tags.some((t) => t.toLowerCase() === lowerQuery);
        const partialTag = entry.tags.some((t) => t.toLowerCase().includes(lowerQuery));
        if (exactTag) {
          bestScore = 50;
          matchType = "tag";
        } else if (partialTag) {
          bestScore = 40;
          matchType = "tag";
        }
      }
      if (entry.basename.toLowerCase() === lowerQuery) {
        bestScore = Math.max(bestScore, 60);
        matchType = "filename";
      } else if (entry.basename.toLowerCase().startsWith(lowerQuery)) {
        bestScore = Math.max(bestScore, 55);
        matchType = "filename";
      } else if (this.fuzzyMatch(entry.basename, query)) {
        bestScore = Math.max(bestScore, 35);
        matchType = "fuzzy";
      }
      if (entry.title && entry.title.toLowerCase() === lowerQuery) {
        bestScore = Math.max(bestScore, 45);
        matchType = "title";
      } else if (entry.title && entry.title.toLowerCase().includes(lowerQuery)) {
        bestScore = Math.max(bestScore, 30);
        matchType = "title";
      }
      for (const alias of entry.aliases) {
        if (alias.toLowerCase() === lowerQuery) {
          bestScore = Math.max(bestScore, 42);
          matchType = "alias";
        } else if (alias.toLowerCase().includes(lowerQuery)) {
          bestScore = Math.max(bestScore, 28);
          matchType = "alias";
        }
      }
      if (!isTagSearch && this.fuzzyMatch(entry.searchText, query) && bestScore === 0) {
        bestScore = 10;
        matchType = "fuzzy";
      }
      if (bestScore > 0)
        scored.push({ entry, score: bestScore, matchType });
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
      const typeLabels = {
        filename: "\u6587\u4EF6",
        title: "\u6807\u9898",
        alias: "\u522B\u540D",
        tag: "\u6807\u7B7E",
        fuzzy: "\u5339\u914D"
      };
      const typeBadge = item.createEl("span", {
        text: typeLabels[matchType],
        cls: `dashboard-search-result-type dashboard-search-type-${matchType}`
      });
      item.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        if (this.resultDropdown)
          this.resultDropdown.style.display = "none";
        if (this.searchInput)
          this.searchInput.value = "";
        const f = this.app.vault.getAbstractFileByPath(entry.path);
        if (f instanceof import_obsidian8.TFile)
          await this.app.workspace.getLeaf(false).openFile(f);
      });
    }
    this.resultDropdown.style.display = "block";
  }
};

// src/ui/components/FileStatsComponent.ts
var import_obsidian10 = require("obsidian");

// src/modals/FolderConfigModal.ts
var import_obsidian9 = require("obsidian");
var FolderConfigModal = class extends import_obsidian9.Modal {
  constructor(app, settings, fileService, onSave) {
    super(app);
    this.settings = { ...settings };
    this.fileService = fileService;
    this.onSave = onSave;
    this.selected = new Set(settings.trackedFolders);
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u7EDF\u8BA1\u6587\u4EF6\u5939\u914D\u7F6E" });
    contentEl.createEl("p", {
      text: "\u9009\u62E9\u9700\u8981\u5355\u72EC\u7EDF\u8BA1\u6570\u91CF\u7684\u6587\u4EF6\u5939\u3002\u672A\u9009\u4E2D\u7684\u6587\u4EF6\u5939\u4ECD\u8BA1\u5165 Vault \u603B\u6570\u3002",
      cls: "dashboard-modal-desc"
    });
    const vaultPaths = this.fileService.getFolderPaths();
    const allPaths = [.../* @__PURE__ */ new Set([...vaultPaths, ...this.settings.trackedFolders])].sort();
    const checkboxWrap = contentEl.createDiv("dashboard-checkbox-grid");
    const existingSet = new Set(vaultPaths);
    for (const path of allPaths) {
      const exists = existingSet.has(path);
      const label = checkboxWrap.createEl("label", { cls: "dashboard-checkbox-label" });
      const cb = label.createEl("input", { type: "checkbox" });
      cb.checked = this.selected.has(path);
      label.appendText(path);
      if (!exists) {
        label.createEl("span", { text: " (\u4E0D\u5B58\u5728)", cls: "dashboard-checkbox-missing" });
      }
      cb.addEventListener("change", () => {
        if (cb.checked)
          this.selected.add(path);
        else
          this.selected.delete(path);
      });
    }
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.settings.trackedFolders = [...this.selected];
      this.onSave(this.settings);
      this.close();
      new import_obsidian9.Notice("\u6587\u4EF6\u5939\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/ui/components/utils.ts
function formatRelativeTime(mtime) {
  const diff = Math.floor((Date.now() - mtime) / 6e4);
  if (diff < 1)
    return "\u521A\u521A";
  if (diff < 60)
    return `${diff}\u5206\u949F\u524D`;
  if (diff < 1440)
    return `${Math.floor(diff / 60)}\u5C0F\u65F6\u524D`;
  return `${Math.floor(diff / 1440)}\u5929\u524D`;
}
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function attachFileListPopover(trigger, files, title, onFileClick) {
  let popover = null;
  let hideTimer = null;
  const clearTimer = () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };
  const remove = () => {
    clearTimer();
    if (popover) {
      popover.remove();
      popover = null;
    }
  };
  const show = () => {
    clearTimer();
    remove();
    popover = document.body.createDiv("dashboard-popover");
    popover.createDiv("dashboard-popover-title").textContent = `${title} (${files.length})`;
    for (const filePath of files) {
      const item = popover.createDiv("dashboard-popover-item");
      item.textContent = `\u2022 ${filePath}`;
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

// src/ui/components/FileStatsComponent.ts
var FileStatsComponent = class extends BaseComponent {
  constructor(app, settings, onSettingsChange) {
    super(app, settings);
    this.fileService = new FileService(app);
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "file-stats";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const fsTitleWrap = header.createDiv("dashboard-module-title-wrap");
    fsTitleWrap.createEl("span", { text: "\u{1F4C1}", cls: "dashboard-module-icon" });
    fsTitleWrap.createEl("span", { text: "\u6587\u4EF6\u7EDF\u8BA1", cls: "dashboard-module-title" });
    const addBtn = header.createEl("button", { cls: "dashboard-icon-btn", title: "\u589E\u52A0\u6587\u4EF6\u7EDF\u8BA1" });
    addBtn.style.marginLeft = "auto";
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
    addBtn.addEventListener("click", () => {
      new FolderConfigModal(this.app, this.settings, this.fileService, async (s) => {
        await this.onSettingsChange(s);
      }).open();
    });
    const body = mod.createDiv("dashboard-module-body");
    const statsContainer = body.createDiv({ attr: { id: "dashboard-file-stats-container" } });
    await this.renderFileStats(statsContainer);
    const recentContainer = body.createDiv({ cls: "dashboard-recent-section", attr: { id: "dashboard-recent-container" } });
    this.renderRecentFiles(recentContainer);
  }
  async renderFileStats(container) {
    container.empty();
    let stats;
    try {
      stats = await this.fileService.getStats(this.settings.trackedFolders);
    } catch (e) {
      container.createDiv({ text: "\u52A0\u8F7D\u5931\u8D25", cls: "dashboard-error" });
      return;
    }
    const totalRow = container.createDiv("dashboard-stat-total");
    totalRow.createEl("span", { text: "Vault \u603B\u6587\u4EF6" });
    totalRow.createEl("strong", { text: String(stats.total) });
    if (stats.folderStats.length > 0) {
      const maxCount = Math.max(...stats.folderStats.map((f) => f.count), 1);
      const list = container.createDiv("dashboard-folder-list");
      for (const fs of stats.folderStats) {
        const row = list.createDiv("dashboard-folder-row");
        const nameEl = row.createEl("span", { text: fs.name, cls: "dashboard-folder-row-name", title: fs.name });
        nameEl.addEventListener("click", () => {
          this.fileService.toggleFolderInExplorer(fs.name);
        });
        const barWrap = row.createDiv("dashboard-folder-row-bar-wrap");
        barWrap.createDiv("dashboard-folder-row-bar-fill").style.width = `${Math.round(fs.count / maxCount * 100)}%`;
        row.createEl("span", { text: String(fs.count), cls: "dashboard-folder-row-count" });
      }
    }
    const anomaly = container.createDiv("dashboard-anomaly-row");
    this.createBadge(anomaly, `\u26A0 \u5B64\u7ACB ${stats.orphanCount}`, stats.orphanCount > 0 ? "warn" : "ok", `\u5B64\u7ACB\u9875\u9762\uFF08${stats.orphanCount}\uFF09`, stats.orphanFiles);
    this.createBadge(anomaly, `\u26A0 \u65E0\u6765\u6E90 ${stats.nosourceCount}`, stats.nosourceCount > 0 ? "warn" : "ok", `\u65E0\u6765\u6E90\u9875\u9762\uFF08${stats.nosourceCount}\uFF09`, stats.nosourceFiles);
    this.createBadge(anomaly, `\u26A0 \u7A7A\u767D ${stats.emptyCount}`, stats.emptyCount > 0 ? "warn" : "ok", `\u7A7A\u767D\u9875\u9762\uFF08${stats.emptyCount}\uFF09`, stats.emptyFilesList);
    const health = container.createDiv("dashboard-health");
    const healthLabel = health.createDiv("dashboard-health-label");
    healthLabel.createEl("span", { text: "\u5065\u5EB7\u5EA6" });
    healthLabel.createEl("strong", { text: `${stats.healthScore}\u5206\uFF08\u5B64\u7ACB\u536040% + \u65E0\u6765\u6E90\u536030% + \u7A7A\u767D\u536030%\uFF09` });
    const healthTrack = health.createDiv("dashboard-health-track");
    const healthFill = healthTrack.createDiv("dashboard-health-fill");
    healthFill.style.width = `${stats.healthScore}%`;
    healthFill.style.background = stats.healthScore >= 80 ? "var(--color-green)" : stats.healthScore >= 50 ? "var(--color-yellow)" : "var(--color-red)";
  }
  renderRecentFiles(container) {
    container.empty();
    const recentFiles = this.fileService.getRecentlyModified(5);
    if (recentFiles.length === 0)
      return;
    container.createEl("span", { text: "\u6700\u8FD1\u4FEE\u6539", cls: "dashboard-recent-title" });
    const list = container.createDiv("dashboard-recent-list");
    for (const rf of recentFiles) {
      const row = list.createDiv("dashboard-recent-row");
      const nameEl = row.createEl("span", { text: rf.path, cls: "dashboard-recent-path", title: rf.path });
      nameEl.addEventListener("click", () => {
        const f = this.app.vault.getAbstractFileByPath(rf.path);
        if (f instanceof import_obsidian10.TFile)
          this.app.workspace.getLeaf(false).openFile(f);
      });
      row.createEl("span", { text: formatRelativeTime(rf.mtime), cls: "dashboard-recent-time" });
    }
  }
  createBadge(parent, text, level, tooltip, files) {
    const badge = parent.createEl("span", { text, cls: `dashboard-badge dashboard-badge-${level}` });
    if (!files || files.length === 0)
      return;
    attachFileListPopover(badge, files, tooltip != null ? tooltip : text, (filePath) => {
      const f = this.app.vault.getAbstractFileByPath(filePath);
      if (f instanceof import_obsidian10.TFile)
        this.app.workspace.getLeaf(false).openFile(f);
    });
  }
};

// src/ui/components/HeatmapComponent.ts
var import_obsidian12 = require("obsidian");

// src/modals/ReportConfigModal.ts
var import_obsidian11 = require("obsidian");
var REPORT_LABELS = {
  daily: "\u65E5\u62A5",
  weekly: "\u5468\u62A5",
  monthly: "\u6708\u62A5",
  quarterly: "\u5B63\u62A5",
  yearly: "\u5E74\u62A5"
};
var TOKEN_HELP = "\u683C\u5F0F\u4EE4\u724C: YYYY(\u5E74) YY(\u5E74\u540E\u4E24\u4F4D) MM(\u6708\u8865\u96F6) M(\u6708) DD(\u65E5\u8865\u96F6) D(\u65E5) ww(\u5468\u8865\u96F6) w(\u5468) Q(\u5B63\u5EA6) [\u6587\u5B57](\u539F\u6587\u8F93\u51FA)";
var EXAMPLE = {
  daily: "YYYY/MM/YYYY-MM-DD",
  weekly: "YYYY/MM/YYYY-[W]ww",
  monthly: "YYYY/MM/YYYY-MM",
  quarterly: "YYYY/MM/YYYY-[Q]Q",
  yearly: "YYYY/YYYY"
};
var ReportConfigModal = class extends import_obsidian11.Modal {
  constructor(app, configs, onSave) {
    super(app);
    this.onSave = onSave;
    this.mdFiles = [];
    this.folders = [];
    this.configs = JSON.parse(JSON.stringify(configs));
    const files = this.app.vault.getMarkdownFiles();
    this.mdFiles = files.map((f) => ({ path: f.path.replace(/\.md$/, ""), name: f.path })).sort((a, b) => a.name.localeCompare(b.name));
    const dirSet = /* @__PURE__ */ new Set();
    dirSet.add("");
    for (const f of this.app.vault.getAllLoadedFiles()) {
      if (f instanceof import_obsidian11.TFolder)
        dirSet.add(f.path);
    }
    this.folders = [...dirSet].sort();
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.createEl("h2", { text: "\u62A5\u8868\u914D\u7F6E" });
    const activeTab = {};
    let currentType = "daily";
    const tabBar = contentEl.createDiv("dashboard-report-tabs");
    const panel = contentEl.createDiv("dashboard-report-panel");
    const showTab = (type) => {
      currentType = type;
      for (const [t, el] of Object.entries(activeTab)) {
        el.classList.toggle("active", t === type);
      }
      this.renderTabContent(panel, type);
    };
    for (const type of Object.keys(REPORT_LABELS)) {
      const tab = tabBar.createEl("button", {
        text: REPORT_LABELS[type],
        cls: "dashboard-report-tab"
      });
      tab.addEventListener("click", () => showTab(type));
      activeTab[type] = tab;
    }
    showTab("daily");
    contentEl.createDiv({ text: TOKEN_HELP, cls: "dashboard-field-hint" });
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.configs);
      this.close();
      new import_obsidian11.Notice("\u62A5\u8868\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  renderTabContent(panel, type) {
    panel.empty();
    const cfg = this.configs[type];
    this.createToggle(panel, "\u542F\u7528", cfg.enabled, (v) => cfg.enabled = v);
    this.createToggle(panel, "\u65B0\u5EFA\u65F6\u5F39\u7A97\u786E\u8BA4", cfg.confirmBeforeCreate, (v) => cfg.confirmBeforeCreate = v);
    this.createDirectorySelect(panel, cfg);
    this.createFormatField(panel, cfg, type);
    this.createTemplateSelect(panel, cfg);
  }
  createToggle(parent, label, value, onChange) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const toggle = row.createEl("label", { cls: "dashboard-toggle" });
    const cb = toggle.createEl("input");
    cb.type = "checkbox";
    cb.checked = value;
    cb.addEventListener("change", () => onChange(cb.checked));
    toggle.createEl("span", { cls: "dashboard-toggle-slider" });
  }
  createDirectorySelect(parent, cfg) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u5B58\u653E\u76EE\u5F55" });
    const wrap = row.createDiv("dashboard-select-wrap");
    const select = wrap.createEl("select");
    for (const f of this.folders) {
      const label = f || "\uFF08vault \u6839\u76EE\u5F55\uFF09";
      const opt = select.createEl("option", { value: f, text: label });
      if (f === cfg.directory)
        opt.selected = true;
    }
    if (cfg.directory && !this.folders.includes(cfg.directory)) {
      const opt = select.createEl("option", { value: cfg.directory, text: `${cfg.directory}\uFF08\u81EA\u5B9A\u4E49\uFF09` });
      opt.selected = true;
    }
    select.addEventListener("change", () => {
      cfg.directory = select.value;
    });
  }
  createFormatField(parent, cfg, type) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u6587\u4EF6\u8DEF\u5F84\u683C\u5F0F" });
    const input = row.createEl("input");
    input.type = "text";
    input.placeholder = EXAMPLE[type];
    input.value = cfg.filenameFormat;
    const preview = row.createDiv("dashboard-format-preview");
    const updatePreview = () => {
      try {
        preview.textContent = `\u793A\u4F8B: ${this.formatMomentDate(/* @__PURE__ */ new Date(), input.value || EXAMPLE[type])}`;
      } catch (e) {
        preview.textContent = "\u793A\u4F8B: \uFF08\u683C\u5F0F\u65E0\u6548\uFF09";
      }
    };
    updatePreview();
    input.addEventListener("input", () => {
      cfg.filenameFormat = input.value.trim();
      updatePreview();
    });
  }
  formatMomentDate(date, format) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7));
    const Q = String(Math.floor(date.getMonth() / 3) + 1);
    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, "0")).replace(/DD/g, d.padStart(2, "0")).replace(/ww/g, w.padStart(2, "0")).replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }
  createTemplateSelect(parent, cfg) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: "\u6A21\u677F\u6587\u4EF6" });
    const wrap = row.createDiv("dashboard-select-wrap");
    const select = wrap.createEl("select");
    const noneOpt = select.createEl("option", { value: "", text: "\uFF08\u4E0D\u4F7F\u7528\u6A21\u677F\uFF09" });
    if (!cfg.templatePath)
      noneOpt.selected = true;
    for (const f of this.mdFiles) {
      const opt = select.createEl("option", { value: f.path, text: f.path });
      if (f.path === cfg.templatePath)
        opt.selected = true;
    }
    select.addEventListener("change", () => {
      cfg.templatePath = select.value;
    });
  }
  createTextField(parent, label, value, onChange, placeholder) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const input = row.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/ui/components/HeatmapComponent.ts
var HeatmapComponent = class _HeatmapComponent extends BaseComponent {
  constructor(app, settings, heatmapService, onSettingsChange) {
    super(app, settings);
    this.currentYear = (/* @__PURE__ */ new Date()).getFullYear();
    // ── Report helpers ──
    this.REPORT_NAMES = {
      daily: "\u65E5\u62A5",
      weekly: "\u5468\u62A5",
      monthly: "\u6708\u62A5",
      quarterly: "\u5B63\u62A5",
      yearly: "\u5E74\u62A5"
    };
    this.heatmapService = heatmapService;
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "heatmap";
  }
  async render(container) {
    var _a;
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const hmTitleWrap = header.createDiv("dashboard-module-title-wrap");
    hmTitleWrap.createEl("span", { text: "\u{1F5D3}", cls: "dashboard-module-icon" });
    hmTitleWrap.createEl("span", { text: "\u5DE5\u4F5C\u70ED\u529B\u56FE", cls: "dashboard-module-title" });
    const yearNav = header.createDiv("dashboard-heatmap-year-nav");
    const prevBtn = yearNav.createEl("span", { text: "\u25C0", cls: "dashboard-heatmap-year-arrow" });
    const yearLabel = yearNav.createEl("span", { text: String(this.currentYear), cls: "dashboard-heatmap-year-label clickable" });
    yearLabel.addEventListener("click", () => {
      if (this.settings.reportConfigs.yearly.enabled) {
        this.openOrCreateReport("yearly", new Date(this.currentYear, 0, 1));
      }
    });
    const nextBtn = yearNav.createEl("span", { text: "\u25B6", cls: "dashboard-heatmap-year-arrow" });
    const cfgBtn = yearNav.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "\u65E5\u62A5/\u5468\u62A5\u914D\u7F6E" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ReportConfigModal(this.app, this.settings.reportConfigs, async (configs) => {
        this.settings.reportConfigs = configs;
        await this.onSettingsChange(this.settings);
      }).open();
    });
    const thisYear = (/* @__PURE__ */ new Date()).getFullYear();
    if (this.currentYear >= thisYear)
      nextBtn.addClass("disabled");
    prevBtn.addEventListener("click", () => {
      this.currentYear--;
      this.render(container);
    });
    nextBtn.addEventListener("click", () => {
      if (this.currentYear < thisYear) {
        this.currentYear++;
        this.render(container);
      }
    });
    const body = mod.createDiv("dashboard-module-body");
    const now = /* @__PURE__ */ new Date();
    const todayStr = fmtDate(now);
    const data = this.heatmapService.getDataSync();
    const maxVal = Math.max(...Object.values(data), 1);
    const year = this.currentYear;
    const DAYS = ["Mon", "", "Wed", "", "Fri", "", "Sun"];
    const mainWrap = body.createDiv("dashboard-heatmap-main-wrap");
    const dayCol = mainWrap.createDiv("dashboard-heatmap-days");
    dayCol.createDiv({ cls: "dashboard-heatmap-days-spacer" });
    for (const d of DAYS) {
      dayCol.createDiv({ text: d, cls: "dashboard-heatmap-day-label" });
    }
    const monthsWrap = mainWrap.createDiv("dashboard-heatmap-months-wrap");
    for (let m = 0; m < 12; m++) {
      const monthBlock = monthsWrap.createDiv("dashboard-heatmap-month-block");
      const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthLabel = monthBlock.createDiv({ text: MONTHS[m], cls: "dashboard-heatmap-month-label clickable" });
      monthLabel.addEventListener("click", () => {
        if (this.settings.reportConfigs.monthly.enabled) {
          this.openOrCreateReport("monthly", new Date(year, m, 1));
        }
      });
      const firstDay = new Date(year, m, 1);
      const firstDow = firstDay.getDay();
      const startOffset = firstDow === 0 ? 6 : firstDow - 1;
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const grid = monthBlock.createDiv("dashboard-heatmap-grid");
      for (let p = 0; p < startOffset; p++) {
        grid.createDiv({ cls: "dashboard-heatmap-cell future" });
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, m, day);
        const dateStr = fmtDate(cellDate);
        const val = (_a = data[dateStr]) != null ? _a : 0;
        const intensity = val === 0 ? 0 : Math.ceil(val / maxVal * 4);
        const isToday = dateStr === todayStr;
        const isFuture = cellDate > now;
        const cell = grid.createDiv({
          cls: [
            "dashboard-heatmap-cell",
            `level-${intensity}`,
            isToday ? "today" : "",
            isFuture ? "future" : ""
          ].filter(Boolean).join(" ")
        });
        if (!isFuture) {
          cell.style.cursor = "pointer";
          let tip = null;
          cell.addEventListener("mouseenter", () => {
            const rect = cell.getBoundingClientRect();
            tip = document.body.createDiv("dashboard-heatmap-tip");
            tip.textContent = `${dateStr}: ${val} \u6B21\u64CD\u4F5C`;
            tip.style.top = `${rect.top - 28}px`;
            tip.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;
          });
          cell.addEventListener("mouseleave", () => {
            tip == null ? void 0 : tip.remove();
            tip = null;
          });
          cell.addEventListener("click", () => this.openOrCreateReport("daily", cellDate));
        }
      }
    }
    const legendRow = body.createDiv("dashboard-heatmap-legend-row");
    const legend = legendRow.createDiv("dashboard-heatmap-legend");
    legend.createEl("span", { text: "\u5C11", cls: "dashboard-heatmap-legend-label" });
    for (let i = 0; i <= 4; i++) {
      legend.createDiv({ cls: `dashboard-heatmap-cell level-${i} legend-cell` });
    }
    legend.createEl("span", { text: "\u591A", cls: "dashboard-heatmap-legend-label" });
    const isCurrentYear = year === (/* @__PURE__ */ new Date()).getFullYear();
    const statsRow = legendRow.createDiv("dashboard-heatmap-stats");
    if (isCurrentYear) {
      const now2 = /* @__PURE__ */ new Date();
      const startOfWeek = new Date(now2);
      startOfWeek.setDate(now2.getDate() - (now2.getDay() + 6) % 7);
      const startOfMonth = new Date(now2.getFullYear(), now2.getMonth(), 1);
      const startOfYear = new Date(year, 0, 1);
      let weekCount = 0, monthCount = 0, yearCount = 0;
      for (const [d, c] of Object.entries(data)) {
        if (d >= fmtDate(startOfWeek))
          weekCount += c;
        if (d >= fmtDate(startOfMonth))
          monthCount += c;
        if (d >= fmtDate(startOfYear))
          yearCount += c;
      }
      statsRow.createEl("span", { text: `\u672C\u5468 ${weekCount} \u6B21` });
      statsRow.createEl("span", { text: `\u672C\u6708 ${monthCount} \u6B21` });
      statsRow.createEl("span", { text: `\u4ECA\u5E74 ${yearCount} \u6B21` });
    } else {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year + 1, 0, 1);
      const endOfYearStr = fmtDate(endOfYear);
      let yearCount = 0;
      for (const [d, c] of Object.entries(data)) {
        if (d >= fmtDate(startOfYear) && d < endOfYearStr)
          yearCount += c;
      }
      statsRow.createEl("span", { text: `${year} \u5E74 ${yearCount} \u6B21` });
    }
  }
  resolveReportPath(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const relPath = _HeatmapComponent.formatMomentDate(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    return dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
  }
  async openOrCreateReport(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const path = this.resolveReportPath(type, date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian12.TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    const doCreate = async () => {
      let content = "";
      if (cfg.templatePath) {
        const tpl = this.app.vault.getAbstractFileByPath(`${cfg.templatePath}.md`);
        if (tpl instanceof import_obsidian12.TFile)
          content = _HeatmapComponent.formatMomentDate(date, await this.app.vault.read(tpl));
      }
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try {
            await this.app.vault.createFolder(acc);
          } catch (e) {
          }
        }
      }
      const created = await this.app.vault.create(path, content);
      await this.app.workspace.getLeaf(false).openFile(created);
    };
    if (cfg.confirmBeforeCreate) {
      const name2 = this.REPORT_NAMES[type];
      new class extends import_obsidian12.Modal {
        onOpen() {
          this.contentEl.createEl("p", { text: `${name2}\u4E0D\u5B58\u5728\uFF0C\u662F\u5426\u65B0\u5EFA\uFF1F` });
          this.contentEl.createEl("p", { text: path, cls: "dashboard-field-hint" });
          const btns = this.contentEl.createDiv("dashboard-confirm-btns");
          btns.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
          btns.createEl("button", { text: "\u65B0\u5EFA", cls: "mod-cta" }).addEventListener("click", async () => {
            this.close();
            try {
              await doCreate();
            } catch (e) {
              new import_obsidian12.Notice(`\u521B\u5EFA\u5931\u8D25: ${e.message}`);
            }
          });
        }
        onClose() {
          this.contentEl.empty();
        }
      }(this.app).open();
    } else {
      try {
        await doCreate();
      } catch (e) {
        new import_obsidian12.Notice(`\u521B\u5EFA${name}\u5931\u8D25: ${e.message}`);
      }
    }
  }
  static formatMomentDate(date, format) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7));
    const Q = String(Math.floor(date.getMonth() / 3) + 1);
    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, "0")).replace(/DD/g, d.padStart(2, "0")).replace(/ww/g, w.padStart(2, "0")).replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }
};

// src/ui/components/LLMCommandComponent.ts
var import_obsidian13 = require("obsidian");
var LLMCommandComponent = class extends BaseComponent {
  constructor(app, settings, llmService, onTokenRefresh) {
    super(app, settings);
    this.executing = false;
    this.llmService = llmService;
    this.logService = new LogService(app);
    this.onTokenRefresh = onTokenRefresh;
  }
  get id() {
    return "llm-command";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const llmHeader = mod.createDiv("dashboard-module-header");
    const llmTitleWrap = llmHeader.createDiv("dashboard-module-title-wrap");
    llmTitleWrap.createEl("span", { text: "\u26A1", cls: "dashboard-module-icon" });
    llmTitleWrap.createEl("span", { text: "LLM \u6307\u4EE4\u6267\u884C", cls: "dashboard-module-title" });
    const body = mod.createDiv("dashboard-module-body");
    const commandSelect = body.createEl("select", { cls: "dashboard-select" });
    for (const cmd of ["query", "ingest", "lint-wiki"]) {
      commandSelect.createEl("option", { value: cmd, text: cmd });
    }
    const placeholders = {
      query: "\u8BF7\u8F93\u5165\u67E5\u8BE2\u95EE\u9898...",
      ingest: "\u8BF7\u7C98\u8D34\u9700\u8981\u5904\u7406\u7684\u539F\u59CB\u5185\u5BB9...",
      "lint-wiki": "\u8BF7\u7C98\u8D34\u9700\u8981\u68C0\u67E5\u7684 wiki \u5185\u5BB9..."
    };
    const inputArea = body.createEl("textarea", { cls: "dashboard-cmd-input" });
    inputArea.placeholder = placeholders["query"];
    commandSelect.addEventListener("change", () => {
      var _a;
      inputArea.placeholder = (_a = placeholders[commandSelect.value]) != null ? _a : "\u8BF7\u8F93\u5165\u5185\u5BB9...";
    });
    const execBtn = body.createEl("button", { text: "\u25B6 \u6267\u884C", cls: "mod-cta dashboard-exec-btn" });
    const resultEl = body.createEl("pre", { cls: "dashboard-result-pre" });
    resultEl.textContent = "\uFF08\u6267\u884C\u7ED3\u679C\u5C06\u663E\u793A\u5728\u6B64\u5904\uFF09";
    const resultActions = body.createDiv("dashboard-result-actions");
    resultActions.style.display = "none";
    const exportBtn = resultActions.createEl("button", { text: "\u5BFC\u51FA\u5230 outputs", cls: "dashboard-link-btn" });
    const errorEl = body.createDiv("dashboard-exec-error");
    errorEl.style.display = "none";
    execBtn.addEventListener("click", async () => {
      if (this.executing)
        return;
      const input = inputArea.value.trim();
      if (!input) {
        new import_obsidian13.Notice("\u8BF7\u8F93\u5165\u5185\u5BB9");
        return;
      }
      if (!this.settings.apiKey) {
        new import_obsidian13.Notice("\u8BF7\u5148\u914D\u7F6E API Key");
        return;
      }
      this.executing = true;
      execBtn.disabled = true;
      execBtn.textContent = "\u6267\u884C\u4E2D...";
      errorEl.style.display = "none";
      resultEl.textContent = "";
      resultActions.style.display = "none";
      try {
        const result = await this.llmService.executeCommand(
          commandSelect.value,
          input
        );
        resultEl.textContent = result;
        resultActions.style.display = "";
        const logType = commandSelect.value === "lint-wiki" ? "lint" : commandSelect.value;
        this.logService.writeLog(logType, input.slice(0, 80));
        exportBtn.onclick = async () => {
          const filename = `outputs/${commandSelect.value}-${Date.now()}.md`;
          try {
            await this.app.vault.create(filename, result);
          } catch (e) {
            await this.app.vault.adapter.mkdir("outputs");
            await this.app.vault.create(filename, result);
          }
          new import_obsidian13.Notice(`\u5DF2\u5BFC\u51FA\u5230 ${filename}`);
        };
      } catch (e) {
        errorEl.textContent = `\u26A0 ${e.message}`;
        errorEl.style.display = "";
      } finally {
        this.executing = false;
        execBtn.disabled = false;
        execBtn.textContent = "\u25B6 \u6267\u884C";
        this.onTokenRefresh();
      }
    });
  }
};

// src/ui/components/GitSyncComponent.ts
var import_obsidian15 = require("obsidian");

// src/modals/GitConfigModal.ts
var import_obsidian14 = require("obsidian");
var GitConfigModal = class extends import_obsidian14.Modal {
  constructor(app, settings, onSave) {
    super(app);
    this.onSave = onSave;
    this.settings = JSON.parse(JSON.stringify(settings));
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("dashboard-modal");
    contentEl.addClass("dashboard-git-config-modal");
    contentEl.createEl("h2", { text: "Git \u540C\u6B65\u914D\u7F6E" });
    this.createToggle(contentEl, "\u542F\u7528 Git \u540C\u6B65", this.settings.gitEnabled, (v) => {
      this.settings.gitEnabled = v;
    });
    this.createTextField(
      contentEl,
      "\u4ED3\u5E93\u5730\u5740",
      this.settings.gitRemoteURL,
      (v) => this.settings.gitRemoteURL = v.trim(),
      "https://github.com/username/repo.git"
    );
    const row1 = contentEl.createDiv("dashboard-git-config-row");
    this.createTextFieldInRow(
      row1,
      "\u8FDC\u7A0B\u540D\u79F0",
      this.settings.gitRemoteName,
      (v) => this.settings.gitRemoteName = v.trim() || "origin",
      "origin"
    );
    this.createTextFieldInRow(
      row1,
      "\u5206\u652F\u540D",
      this.settings.gitBranchName,
      (v) => this.settings.gitBranchName = v.trim() || "main",
      "main"
    );
    const row2 = contentEl.createDiv("dashboard-git-config-row");
    this.createTextFieldInRow(
      row2,
      "GitHub \u7528\u6237\u540D",
      this.settings.gitUsername,
      (v) => this.settings.gitUsername = v.trim(),
      "your-username"
    );
    this.createPasswordFieldInRow(
      row2,
      "GitHub Token",
      this.settings.gitPassword,
      (v) => this.settings.gitPassword = v.trim(),
      "your-token"
    );
    this.createToggle(contentEl, "\u81EA\u52A8 Push", this.settings.gitAutoPushEnabled, (v) => {
      this.settings.gitAutoPushEnabled = v;
    });
    if (this.settings.gitAutoPushEnabled) {
      this.createTextField(
        contentEl,
        "\u81EA\u52A8 Push \u95F4\u9694\uFF08\u5206\u949F\uFF09",
        String(this.settings.gitAutoPushInterval),
        (v) => {
          const n = parseInt(v);
          if (!isNaN(n) && n >= 0)
            this.settings.gitAutoPushInterval = n;
        },
        "0 = \u6BCF\u6B21\u53D8\u66F4\u540E\u63A8\u9001"
      );
    }
    this.createTextFieldWithPreview(
      contentEl,
      "Commit \u6D88\u606F\u6A21\u677F",
      this.settings.gitCommitTemplate,
      (v) => this.settings.gitCommitTemplate = v.trim(),
      "auto: {{date}} {{time}}"
    );
    contentEl.createDiv({
      text: "Token \u83B7\u53D6\u5730\u5740: https://github.com/settings/tokens",
      cls: "dashboard-field-hint"
    });
    const actions = contentEl.createDiv("dashboard-modal-actions");
    actions.style.cssText = "justify-content:flex-end;";
    actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", async () => {
      await this.onSave(this.settings);
      this.close();
      new import_obsidian14.Notice("Git \u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  createToggle(parent, label, value, onChange) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const toggle = row.createEl("label", { cls: "dashboard-toggle" });
    const cb = toggle.createEl("input");
    cb.type = "checkbox";
    cb.checked = value;
    cb.addEventListener("change", () => onChange(cb.checked));
    toggle.createEl("span", { cls: "dashboard-toggle-slider" });
  }
  createTextField(parent, label, value, onChange, placeholder, example) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const wrap = row.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.addEventListener("input", () => onChange(input.value));
    this.addExampleHint(wrap, input, example != null ? example : placeholder);
  }
  createTextFieldInRow(parent, label, value, onChange, placeholder, example) {
    const field = parent.createDiv("dashboard-git-config-half");
    field.createEl("label", { text: label, cls: "dashboard-git-config-label" });
    const wrap = field.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    input.style.width = "100%";
    input.addEventListener("input", () => onChange(input.value));
    this.addExampleHint(wrap, input, example != null ? example : placeholder);
  }
  createPasswordFieldInRow(parent, label, value, onChange, placeholder) {
    const field = parent.createDiv("dashboard-git-config-half");
    field.createEl("label", { text: label, cls: "dashboard-git-config-label" });
    const input = field.createEl("input");
    input.type = "password";
    input.placeholder = placeholder;
    input.value = value;
    input.style.width = "100%";
    input.addEventListener("input", () => onChange(input.value));
  }
  createTextFieldWithPreview(parent, label, value, onChange, placeholder) {
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const wrap = row.createDiv("dashboard-input-wrap");
    const input = wrap.createEl("input");
    input.type = "text";
    input.placeholder = placeholder;
    input.value = value;
    const preview = row.createDiv("dashboard-format-preview");
    const updatePreview = () => {
      const now = /* @__PURE__ */ new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const time = now.toTimeString().slice(0, 8);
      const example = (input.value || placeholder).replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
      preview.textContent = `\u793A\u4F8B: ${example}`;
    };
    input.addEventListener("input", () => {
      onChange(input.value);
      updatePreview();
    });
    updatePreview();
    this.addExampleHint(wrap, input, placeholder);
  }
  addExampleHint(wrap, input, example) {
    if (!example || example === "sk-..." || example === "https://..." || example === "your-token")
      return;
    const hint = wrap.createEl("span", { cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": example } });
    hint.addEventListener("click", () => {
      input.value = example;
      input.dispatchEvent(new Event("input"));
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/ui/components/GitSyncComponent.ts
var GitSyncComponent = class extends BaseComponent {
  constructor(app, settings, gitService, onSettingsChange, onAutoPushSetup) {
    super(app, settings);
    this.pollTimer = null;
    this.autoPushTimer = null;
    this.autoPushDebounceTimer = null;
    this.gitService = gitService;
    this.onSettingsChange = onSettingsChange;
    this.onAutoPushSetup = onAutoPushSetup;
  }
  get id() {
    return "git-sync";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-git-module";
    this.buildHeader(mod);
    const body = mod.createDiv("dashboard-module-body");
    await this.buildBodyContent(body);
  }
  async update() {
    const mod = document.getElementById("dashboard-git-module");
    if (!mod)
      return;
    const existingBody = mod.querySelector(".dashboard-module-body");
    if (existingBody)
      existingBody.remove();
    const body = mod.createDiv("dashboard-module-body");
    await this.buildBodyContent(body);
  }
  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => this.update(), 5e3);
  }
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  setupAutoPush() {
    if (this.autoPushTimer) {
      clearInterval(this.autoPushTimer);
      this.autoPushTimer = null;
    }
    if (!this.settings.gitEnabled || !this.settings.gitAutoPushEnabled)
      return;
    if (this.gitService.isMobile)
      return;
    if (!this.settings.gitRemoteURL)
      return;
    const interval = this.settings.gitAutoPushInterval;
    if (interval > 0) {
      this.autoPushTimer = setInterval(() => {
        this.doAutoPush();
      }, interval * 60 * 1e3);
    }
  }
  destroy() {
    this.stopPolling();
    if (this.autoPushTimer) {
      clearInterval(this.autoPushTimer);
      this.autoPushTimer = null;
    }
    if (this.autoPushDebounceTimer) {
      clearTimeout(this.autoPushDebounceTimer);
      this.autoPushDebounceTimer = null;
    }
    super.destroy();
  }
  // Called by external vault change handler for auto-push on change (interval === 0)
  triggerAutoPushDebounce() {
    if (this.settings.gitEnabled && this.settings.gitAutoPushEnabled && this.settings.gitAutoPushInterval === 0) {
      if (this.autoPushDebounceTimer)
        clearTimeout(this.autoPushDebounceTimer);
      this.autoPushDebounceTimer = setTimeout(() => {
        this.doAutoPush();
      }, 5e3);
    }
  }
  // ── Internal ──
  buildHeader(mod) {
    const header = mod.createDiv("dashboard-module-header");
    const titleWrap = header.createDiv("dashboard-module-title-wrap");
    titleWrap.createEl("span", { text: "\u{1F517}", cls: "dashboard-module-icon" });
    titleWrap.createEl("span", { text: "Git \u540C\u6B65", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "Git \u540C\u6B65\u914D\u7F6E" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => {
      new GitConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
        this.settings = s;
        this.setupAutoPush();
        await this.update();
      }).open();
    });
  }
  async buildBodyContent(body) {
    if (!this.settings.gitEnabled) {
      body.createDiv({
        text: "Git \u540C\u6B65\u672A\u542F\u7528\u3002\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E GitHub \u4ED3\u5E93\u4FE1\u606F\u5E76\u5F00\u542F\u540C\u6B65\u3002",
        cls: "dashboard-git-mobile-hint"
      });
      const settingsBtn = body.createEl("button", { text: "\u6253\u5F00\u8BBE\u7F6E", cls: "mod-cta" });
      settingsBtn.style.cssText = "width:100%;margin-top:8px;";
      settingsBtn.addEventListener("click", () => {
        const settingTabs = this.app.setting;
        if (settingTabs) {
          settingTabs.open();
          settingTabs.openTabById("yy-obsidian-dashboard");
        }
      });
      return;
    }
    if (this.gitService.isMobile) {
      body.createDiv({
        text: "Git \u540C\u6B65\u4EC5\u5728\u684C\u9762\u7AEF Obsidian \u53EF\u7528\u3002\u8BF7\u4F7F\u7528\u684C\u9762\u7AEF\u8FDB\u884C Push/Pull \u64CD\u4F5C\u3002",
        cls: "dashboard-git-mobile-hint"
      });
      return;
    }
    const isRepo = await this.gitService.isGitRepo();
    if (!isRepo) {
      body.createDiv({
        text: "\u5F53\u524D vault \u5C1A\u672A\u521D\u59CB\u5316 Git \u4ED3\u5E93",
        cls: "dashboard-git-notice"
      });
      const initBtn = body.createEl("button", { text: "\u521D\u59CB\u5316 Git \u4ED3\u5E93", cls: "mod-cta dashboard-git-init-btn" });
      initBtn.addEventListener("click", async () => {
        initBtn.disabled = true;
        initBtn.textContent = "\u521D\u59CB\u5316\u4E2D...";
        try {
          await this.gitService.initRepo();
          if (this.settings.gitRemoteURL) {
            await this.gitService.ensureRemote(this.settings.gitRemoteURL, this.settings.gitRemoteName);
          }
          new import_obsidian15.Notice("Git \u4ED3\u5E93\u521D\u59CB\u5316\u6210\u529F");
          await this.update();
        } catch (e) {
          new import_obsidian15.Notice(`\u521D\u59CB\u5316\u5931\u8D25: ${e.message}`);
          initBtn.disabled = false;
          initBtn.textContent = "\u521D\u59CB\u5316 Git \u4ED3\u5E93";
        }
      });
      return;
    }
    let remoteOk = true;
    if (this.settings.gitRemoteURL) {
      try {
        await this.gitService.ensureRemote(this.settings.gitRemoteURL, this.settings.gitRemoteName);
      } catch (e) {
        remoteOk = false;
      }
    }
    let status = { clean: true, files: [], ahead: 0, behind: 0 };
    try {
      status = await this.gitService.getStatus(
        this.settings.gitRemoteName || void 0,
        this.settings.gitBranchName || void 0
      );
    } catch (e) {
    }
    const statusRow = body.createDiv("dashboard-git-status");
    const dot = statusRow.createDiv(`dashboard-git-status-dot ${status.clean ? "clean" : "dirty"}`);
    const statusText = statusRow.createDiv("dashboard-git-status-text");
    if (status.clean && status.ahead === 0 && status.behind === 0) {
      statusText.createEl("span", { text: "\u5DF2\u540C\u6B65\uFF0C\u5DE5\u4F5C\u533A\u5E72\u51C0" });
    } else {
      if (!status.clean) {
        const fileSpan = statusText.createEl("span", {
          text: `${status.files.length} \u4E2A\u6587\u4EF6\u5DF2\u53D8\u66F4`,
          cls: "dashboard-git-files-link"
        });
        this.attachFileListPopover(fileSpan, status.files);
      }
      if (status.ahead > 0) {
        if (!status.clean)
          statusText.createEl("span", { text: " | " });
        statusText.createEl("span", { text: `\u9886\u5148 ${status.ahead} \u4E2A\u63D0\u4EA4` });
      }
      if (status.behind > 0) {
        if (!status.clean || status.ahead > 0)
          statusText.createEl("span", { text: " | " });
        statusText.createEl("span", { text: `\u843D\u540E ${status.behind} \u4E2A\u63D0\u4EA4` });
      }
    }
    if (!remoteOk) {
      statusRow.createDiv({ text: "\u672A\u80FD\u914D\u7F6E\u8FDC\u7A0B\u4ED3\u5E93\uFF0C\u8BF7\u68C0\u67E5\u4ED3\u5E93\u5730\u5740", cls: "dashboard-git-warn" });
    }
    const actions = body.createDiv("dashboard-git-actions");
    const pullBtn = actions.createEl("button", { text: "\u2B07 Pull", cls: "dashboard-git-btn", title: "\u4ECE\u8FDC\u7A0B\u62C9\u53D6\u6700\u65B0\u4EE3\u7801" });
    pullBtn.addEventListener("click", async () => {
      pullBtn.disabled = true;
      pullBtn.textContent = "\u62C9\u53D6\u4E2D...";
      try {
        const result = await this.gitService.pull(
          this.settings.gitRemoteName,
          this.settings.gitBranchName,
          this.settings.gitUsername || void 0,
          this.settings.gitPassword || void 0
        );
        new import_obsidian15.Notice(result);
        await this.update();
      } catch (e) {
        new import_obsidian15.Notice(`Pull \u5931\u8D25: ${e.message}`);
      } finally {
        pullBtn.disabled = false;
        pullBtn.textContent = "\u2B07 Pull";
      }
    });
    const pushBtn = actions.createEl("button", { text: "\u2B06 Push", cls: "mod-cta dashboard-git-btn", title: "\u63D0\u4EA4\u5E76\u63A8\u9001\u6240\u6709\u53D8\u66F4" });
    pushBtn.addEventListener("click", async () => {
      const files = await this.gitService.getStatusFiles();
      if (files.length === 0) {
        new import_obsidian15.Notice("\u6CA1\u6709\u9700\u8981\u63D0\u4EA4\u7684\u6587\u4EF6");
        return;
      }
      this.showPushConfirmModal(files);
    });
    const rollbackBtn = actions.createEl("button", { text: "\u21A9 Rollback", cls: "dashboard-git-btn", title: "\u56DE\u6EDA\u672A\u6682\u5B58\u7684\u53D8\u66F4" });
    rollbackBtn.addEventListener("click", async () => {
      const files = await this.gitService.getStatusFiles();
      if (files.length === 0) {
        new import_obsidian15.Notice("\u6CA1\u6709\u53EF\u4EE5\u56DE\u6EDA\u7684\u53D8\u66F4");
        return;
      }
      this.showRollbackConfirmModal(files);
    });
    const autoRow = body.createDiv("dashboard-git-auto-row");
    const autoLabel = autoRow.createEl("label", { cls: "dashboard-git-auto-label" });
    autoLabel.createEl("span", { text: "\u81EA\u52A8 Push" });
    const autoToggle = autoLabel.createEl("input");
    autoToggle.type = "checkbox";
    autoToggle.checked = this.settings.gitAutoPushEnabled;
    autoToggle.addEventListener("change", async () => {
      this.settings.gitAutoPushEnabled = autoToggle.checked;
      await this.onSettingsChange(this.settings);
      this.setupAutoPush();
    });
    autoRow.createEl("span", {
      text: this.settings.gitAutoPushInterval === 0 ? "\u6BCF\u6B21\u53D8\u66F4\u540E\u81EA\u52A8\u63A8\u9001" : `\u6BCF ${this.settings.gitAutoPushInterval} \u5206\u949F\u81EA\u52A8\u63A8\u9001`,
      cls: "dashboard-git-auto-hint"
    });
    const commits = await this.gitService.getRecentCommits(5);
    if (commits.length > 0) {
      const commitSection = body.createDiv("dashboard-git-commits");
      commitSection.createEl("span", { text: "\u6700\u8FD1\u63D0\u4EA4", cls: "dashboard-git-commits-title" });
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
  async doAutoPush() {
    if (this.gitService.isMobile)
      return;
    try {
      const isRepo = await this.gitService.isGitRepo();
      if (!isRepo)
        return;
      const msg = this.buildCommitMessage();
      await this.gitService.pushAll(
        this.settings.gitRemoteName,
        this.settings.gitBranchName,
        msg,
        this.settings.gitUsername || void 0,
        this.settings.gitPassword || void 0
      );
      console.log("[yyDashboard] Auto push completed");
      new import_obsidian15.Notice("\u81EA\u52A8\u63A8\u9001\u6210\u529F");
    } catch (e) {
      console.log(`[yyDashboard] Auto push failed: ${e.message}`);
      new import_obsidian15.Notice(`\u81EA\u52A8\u63A8\u9001\u5931\u8D25: ${e.message}`);
    }
  }
  buildCommitMessage() {
    const now = /* @__PURE__ */ new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const time = now.toTimeString().slice(0, 8);
    return this.settings.gitCommitTemplate.replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
  }
  formatGitDate(dateStr) {
    try {
      const d = new Date(dateStr);
      const now = /* @__PURE__ */ new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / 6e4);
      if (diff < 1)
        return "\u521A\u521A";
      if (diff < 60)
        return `${diff} \u5206\u949F\u524D`;
      if (diff < 1440)
        return `${Math.floor(diff / 60)} \u5C0F\u65F6\u524D`;
      if (diff < 43200)
        return `${Math.floor(diff / 1440)} \u5929\u524D`;
      return dateStr.slice(0, 10);
    } catch (e) {
      return dateStr;
    }
  }
  // ── Popovers ──
  attachFileListPopover(trigger, files) {
    let popover = null;
    let hideTimer = null;
    const clearTimer = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const remove = () => {
      clearTimer();
      if (popover) {
        popover.remove();
        popover = null;
      }
    };
    const show = () => {
      clearTimer();
      remove();
      popover = document.body.createDiv("dashboard-popover");
      popover.createDiv("dashboard-popover-title").textContent = `\u53D8\u66F4\u6587\u4EF6 (${files.length})`;
      for (const filePath of files) {
        popover.createDiv("dashboard-popover-item").textContent = filePath;
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
  attachCommitFilePopover(trigger, commitHash) {
    let popover = null;
    let hideTimer = null;
    const clearTimer = () => {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    };
    const remove = () => {
      clearTimer();
      if (popover) {
        popover.remove();
        popover = null;
      }
    };
    const show = async () => {
      clearTimer();
      remove();
      popover = document.body.createDiv("dashboard-popover");
      popover.createDiv("dashboard-popover-title").textContent = "\u52A0\u8F7D\u4E2D...";
      const rect = trigger.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
      popover.addEventListener("mouseenter", clearTimer);
      popover.addEventListener("mouseleave", () => {
        hideTimer = setTimeout(remove, 200);
      });
      const files = await this.gitService.getCommitFiles(commitHash);
      popover.empty();
      popover.createDiv("dashboard-popover-title").textContent = `\u63D0\u4EA4 ${commitHash} (${files.length} \u4E2A\u6587\u4EF6)`;
      if (files.length === 0) {
        popover.createDiv("dashboard-popover-item").textContent = "\u65E0\u6CD5\u83B7\u53D6\u6587\u4EF6\u5217\u8868";
      } else {
        for (const filePath of files) {
          const item = popover.createDiv("dashboard-popover-item");
          item.textContent = filePath;
          item.style.cursor = "pointer";
          item.addEventListener("mousedown", async (e) => {
            e.preventDefault();
            const f = this.app.vault.getAbstractFileByPath(filePath);
            if (f instanceof import_obsidian15.TFile)
              await this.app.workspace.getLeaf(false).openFile(f);
            remove();
          });
        }
      }
    };
    trigger.addEventListener("mouseenter", show);
    trigger.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(remove, 200);
    });
  }
  // ── Push confirm modal ──
  showPushConfirmModal(files) {
    const gitService = this.gitService;
    const settings = this.settings;
    const view = this;
    const STATUS_LABELS = {
      " M": "\u5DF2\u4FEE\u6539",
      "??": "\u65B0\u589E",
      " A": "\u65B0\u589E(\u5DF2\u6682\u5B58)",
      "AM": "\u65B0\u589E(\u6709\u51B2\u7A81)",
      " D": "\u5DF2\u5220\u9664",
      "M ": "\u5DF2\u6682\u5B58",
      "A ": "\u5DF2\u6682\u5B58",
      "D ": "\u5DF2\u5220\u9664(\u5DF2\u6682\u5B58)",
      "MM": "\u6709\u51B2\u7A81",
      "R ": "\u5DF2\u91CD\u547D\u540D"
    };
    new class extends import_obsidian15.Modal {
      constructor() {
        super(...arguments);
        this.checkboxes = [];
      }
      onOpen() {
        var _a;
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("dashboard-push-confirm-modal");
        contentEl.createEl("h3", { text: "\u786E\u8BA4\u63A8\u9001" });
        contentEl.createEl("p", { text: `\u5171 ${files.length} \u4E2A\u6587\u4EF6\u53D8\u66F4\uFF0C\u52FE\u9009\u9700\u8981\u63D0\u4EA4\u7684\u6587\u4EF6\uFF1A`, cls: "dashboard-push-confirm-hint" });
        const commitMsg = contentEl.createDiv("dashboard-push-commit-row");
        commitMsg.createEl("label", { text: "Commit \u6D88\u606F\uFF1A" });
        const msgInput = commitMsg.createEl("input", { cls: "dashboard-push-commit-input" });
        msgInput.value = view.buildCommitMessage();
        const list = contentEl.createDiv("dashboard-push-file-list");
        const selectAllRow = list.createDiv("dashboard-push-select-all");
        const selectAllLabel = selectAllRow.createEl("label", { cls: "dashboard-push-check-label" });
        this.allCb = selectAllLabel.createEl("input");
        this.allCb.type = "checkbox";
        this.allCb.checked = true;
        selectAllLabel.createEl("span", { text: "\u5168\u9009 / \u53D6\u6D88\u5168\u9009" });
        this.allCb.addEventListener("change", () => {
          for (const { cb } of this.checkboxes)
            cb.checked = this.allCb.checked;
        });
        for (const f of files) {
          const row = list.createDiv("dashboard-push-file-row");
          const checkLabel = row.createEl("label", { cls: "dashboard-push-check-label" });
          const cb = checkLabel.createEl("input");
          cb.type = "checkbox";
          cb.checked = true;
          this.checkboxes.push({ file: f, cb });
          cb.addEventListener("change", () => {
            const allChecked = this.checkboxes.every((c) => c.cb.checked);
            this.allCb.checked = allChecked;
          });
          row.createEl("span", {
            text: (_a = STATUS_LABELS[f.status]) != null ? _a : f.status,
            cls: `dashboard-push-status dashboard-push-status-${f.staged ? "staged" : "unstaged"}`
          });
          row.createEl("span", { text: f.path, cls: "dashboard-push-file-path" });
        }
        const actions = contentEl.createDiv("dashboard-modal-actions");
        actions.style.cssText = "justify-content:space-between;";
        const cancelBtn = actions.createEl("button", { text: "\u53D6\u6D88" });
        cancelBtn.addEventListener("click", () => this.close());
        const rightBtns = actions.createDiv();
        rightBtns.style.cssText = "display:flex;gap:8px;";
        const commitOnlyBtn = rightBtns.createEl("button", { text: "\u4EC5 Commit" });
        commitOnlyBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) {
            new import_obsidian15.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6");
            return;
          }
          commitOnlyBtn.disabled = true;
          commitOnlyBtn.textContent = "\u63D0\u4EA4\u4E2D...";
          try {
            const staged = await gitService.stageFiles(selected);
            const committed = await gitService.commit(msgInput.value.trim() || view.buildCommitMessage());
            if (committed) {
              new import_obsidian15.Notice(staged.length === selected.length ? `\u5DF2\u63D0\u4EA4 ${staged.length} \u4E2A\u6587\u4EF6` : `\u5DF2\u63D0\u4EA4 ${staged.length} \u4E2A\u6587\u4EF6\uFF08${selected.length - staged.length} \u4E2A\u6682\u5B58\u5931\u8D25\uFF09`);
            } else {
              new import_obsidian15.Notice("\u6CA1\u6709\u9700\u8981\u63D0\u4EA4\u7684\u53D8\u66F4");
            }
            this.close();
            await view.update();
          } catch (e) {
            new import_obsidian15.Notice(`Commit \u5931\u8D25: ${e.message}`);
            commitOnlyBtn.disabled = false;
            commitOnlyBtn.textContent = "\u4EC5 Commit";
          }
        });
        const pushBtn = rightBtns.createEl("button", { text: "Commit & Push", cls: "mod-cta" });
        pushBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) {
            new import_obsidian15.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6");
            return;
          }
          pushBtn.disabled = true;
          pushBtn.textContent = "\u63A8\u9001\u4E2D...";
          try {
            const staged = await gitService.stageFiles(selected);
            await gitService.commit(msgInput.value.trim() || view.buildCommitMessage());
            await gitService.push(
              settings.gitRemoteName,
              settings.gitBranchName,
              settings.gitUsername || void 0,
              settings.gitPassword || void 0
            );
            new import_obsidian15.Notice(staged.length === selected.length ? `\u5DF2\u63A8\u9001 ${staged.length} \u4E2A\u6587\u4EF6` : `\u5DF2\u63A8\u9001 ${staged.length} \u4E2A\u6587\u4EF6\uFF08${selected.length - staged.length} \u4E2A\u6682\u5B58\u5931\u8D25\uFF09`);
            this.close();
            await view.update();
          } catch (e) {
            new import_obsidian15.Notice(`Push \u5931\u8D25: ${e.message}`);
            pushBtn.disabled = false;
            pushBtn.textContent = "Commit & Push";
          }
        });
      }
      onClose() {
        this.contentEl.empty();
      }
    }(this.app).open();
  }
  // ── Rollback confirm modal ──
  showRollbackConfirmModal(files) {
    const gitService = this.gitService;
    const view = this;
    const STATUS_LABELS = {
      " M": "\u5DF2\u4FEE\u6539",
      "??": "\u65B0\u589E",
      " D": "\u5DF2\u5220\u9664"
    };
    new class extends import_obsidian15.Modal {
      constructor() {
        super(...arguments);
        this.checkboxes = [];
      }
      onOpen() {
        var _a;
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("dashboard-push-confirm-modal");
        contentEl.createEl("h3", { text: "\u786E\u8BA4\u56DE\u6EDA" });
        contentEl.createEl("p", { text: `\u5171 ${files.length} \u4E2A\u6587\u4EF6\u6709\u53D8\u66F4\uFF0C\u52FE\u9009\u9700\u8981\u56DE\u6EDA\u7684\u6587\u4EF6\uFF1A`, cls: "dashboard-push-confirm-hint" });
        const warn = contentEl.createEl("p", { text: "\u26A0 \u56DE\u6EDA\u5C06\u4E22\u5F03\u6240\u6709\u672A\u63D0\u4EA4\u7684\u53D8\u66F4\uFF0C\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF01", cls: "dashboard-push-confirm-hint" });
        warn.style.cssText = "color:var(--text-error);font-weight:600;";
        const list = contentEl.createDiv("dashboard-push-file-list");
        const selectAllRow = list.createDiv("dashboard-push-select-all");
        const selectAllLabel = selectAllRow.createEl("label", { cls: "dashboard-push-check-label" });
        this.allCb = selectAllLabel.createEl("input");
        this.allCb.type = "checkbox";
        this.allCb.checked = true;
        selectAllLabel.createEl("span", { text: "\u5168\u9009 / \u53D6\u6D88\u5168\u9009" });
        this.allCb.addEventListener("change", () => {
          for (const { cb } of this.checkboxes)
            cb.checked = this.allCb.checked;
        });
        for (const f of files) {
          const row = list.createDiv("dashboard-push-file-row");
          const checkLabel = row.createEl("label", { cls: "dashboard-push-check-label" });
          const cb = checkLabel.createEl("input");
          cb.type = "checkbox";
          cb.checked = true;
          this.checkboxes.push({ file: f, cb });
          cb.addEventListener("change", () => {
            const allChecked = this.checkboxes.every((c) => c.cb.checked);
            this.allCb.checked = allChecked;
          });
          row.createEl("span", { text: (_a = STATUS_LABELS[f.status]) != null ? _a : f.status, cls: "dashboard-push-status dashboard-push-status-unstaged" });
          row.createEl("span", { text: f.path, cls: "dashboard-push-file-path" });
        }
        const actions = contentEl.createDiv("dashboard-modal-actions");
        actions.style.cssText = "justify-content:flex-end;";
        actions.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
        const confirmBtn = actions.createEl("button", { text: "\u786E\u8BA4\u56DE\u6EDA", cls: "mod-cta" });
        confirmBtn.style.cssText = "background-color:var(--text-error);";
        confirmBtn.addEventListener("click", async () => {
          const selected = this.checkboxes.filter((c) => c.cb.checked).map((c) => c.file.path);
          if (selected.length === 0) {
            new import_obsidian15.Notice("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6587\u4EF6");
            return;
          }
          confirmBtn.disabled = true;
          confirmBtn.textContent = "\u56DE\u6EDA\u4E2D...";
          try {
            const restored = await gitService.restoreFiles(selected);
            new import_obsidian15.Notice(`\u5DF2\u56DE\u6EDA ${restored.length} \u4E2A\u6587\u4EF6`);
            this.close();
            await view.update();
          } catch (e) {
            new import_obsidian15.Notice(`\u56DE\u6EDA\u5931\u8D25: ${e.message}`);
            confirmBtn.disabled = false;
            confirmBtn.textContent = "\u786E\u8BA4\u56DE\u6EDA";
          }
        });
      }
      onClose() {
        this.contentEl.empty();
      }
    }(this.app).open();
  }
};

// src/ui/components/RemotelySaveComponent.ts
var import_obsidian16 = require("obsidian");
var RemotelySaveComponent = class extends BaseComponent {
  constructor(app, settings) {
    super(app, settings);
    this.remotelySaveService = new RemotelySaveService();
    this.fileService = new FileService(app);
  }
  get id() {
    return "remotely-save";
  }
  isRemotelySaveEnabled() {
    var _a, _b;
    const plugins = this.app.plugins;
    if (!plugins)
      return false;
    const manifests = (_a = plugins.manifests) != null ? _a : {};
    if (!manifests["remotely-save"])
      return false;
    const enabledSet = (_b = plugins.enabledPlugins) != null ? _b : {};
    if (enabledSet instanceof Set)
      return enabledSet.has("remotely-save");
    return !!enabledSet["remotely-save"];
  }
  async render(container) {
    if (!this.isRemotelySaveEnabled())
      return;
    const mod = container.createDiv("dashboard-module");
    mod.id = "dashboard-remotely-save-module";
    const header = mod.createDiv("dashboard-module-header");
    const rsTitleWrap = header.createDiv("dashboard-module-title-wrap");
    rsTitleWrap.createEl("span", { text: "\u2601\uFE0F", cls: "dashboard-module-icon" });
    rsTitleWrap.createEl("span", { text: "OneDrive \u540C\u6B65", cls: "dashboard-module-title" });
    const body = mod.createDiv("dashboard-module-body dashboard-sync-body");
    const days = 7;
    const [sessions, totalCount] = await Promise.all([
      this.remotelySaveService.getSyncHistory(days),
      this.remotelySaveService.getTotalSyncCount()
    ]);
    if (sessions.length === 0) {
      body.createDiv({ text: "\u6682\u65E0 Remotely Save \u540C\u6B65\u8BB0\u5F55", cls: "dashboard-git-mobile-hint" });
      return;
    }
    header.createEl("span", { text: `\u5171 ${totalCount} \u6B21\u540C\u6B65`, cls: "dashboard-module-badge" });
    const sessionList = body.createDiv("dashboard-sync-session-list");
    for (const session of sessions) {
      const sessionBlock = sessionList.createDiv("dashboard-sync-session");
      const sessionHeader = sessionBlock.createDiv("dashboard-sync-session-header");
      const date = new Date(session.ts);
      const dateStr = date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
      sessionHeader.createEl("span", { text: dateStr, cls: "dashboard-sync-time" });
      const badges = sessionHeader.createDiv("dashboard-sync-badges");
      if (session.uploads.length > 0)
        badges.createEl("span", { text: `\u2191 ${session.uploads.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-upload" });
      if (session.downloads.length > 0)
        badges.createEl("span", { text: `\u2193 ${session.downloads.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-download" });
      if (session.deletions.length > 0)
        badges.createEl("span", { text: `\u2715 ${session.deletions.length}`, cls: "dashboard-sync-badge dashboard-sync-badge-delete" });
      if (session.totalCount === 0)
        badges.createEl("span", { text: "\u65E0\u53D8\u66F4", cls: "dashboard-sync-badge dashboard-sync-badge-none" });
      const toggleBtn = sessionHeader.createEl("button", { cls: "dashboard-sync-toggle" });
      toggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      const fileList = sessionBlock.createDiv("dashboard-sync-files");
      fileList.style.display = "none";
      const doToggle = () => {
        const isHidden = fileList.style.display === "none";
        fileList.style.display = isHidden ? "block" : "none";
        toggleBtn.classList.toggle("expanded", isHidden);
      };
      toggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        doToggle();
      });
      sessionHeader.addEventListener("click", doToggle);
      this.renderSyncFileGroup(fileList, "\u5DF2\u4E0A\u4F20", session.uploads, "upload");
      this.renderSyncFileGroup(fileList, "\u5DF2\u4E0B\u8F7D", session.downloads, "download");
      this.renderSyncFileGroup(fileList, "\u5DF2\u5220\u9664", session.deletions, "delete");
    }
  }
  renderSyncFileGroup(parent, label, files, cls) {
    if (files.length === 0)
      return;
    const group = parent.createDiv("dashboard-sync-file-group");
    group.createEl("span", { text: label, cls: `dashboard-sync-file-label dashboard-sync-file-${cls}` });
    for (const f of files) {
      const item = group.createEl("div", { text: f, cls: "dashboard-sync-file-item" });
      item.addEventListener("click", () => {
        const cleanPath = f.replace(/^\/+|\/+$/g, "");
        const abstract = this.app.vault.getAbstractFileByPath(cleanPath);
        if (abstract instanceof import_obsidian16.TFile) {
          this.app.workspace.getLeaf(false).openFile(abstract);
        } else if (abstract instanceof import_obsidian16.TFolder) {
          this.fileService.toggleFolderInExplorer(cleanPath);
        } else {
          const lastSlash = cleanPath.lastIndexOf("/");
          if (lastSlash > 0)
            this.fileService.toggleFolderInExplorer(cleanPath.slice(0, lastSlash));
        }
      });
    }
  }
};

// src/ui/components/TaskQuickAddComponent.ts
var import_obsidian17 = require("obsidian");
var TASK_SECTIONS = [
  { key: "urgent", label: "\u{1F534} \u7D27\u6025", section: "### \u{1F534} \u7D27\u6025/\u91CD\u8981", placeholder: "\u7D27\u6025\u4EFB\u52A1..." },
  { key: "normal", label: "\u{1F7E1} \u4E00\u822C", section: "### \u{1F7E1} \u4E00\u822C", placeholder: "\u4E00\u822C\u4EFB\u52A1..." },
  { key: "low", label: "\u{1F7E2} \u4F4E\u4F18\u5148\u7EA7", section: "### \u{1F7E2} \u4F4E\u4F18\u5148\u7EA7", placeholder: "\u4F4E\u4F18\u5148\u7EA7\u4EFB\u52A1..." }
];
var TaskQuickAddComponent = class _TaskQuickAddComponent extends BaseComponent {
  constructor(app, settings, onSettingsChange) {
    super(app, settings);
    this.onSettingsChange = onSettingsChange;
  }
  get id() {
    return "task-quickadd";
  }
  async render(container) {
    const td = this.settings.taskDefaults;
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const tqTitleWrap = header.createDiv("dashboard-module-title-wrap");
    tqTitleWrap.createEl("span", { text: "\u{1F4DD}", cls: "dashboard-module-icon" });
    tqTitleWrap.createEl("span", { text: "\u5FEB\u901F\u6DFB\u52A0\u4EFB\u52A1", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "\u914D\u7F6E\u9ED8\u8BA4\u5185\u5BB9" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.openTaskDefaultsModal());
    const body = mod.createDiv("dashboard-module-body");
    body.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    for (const cfg of TASK_SECTIONS) {
      const row = body.createDiv("dashboard-task-row");
      row.createEl("span", { text: cfg.label, cls: "dashboard-task-label" });
      const input = row.createEl("input", { cls: "dashboard-task-input", placeholder: cfg.placeholder });
      input.value = td[cfg.key] || "";
      const addBtn = row.createEl("button", { text: "+", cls: "dashboard-task-add-btn", title: "\u6DFB\u52A0\u5230\u65E5\u62A5" });
      const doAdd = async () => {
        const val = input.value.trim();
        if (!val)
          return;
        addBtn.disabled = true;
        addBtn.textContent = "...";
        try {
          await this.appendBulletToReport(cfg.section, val);
          input.value = td[cfg.key] || "";
        } catch (e) {
          new import_obsidian17.Notice(`\u6DFB\u52A0\u5931\u8D25: ${e.message}`);
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = "+";
        }
      };
      addBtn.addEventListener("click", doAdd);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter")
          doAdd();
      });
    }
    const ongoingRow = body.createDiv("dashboard-task-row");
    ongoingRow.createEl("span", { text: "\u{1F504} \u6301\u7EED\u4EFB\u52A1", cls: "dashboard-task-label" });
    const ongoingInput = ongoingRow.createEl("input", { cls: "dashboard-task-input", placeholder: "\u6301\u7EED\u4EFB\u52A1..." });
    ongoingInput.value = td.ongoing || "";
    const pctInput = ongoingRow.createEl("input", { cls: "dashboard-task-pct-input", placeholder: "%" });
    pctInput.value = td.ongoingPercent || "";
    pctInput.style.cssText = "width:48px;flex-shrink:0;";
    const ongoingBtn = ongoingRow.createEl("button", { text: "+", cls: "dashboard-task-add-btn", title: "\u6DFB\u52A0\u5230\u65E5\u62A5" });
    const doAddOngoing = async () => {
      const val = ongoingInput.value.trim();
      if (!val)
        return;
      const pct = pctInput.value.trim();
      const text = pct ? `${val} (${pct}%)` : val;
      ongoingBtn.disabled = true;
      ongoingBtn.textContent = "...";
      try {
        await this.appendBulletToReport("### \u{1F504} \u6301\u7EED\u4EFB\u52A1", text);
        ongoingInput.value = td.ongoing || "";
        pctInput.value = td.ongoingPercent || "";
      } catch (e) {
        new import_obsidian17.Notice(`\u6DFB\u52A0\u5931\u8D25: ${e.message}`);
      } finally {
        ongoingBtn.disabled = false;
        ongoingBtn.textContent = "+";
      }
    };
    ongoingBtn.addEventListener("click", doAddOngoing);
    ongoingInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        doAddOngoing();
    });
    pctInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        doAddOngoing();
    });
  }
  openTaskDefaultsModal() {
    const td = this.settings.taskDefaults;
    const saveSettings = this.onSettingsChange;
    const currentSettings = this.settings;
    new class extends import_obsidian17.Modal {
      onOpen() {
        const { contentEl } = this;
        contentEl.addClass("dashboard-task-defaults-modal");
        contentEl.createEl("h3", { text: "\u5FEB\u901F\u4EFB\u52A1\u9ED8\u8BA4\u503C" });
        const addRow = (label, value, placeholder, onChange) => {
          const row = contentEl.createDiv("dashboard-task-modal-row");
          row.createEl("label", { text: label, cls: "dashboard-task-modal-label" });
          const input = row.createEl("input", { cls: "dashboard-task-modal-input", placeholder });
          input.value = value;
          input.addEventListener("input", () => onChange(input.value));
        };
        addRow("\u{1F534} \u7D27\u6025", td.urgent, "\u9ED8\u8BA4\u7D27\u6025\u4EFB\u52A1\u5185\u5BB9...", (v) => {
          td.urgent = v;
        });
        addRow("\u{1F7E1} \u4E00\u822C", td.normal, "\u9ED8\u8BA4\u4E00\u822C\u4EFB\u52A1\u5185\u5BB9...", (v) => {
          td.normal = v;
        });
        addRow("\u{1F7E2} \u4F4E\u4F18\u5148\u7EA7", td.low, "\u9ED8\u8BA4\u4F4E\u4F18\u5148\u7EA7\u4EFB\u52A1\u5185\u5BB9...", (v) => {
          td.low = v;
        });
        addRow("\u{1F504} \u6301\u7EED\u4EFB\u52A1", td.ongoing, "\u9ED8\u8BA4\u6301\u7EED\u4EFB\u52A1\u540D\u79F0...", (v) => {
          td.ongoing = v;
        });
        addRow("\u{1F4CA} \u6301\u7EED\u4EFB\u52A1\u8FDB\u5EA6 %", td.ongoingPercent, "\u9ED8\u8BA4\u8FDB\u5EA6\u767E\u5206\u6BD4...", (v) => {
          td.ongoingPercent = v;
        });
        const btns = contentEl.createDiv("dashboard-task-modal-btns");
        btns.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
        btns.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" }).addEventListener("click", async () => {
          await saveSettings(currentSettings);
          this.close();
        });
      }
      onClose() {
        this.contentEl.empty();
      }
    }(this.app).open();
  }
  async appendBulletToReport(sectionMarker, text) {
    const cfg = this.settings.reportConfigs.daily;
    const date = /* @__PURE__ */ new Date();
    const relPath = this.formatDatePath(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    const path = dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
    const file = this.app.vault.getAbstractFileByPath(path);
    let content = "";
    if (file instanceof import_obsidian17.TFile) {
      content = await this.app.vault.read(file);
    } else {
      content = _TaskQuickAddComponent.getDefaultReportTemplate();
      const segs = path.split("/");
      let acc = "";
      for (let i = 0; i < segs.length - 1; i++) {
        acc += (acc ? "/" : "") + segs[i];
        if (!this.app.vault.getAbstractFileByPath(acc)) {
          try {
            await this.app.vault.createFolder(acc);
          } catch (e) {
          }
        }
      }
    }
    const lines = content.split("\n");
    const bullet = `- ${text}`;
    let sectionIdx = -1, nextHeadingIdx = lines.length;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === sectionMarker) {
        sectionIdx = i;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim().startsWith("## ") || lines[j].trim().startsWith("### ")) {
            nextHeadingIdx = j;
            break;
          }
        }
        break;
      }
    }
    if (sectionIdx === -1) {
      if (lines.length > 0 && lines[lines.length - 1] !== "")
        lines.push("");
      lines.push(sectionMarker, "", bullet, "");
    } else {
      if (nextHeadingIdx > 0 && lines[nextHeadingIdx - 1] !== "")
        lines.splice(nextHeadingIdx, 0, "");
      let insertAt = sectionIdx + 1;
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() === "")
        insertAt++;
      while (insertAt < nextHeadingIdx && lines[insertAt].trim() !== "")
        insertAt++;
      if (insertAt < lines.length && lines[insertAt] !== "")
        lines.splice(insertAt, 0, "");
      lines.splice(insertAt, 0, bullet);
    }
    const newContent = lines.join("\n");
    if (file instanceof import_obsidian17.TFile) {
      await this.app.vault.modify(file, newContent);
    } else {
      await this.app.vault.create(path, newContent);
    }
  }
  formatDatePath(date, format) {
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1);
    const d = String(date.getDate());
    const temp = new Date(date.getTime());
    temp.setHours(0, 0, 0, 0);
    temp.setDate(temp.getDate() + 3 - (temp.getDay() + 6) % 7);
    const week1 = new Date(temp.getFullYear(), 0, 4);
    const w = String(1 + Math.round(((temp.getTime() - week1.getTime()) / 864e5 - 3 + (week1.getDay() + 6) % 7) / 7));
    const Q = String(Math.floor(date.getMonth() / 3) + 1);
    let result = format.replace(/\[([^\]]+)\]/g, "$1");
    result = result.replace(/YYYY/g, y).replace(/YY/g, y.slice(2)).replace(/MM/g, m.padStart(2, "0")).replace(/DD/g, d.padStart(2, "0")).replace(/ww/g, w.padStart(2, "0")).replace(/M/g, m).replace(/D/g, d).replace(/w/g, w).replace(/Q/g, Q);
    return result;
  }
  static getDefaultReportTemplate() {
    return `> **\u4F18\u5148\u7EA7\u56FE\u4F8B**\uFF1A<span style="color:#e53e3e">\u{1F534} \u7D27\u6025/\u91CD\u8981\u2014\u5FC5\u987B\u5F53\u5929\u5B8C\u6210</span> \uFF5C <span style="color:#d69e2e">\u{1F7E1} \u4E00\u822C\u2014\u5C3D\u91CF\u5B8C\u6210</span> \uFF5C <span style="color:#38a169">\u{1F7E2} \u4F4E\u4F18\u5148\u7EA7\u2014\u6709\u7A7A\u518D\u505A</span> \uFF5C <span style="color:#3182ce">\u{1F535} \u5907\u6CE8/\u4FE1\u606F</span>

## \u4ECA\u65E5\u4EFB\u52A1

### \u{1F534} \u7D27\u6025/\u91CD\u8981

-
-

### \u{1F7E1} \u4E00\u822C

-
-

### \u{1F7E2} \u4F4E\u4F18\u5148\u7EA7

-
-

## \u4ECA\u65E5\u5B8C\u6210

-

## \u9047\u5230\u7684\u95EE\u9898

-

## \u660E\u65E5\u8BA1\u5212

-

## \u5907\u6CE8

-
`;
  }
};

// src/ui/components/PluginManageComponent.ts
var import_obsidian18 = require("obsidian");
var PluginManageComponent = class extends BaseComponent {
  constructor(app, settings) {
    super(app, settings);
    this.pluginService = new PluginManageService(app);
  }
  get id() {
    return "plugin-manage";
  }
  async render(container) {
    const mod = container.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    const pmTitleWrap = header.createDiv("dashboard-module-title-wrap");
    pmTitleWrap.createEl("span", { text: "\u{1F50C}", cls: "dashboard-module-icon" });
    pmTitleWrap.createEl("span", { text: "\u63D2\u4EF6\u7BA1\u7406", cls: "dashboard-module-title" });
    const gearBtn = header.createEl("button", { cls: "dashboard-heatmap-config-btn", title: "Obsidian \u63D2\u4EF6\u8BBE\u7F6E" });
    gearBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    gearBtn.addEventListener("click", () => this.pluginService.openPluginSettings());
    const body = mod.createDiv("dashboard-module-body");
    const plugins = this.pluginService.getInstalledPlugins();
    if (plugins.length === 0) {
      body.createDiv({ text: "\u672A\u68C0\u6D4B\u5230\u5DF2\u5B89\u88C5\u63D2\u4EF6", cls: "dashboard-empty" });
    } else {
      const table = body.createEl("table", { cls: "dashboard-plugin-table" });
      const hr = table.createEl("thead").createEl("tr");
      for (const h of ["\u63D2\u4EF6\u540D\u79F0", "\u8BF4\u660E", "\u7248\u672C", "\u542F\u7528", "\u8BBE\u7F6E"])
        hr.createEl("th", { text: h });
      const tbody = table.createEl("tbody");
      for (const p of plugins) {
        const tr = tbody.createEl("tr");
        const nameTd = tr.createEl("td");
        if (p.hasSettings) {
          const link = nameTd.createEl("a", { text: p.name, cls: "dashboard-plugin-link" });
          link.addEventListener("click", () => this.pluginService.openSpecificPluginSettings(p.id));
        } else {
          nameTd.textContent = p.name;
        }
        const descTd = tr.createEl("td", { cls: "dashboard-plugin-desc" });
        descTd.textContent = p.description || "\u2014";
        tr.createEl("td", { text: p.version, cls: "dashboard-plugin-version" });
        const toggleTd = tr.createEl("td");
        const toggle = toggleTd.createEl("label", { cls: "dashboard-toggle" });
        const cb = toggle.createEl("input");
        cb.type = "checkbox";
        cb.checked = p.enabled;
        toggle.createEl("span", { cls: "dashboard-toggle-slider" });
        cb.addEventListener("change", async () => {
          cb.disabled = true;
          try {
            await this.pluginService.togglePlugin(p.id, cb.checked);
            new import_obsidian18.Notice(`${p.name} \u5DF2${cb.checked ? "\u542F\u7528" : "\u7981\u7528"}`);
          } catch (e) {
            new import_obsidian18.Notice(`\u64CD\u4F5C\u5931\u8D25: ${e.message}`);
            cb.checked = !cb.checked;
          } finally {
            cb.disabled = false;
          }
        });
        const settingsTd = tr.createEl("td");
        const settingsBtn = settingsTd.createEl("button", { cls: "dashboard-icon-btn", title: `${p.name} \u8BBE\u7F6E` });
        settingsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
        settingsBtn.addEventListener("click", () => {
          this.pluginService.openSpecificPluginSettings(p.id);
        });
      }
    }
  }
};

// src/ui/DashboardView.ts
var DASHBOARD_VIEW_TYPE = "yy-obsidian-dashboard";
var DashboardView = class extends import_obsidian19.ItemView {
  constructor(leaf, settings, onSettingsChange) {
    super(leaf);
    // Component map by ID (for moduleOrder lookup)
    this.components = {};
    // State
    this.rendering = false;
    this.needsRerender = false;
    this.lastRenderTime = 0;
    this.autoRefreshTimer = null;
    this.visibilityTimer = null;
    this.gitRefreshTimer = null;
    this.AUTO_REFRESH_COOLDOWN = 5 * 60 * 1e3;
    this.VISIBILITY_CHECK_INTERVAL = 30 * 60 * 1e3;
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
    this.fileService = new FileService(this.app);
    this.logService = new LogService(this.app);
    this.llmService = new LLMService(settings, settings.tokenUsageDataPath);
    this.pluginService = new PluginManageService(this.app);
    this.heatmapService = new HeatmapService(this.app, settings.heatmapDataPath);
    this.gitService = new GitService(this.app);
    this.remotelySaveService = new RemotelySaveService();
    this.llmService.setApp(this.app);
    this.headerComponent = new HeaderComponent(
      this.app,
      settings,
      this.llmService,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      },
      () => this.render()
    );
    this.searchComponent = new SearchComponent(this.app, settings);
    this.fileStatsComponent = new FileStatsComponent(
      this.app,
      settings,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.heatmapComponent = new HeatmapComponent(
      this.app,
      settings,
      this.heatmapService,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.llmCommandComponent = new LLMCommandComponent(
      this.app,
      settings,
      this.llmService,
      () => this.headerComponent.refreshTokenBar()
    );
    this.gitSyncComponent = new GitSyncComponent(
      this.app,
      settings,
      this.gitService,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      },
      () => this.gitSyncComponent.setupAutoPush()
    );
    this.remotelySaveComponent = new RemotelySaveComponent(this.app, settings);
    this.taskQuickAddComponent = new TaskQuickAddComponent(
      this.app,
      settings,
      async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }
    );
    this.pluginManageComponent = new PluginManageComponent(this.app, settings);
    this.components = {
      "header": this.headerComponent,
      "search": this.searchComponent,
      "file-stats": this.fileStatsComponent,
      "heatmap": this.heatmapComponent,
      "llm-command": this.llmCommandComponent,
      "git-sync": this.gitSyncComponent,
      "remotely-save": this.remotelySaveComponent,
      "task-quickadd": this.taskQuickAddComponent,
      "plugin-manage": this.pluginManageComponent
    };
  }
  getViewType() {
    return DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return this.settings.dashboardTitle || "Dashboard";
  }
  getIcon() {
    return "layout-dashboard";
  }
  updateSettings(settings) {
    this.settings = settings;
    this.llmService.updateSettings(settings);
    for (const comp of Object.values(this.components)) {
      comp.updateSettings(settings);
    }
    this.updateTabTitle();
    this.render();
  }
  updateTabTitle() {
    var _a;
    const title = this.settings.dashboardTitle || "Dashboard";
    const viewHeaderTitle = this.containerEl.querySelector(".view-header-title");
    if (viewHeaderTitle)
      viewHeaderTitle.textContent = title;
    const leafAny = this.leaf;
    const tabTitleEl = (_a = leafAny.tabHeaderEl) == null ? void 0 : _a.querySelector(".workspace-tab-header-inner-title");
    if (tabTitleEl) {
      tabTitleEl.textContent = title;
      return;
    }
    const leafContent = this.containerEl.closest(".workspace-leaf");
    if (!leafContent)
      return;
    const workspaceTabs = leafContent.closest(".workspace-tabs");
    if (!workspaceTabs)
      return;
    const tabContainer = workspaceTabs.querySelector(":scope > .workspace-tab-container");
    const leaves = tabContainer ? Array.from(tabContainer.querySelectorAll(":scope > .workspace-leaf")) : [];
    const leafIndex = leaves.indexOf(leafContent);
    if (leafIndex < 0)
      return;
    const headerInner = workspaceTabs.querySelector(
      ":scope > .workspace-tab-header-container > .workspace-tab-header-container-inner"
    );
    const tabHeaders = headerInner ? Array.from(headerInner.querySelectorAll(":scope > .workspace-tab-header")) : [];
    const targetHeader = tabHeaders[leafIndex];
    if (targetHeader) {
      const innerTitle = targetHeader.querySelector(".workspace-tab-header-inner-title");
      if (innerTitle)
        innerTitle.textContent = title;
    }
  }
  async onOpen() {
    this.heatmapService.startTracking();
    this.onVaultChange = () => {
      if (this.autoRefreshTimer)
        clearTimeout(this.autoRefreshTimer);
      this.autoRefreshTimer = setTimeout(async () => {
        const statsContainer = document.getElementById("dashboard-file-stats-container");
        if (statsContainer)
          await this.fileStatsComponent.renderFileStats(statsContainer);
        const recentContainer = document.getElementById("dashboard-recent-container");
        if (recentContainer)
          this.fileStatsComponent.renderRecentFiles(recentContainer);
      }, 800);
      if (this.settings.gitEnabled) {
        if (this.gitRefreshTimer)
          clearTimeout(this.gitRefreshTimer);
        this.gitRefreshTimer = setTimeout(() => {
          this.gitSyncComponent.update();
        }, 3e3);
      }
      this.gitSyncComponent.triggerAutoPushDebounce();
    };
    this.app.vault.on("modify", this.onVaultChange);
    this.app.vault.on("create", this.onVaultChange);
    this.app.vault.on("delete", this.onVaultChange);
    this.app.vault.on("rename", this.onVaultChange);
    this.gitSyncComponent.setupAutoPush();
    this.gitSyncComponent.startPolling();
    this.onActiveLeafChange = (leaf) => {
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
    this.visibilityTimer = setInterval(() => {
      var _a;
      if (((_a = this.app.workspace.activeLeaf) == null ? void 0 : _a.view) === this) {
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
    if (this.autoRefreshTimer)
      clearTimeout(this.autoRefreshTimer);
    if (this.gitRefreshTimer)
      clearTimeout(this.gitRefreshTimer);
    if (this.visibilityTimer)
      clearInterval(this.visibilityTimer);
    this.gitSyncComponent.destroy();
  }
  async render() {
    var _a;
    if (this.rendering) {
      this.needsRerender = true;
      return;
    }
    this.rendering = true;
    this.needsRerender = false;
    try {
      document.body.querySelectorAll(".dashboard-heatmap-tip, .dashboard-popover").forEach((el) => el.remove());
      this.lastRenderTime = Date.now();
      const container = this.containerEl.children[1];
      const oldScroll = container.querySelector(".dashboard-scroll");
      const scrollTop = (_a = oldScroll == null ? void 0 : oldScroll.scrollTop) != null ? _a : 0;
      const containerScrollTop = container.scrollTop;
      const offscreen = document.createElement("div");
      offscreen.addClass("dashboard-root");
      await this.headerComponent.render(offscreen);
      await this.searchComponent.render(offscreen);
      const scroll = offscreen.createDiv("dashboard-scroll");
      const order = this.settings.moduleOrder || [];
      for (const moduleId of order) {
        const comp = this.components[moduleId];
        if (comp) {
          await comp.render(scroll);
        }
      }
      const moduleEls = scroll.querySelectorAll(".dashboard-module");
      moduleEls.forEach((modEl, index) => {
        const moduleId = order[index];
        if (!moduleId)
          return;
        modEl.setAttribute("data-module-id", moduleId);
        const header = modEl.querySelector(".dashboard-module-header");
        if (!header)
          return;
        const handle = document.createElement("span");
        handle.className = "dashboard-module-drag-handle";
        handle.innerHTML = "\u22EE\u22EE";
        handle.setAttribute("draggable", "true");
        handle.setAttribute("title", "\u62D6\u62FD\u6392\u5E8F");
        handle.addEventListener("dragstart", (e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", moduleId);
          modEl.classList.add("dragging");
        });
        handle.addEventListener("dragend", () => {
          modEl.classList.remove("dragging");
          scroll.querySelectorAll(".dashboard-module").forEach((el) => el.classList.remove("drag-over"));
        });
        header.prepend(handle);
        modEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const dragging = scroll.querySelector(".dashboard-module.dragging");
          if (!dragging || dragging === modEl)
            return;
          modEl.classList.add("drag-over");
        });
        modEl.addEventListener("dragleave", (e) => {
          if (!modEl.contains(e.relatedTarget)) {
            modEl.classList.remove("drag-over");
          }
        });
        modEl.addEventListener("drop", async (e) => {
          e.preventDefault();
          modEl.classList.remove("drag-over");
          const fromId = e.dataTransfer.getData("text/plain");
          if (!fromId || fromId === moduleId)
            return;
          const newOrder = [...this.settings.moduleOrder];
          const fromIdx = newOrder.indexOf(fromId);
          const toIdx = newOrder.indexOf(moduleId);
          if (fromIdx === -1 || toIdx === -1)
            return;
          newOrder.splice(fromIdx, 1);
          newOrder.splice(toIdx, 0, fromId);
          this.settings.moduleOrder = newOrder;
          await this.onSettingsChange(this.settings);
        });
      });
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
};

// src/main.ts
var LLMWikiDashboardPlugin = class extends import_obsidian20.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this.settings, this.saveSettings.bind(this))
    );
    this.addRibbonIcon("layout-dashboard", "\u6253\u5F00 Dashboard", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-dashboard",
      name: "\u6253\u5F00 Dashboard",
      callback: () => this.activateView()
    });
    this.addSettingTab(new DashboardSettingTab(this.app, this));
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
  }
  async activateView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getLeaf(true);
    await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    workspace.revealLeaf(leaf);
  }
  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    if (saved == null ? void 0 : saved.reportConfigs) {
      this.settings.reportConfigs = Object.assign({}, DEFAULT_SETTINGS.reportConfigs);
      for (const key of Object.keys(this.settings.reportConfigs)) {
        if (saved.reportConfigs[key]) {
          Object.assign(this.settings.reportConfigs[key], saved.reportConfigs[key]);
        }
      }
    }
    if (saved == null ? void 0 : saved.taskDefaults) {
      this.settings.taskDefaults = Object.assign({}, DEFAULT_SETTINGS.taskDefaults, saved.taskDefaults);
    }
  }
  async saveSettings(settings) {
    if (settings)
      this.settings = settings;
    await this.saveData(this.settings);
    this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE).forEach((leaf) => {
      const view = leaf.view;
      if (view instanceof DashboardView) {
        view.updateSettings(this.settings);
      }
    });
  }
};
var DashboardSettingTab = class extends import_obsidian20.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Dashboard \u8BBE\u7F6E" });
    const setting1 = new import_obsidian20.Setting(containerEl).setName("\u6807\u7B7E\u9875\u6807\u9898").setDesc("\u81EA\u5B9A\u4E49 Dashboard \u6807\u7B7E\u9875\u663E\u793A\u7684\u540D\u79F0\uFF0C\u53EF\u968F\u65F6\u4FEE\u6539").addText(
      (text) => text.setPlaceholder("Dashboard").setValue(this.plugin.settings.dashboardTitle).onChange(async (value) => {
        this.plugin.settings.dashboardTitle = value.trim() || "Dashboard";
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting1, "Dashboard");
    const setting2 = new import_obsidian20.Setting(containerEl).setName("\u6807\u7B7E\u9875\u63CF\u8FF0").setDesc("\u663E\u793A\u5728\u6807\u7B7E\u9875\u6807\u9898\u4E0B\u65B9\u7684\u63CF\u8FF0\u6587\u5B57").addText(
      (text) => text.setPlaceholder("\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F").setValue(this.plugin.settings.dashboardDesc).onChange(async (value) => {
        this.plugin.settings.dashboardDesc = value.trim();
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting2, "\u79B9\u601D\u5929\u4E0B\u6709\u6EBA\u8005\uFF0C\u7531\u5DF1\u6EBA\u4E4B\u4E5F");
    const setting3 = new import_obsidian20.Setting(containerEl).setName("API Base URL").setDesc("OpenAI Compatible \u63A5\u53E3\u5730\u5740").addText(
      (text) => text.setPlaceholder("https://api.openai.com/v1").setValue(this.plugin.settings.apiBaseUrl).onChange(async (value) => {
        this.plugin.settings.apiBaseUrl = value;
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting3, "https://api.openai.com/v1");
    new import_obsidian20.Setting(containerEl).setName("API Key").setDesc("\u4F60\u7684 API \u5BC6\u94A5").addText((text) => {
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value;
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
    const setting4 = new import_obsidian20.Setting(containerEl).setName("\u6A21\u578B\u540D\u79F0").addText(
      (text) => text.setPlaceholder("gpt-4o").setValue(this.plugin.settings.modelName).onChange(async (value) => {
        this.plugin.settings.modelName = value;
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting4, "gpt-4o");
    new import_obsidian20.Setting(containerEl).setName("Temperature").addSlider(
      (slider) => slider.setLimits(0, 2, 0.1).setValue(this.plugin.settings.temperature).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.temperature = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian20.Setting(containerEl).setName("Max Tokens").addText(
      (text) => text.setValue(String(this.plugin.settings.maxTokens)).onChange(async (value) => {
        const n = parseInt(value);
        if (!isNaN(n)) {
          this.plugin.settings.maxTokens = n;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian20.Setting(containerEl).setName("\u7528\u91CF\u63A5\u53E3\u5730\u5740").setDesc("\u9009\u586B\u3002\u586B\u5199\u540E\u4F18\u5148\u4F7F\u7528\u63A5\u53E3\u6570\u636E\uFF0C\u5426\u5219\u7528\u672C\u5730\u7EDF\u8BA1").addText(
      (text) => text.setPlaceholder("https://...").setValue(this.plugin.settings.tokenUsageApiUrl).onChange(async (value) => {
        this.plugin.settings.tokenUsageApiUrl = value;
        await this.plugin.saveSettings();
      })
    );
    const setting5 = new import_obsidian20.Setting(containerEl).setName("\u4F59\u989D\u63A5\u53E3\u5730\u5740").setDesc("\u9009\u586B\u3002\u5982 DeepSeek: https://api.deepseek.com/user/balance").addText(
      (text) => text.setPlaceholder("https://...").setValue(this.plugin.settings.tokenBalanceApiUrl).onChange(async (value) => {
        this.plugin.settings.tokenBalanceApiUrl = value;
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting5, "https://api.deepseek.com/user/balance");
    new import_obsidian20.Setting(containerEl).setName("\u7EDF\u8BA1\u6587\u4EF6\u5939").setDesc("\u9017\u53F7\u5206\u9694\u7684\u6587\u4EF6\u5939\u8DEF\u5F84\u5217\u8868\uFF0C\u5982 raw, wiki, raw/\u5B50\u76EE\u5F55").addText(
      (text) => text.setValue(this.plugin.settings.trackedFolders.join(", ")).onChange(async (value) => {
        this.plugin.settings.trackedFolders = value.split(",").map((s) => s.trim()).filter(Boolean);
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u62A5\u8868\u914D\u7F6E" });
    const reportLabels = {
      daily: "\u65E5\u62A5",
      weekly: "\u5468\u62A5",
      monthly: "\u6708\u62A5",
      quarterly: "\u5B63\u62A5",
      yearly: "\u5E74\u62A5"
    };
    for (const type of Object.keys(reportLabels)) {
      const cfg = this.plugin.settings.reportConfigs[type];
      containerEl.createEl("h4", { text: reportLabels[type] });
      new import_obsidian20.Setting(containerEl).setName("\u542F\u7528").addToggle(
        (toggle) => toggle.setValue(cfg.enabled).onChange(async (value) => {
          cfg.enabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian20.Setting(containerEl).setName("\u65B0\u5EFA\u65F6\u5F39\u7A97\u786E\u8BA4").setDesc("\u70B9\u51FB\u6CA1\u6709\u5BF9\u5E94\u62A5\u544A\u7684\u65E5\u671F\u65F6\uFF0C\u662F\u5426\u5148\u5F39\u7A97\u786E\u8BA4\u518D\u65B0\u5EFA").addToggle(
        (toggle) => toggle.setValue(cfg.confirmBeforeCreate).onChange(async (value) => {
          cfg.confirmBeforeCreate = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian20.Setting(containerEl).setName("\u5B58\u653E\u76EE\u5F55").setDesc("\u6587\u4EF6\u5B58\u50A8\u7684\u6839\u76EE\u5F55").addText(
        (text) => text.setValue(cfg.directory).onChange(async (value) => {
          cfg.directory = value.trim();
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian20.Setting(containerEl).setName("\u6587\u4EF6\u8DEF\u5F84\u683C\u5F0F").setDesc(`\u652F\u6301 YYYY/YY/MM/M/DD/D \u7B49 moment.js \u683C\u5F0F\u4EE4\u724C\u3002\u5982 YYYY/MM/YYYY-MM-DD`).addText(
        (text) => text.setValue(cfg.filenameFormat).onChange(async (value) => {
          cfg.filenameFormat = value.trim();
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian20.Setting(containerEl).setName("\u6A21\u677F\u8DEF\u5F84").setDesc("vault \u4E2D\u7684\u6A21\u677F\u6587\u4EF6\u8DEF\u5F84\uFF08\u4E0D\u542B .md \u540E\u7F00\uFF09\uFF0C\u7559\u7A7A\u5219\u4E0D\u4F7F\u7528\u6A21\u677F").addText(
        (text) => text.setValue(cfg.templatePath).onChange(async (value) => {
          cfg.templatePath = value.trim();
          await this.plugin.saveSettings();
        })
      );
    }
    containerEl.createEl("h3", { text: "Git \u540C\u6B65 (GitHub)" });
    new import_obsidian20.Setting(containerEl).setName("\u542F\u7528 Git \u540C\u6B65").setDesc("\u5F00\u542F\u540E\u53EF\u5728 Dashboard \u4E2D\u8FDB\u884C Push/Pull \u64CD\u4F5C").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.gitEnabled).onChange(async (value) => {
        this.plugin.settings.gitEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    const setting6 = new import_obsidian20.Setting(containerEl).setName("\u4ED3\u5E93\u5730\u5740").setDesc("GitHub \u4ED3\u5E93 HTTPS \u5730\u5740\uFF0C\u5982 https://github.com/username/repo.git").addText(
      (text) => text.setPlaceholder("https://github.com/username/repo.git").setValue(this.plugin.settings.gitRemoteURL).onChange(async (value) => {
        this.plugin.settings.gitRemoteURL = value.trim();
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting6, "https://github.com/username/repo.git");
    const setting7 = new import_obsidian20.Setting(containerEl).setName("\u8FDC\u7A0B\u540D\u79F0").setDesc("Git remote \u540D\u79F0\uFF0C\u9ED8\u8BA4 origin").addText(
      (text) => text.setPlaceholder("origin").setValue(this.plugin.settings.gitRemoteName).onChange(async (value) => {
        this.plugin.settings.gitRemoteName = value.trim() || "origin";
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting7, "origin");
    const setting8 = new import_obsidian20.Setting(containerEl).setName("\u5206\u652F\u540D").setDesc("\u9ED8\u8BA4\u5206\u652F\u540D\uFF0C\u5982 main \u6216 master").addText(
      (text) => text.setPlaceholder("main").setValue(this.plugin.settings.gitBranchName).onChange(async (value) => {
        this.plugin.settings.gitBranchName = value.trim() || "main";
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting8, "main");
    const setting9 = new import_obsidian20.Setting(containerEl).setName("GitHub \u7528\u6237\u540D").setDesc("GitHub \u767B\u5F55\u7528\u6237\u540D\u6216\u90AE\u7BB1").addText(
      (text) => text.setPlaceholder("your-username").setValue(this.plugin.settings.gitUsername).onChange(async (value) => {
        this.plugin.settings.gitUsername = value.trim();
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting9, "your-username");
    new import_obsidian20.Setting(containerEl).setName("GitHub Token").setDesc("GitHub \u79C1\u4EBA\u4EE4\u724C\uFF08https://github.com/settings/tokens\uFF09\uFF0C\u5B58\u50A8\u4E8E\u672C\u5730 data.json \u4E2D").addText((text) => {
      text.setPlaceholder("your-token").setValue(this.plugin.settings.gitPassword).onChange(async (value) => {
        this.plugin.settings.gitPassword = value.trim();
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
    new import_obsidian20.Setting(containerEl).setName("\u81EA\u52A8 Push").setDesc("\u5F00\u542F\u540E\u6309\u8BBE\u5B9A\u7684\u65F6\u95F4\u95F4\u9694\u81EA\u52A8 push").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.gitAutoPushEnabled).onChange(async (value) => {
        this.plugin.settings.gitAutoPushEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    const setting10 = new import_obsidian20.Setting(containerEl).setName("\u81EA\u52A8 Push \u95F4\u9694\uFF08\u5206\u949F\uFF09").setDesc("\u8BBE\u4E3A 0 \u8868\u793A\u6BCF\u6B21 vault \u53D8\u66F4\u540E\u81EA\u52A8 push").addText(
      (text) => text.setPlaceholder("30").setValue(String(this.plugin.settings.gitAutoPushInterval)).onChange(async (value) => {
        const n = parseInt(value);
        if (!isNaN(n) && n >= 0) {
          this.plugin.settings.gitAutoPushInterval = n;
          await this.plugin.saveSettings();
        }
      })
    );
    this.addExampleHint(setting10, "30");
    const setting11 = new import_obsidian20.Setting(containerEl).setName("Commit \u6D88\u606F\u6A21\u677F").setDesc("\u652F\u6301 {{date}} \u548C {{time}} \u5360\u4F4D\u7B26").addText(
      (text) => text.setPlaceholder("auto: {{date}} {{time}}").setValue(this.plugin.settings.gitCommitTemplate).onChange(async (value) => {
        this.plugin.settings.gitCommitTemplate = value.trim();
        await this.plugin.saveSettings();
      })
    );
    this.addExampleHint(setting11, "auto: {{date}} {{time}}");
    this.addCommitPreview(setting11);
  }
  addExampleHint(setting, example) {
    const input = setting.controlEl.querySelector("input");
    if (!input)
      return;
    const hint = createSpan({ cls: "dashboard-example-hint", text: "\u{1F4CB}", attr: { "data-tooltip": example } });
    hint.addEventListener("click", () => {
      input.value = example;
      input.dispatchEvent(new Event("input"));
    });
    setting.controlEl.appendChild(hint);
  }
  addCommitPreview(setting) {
    const input = setting.controlEl.querySelector("input");
    if (!input)
      return;
    const preview = createSpan({ cls: "dashboard-format-preview" });
    const updatePreview = () => {
      const now = /* @__PURE__ */ new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const time = now.toTimeString().slice(0, 8);
      const val = input.value || input.placeholder;
      const example = val.replace(/\{\{date\}\}/g, date).replace(/\{\{time\}\}/g, time);
      preview.textContent = `\u793A\u4F8B: ${example}`;
    };
    updatePreview();
    input.addEventListener("input", updatePreview);
    setting.descEl.appendChild(preview);
  }
};
