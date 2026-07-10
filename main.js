var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
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
var import_obsidian8 = require("obsidian");

// src/types.ts
var defaultReportConfigs = {
  daily: { enabled: true, confirmBeforeCreate: true, directory: "raw/dayReport", filenameFormat: "YYYY/MM/YYYY-MM-DD", templatePath: "raw/dayReport/template" },
  weekly: { enabled: false, confirmBeforeCreate: true, directory: "raw/weekReport", filenameFormat: "YYYY/MM/YYYY-[W]ww", templatePath: "raw/weekReport/template" },
  monthly: { enabled: false, confirmBeforeCreate: true, directory: "raw/monthReport", filenameFormat: "YYYY/MM/YYYY-MM", templatePath: "raw/monthReport/template" },
  quarterly: { enabled: false, confirmBeforeCreate: true, directory: "raw/quarterReport", filenameFormat: "YYYY/MM/YYYY-[Q]Q", templatePath: "raw/quarterReport/template" },
  yearly: { enabled: false, confirmBeforeCreate: true, directory: "raw/yearReport", filenameFormat: "YYYY/YYYY", templatePath: "raw/yearReport/template" }
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
  reportConfigs: defaultReportConfigs
};

// src/ui/DashboardView.ts
var import_obsidian7 = require("obsidian");

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
  async toggleFolderInExplorer(name) {
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
    const matchKey = findKey(name);
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
  async openLogFolder() {
    const file = this.app.vault.getAbstractFileByPath("wiki/log");
    if (file instanceof import_obsidian2.TFile) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.openFile(file);
    } else {
      this.app.commands.executeCommandById("file-explorer:reveal-active-file");
    }
  }
};

// src/services/LLMService.ts
var import_obsidian3 = require("obsidian");
var LOCAL_STORAGE_KEY = "llm-wiki-dashboard-token-usage";
var LLMService = class {
  constructor(settings) {
    this.settings = settings;
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
    const resp = await (0, import_obsidian3.requestUrl)({
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
    const resp = await (0, import_obsidian3.requestUrl)({
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
    const localUsage = this.getLocalTokenUsage();
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
  getLocalTokenUsage() {
    var _a;
    const store = this.loadLocalStore();
    const today = this.todayStr();
    const monthPrefix = today.slice(0, 7);
    const todayTokens = (_a = store[today]) != null ? _a : 0;
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
      const resp = await (0, import_obsidian3.requestUrl)({
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
      const resp = await (0, import_obsidian3.requestUrl)({
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
    const store = this.loadLocalStore();
    const today = this.todayStr();
    store[today] = ((_a = store[today]) != null ? _a : 0) + tokens;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));
  }
  loadLocalStore() {
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
      var _a2, _b2, _c, _d, _e, _f, _g, _h;
      return {
        id,
        name: (_a2 = manifest.name) != null ? _a2 : id,
        version: (_b2 = manifest.version) != null ? _b2 : "?",
        enabled: isEnabled(id),
        hasSettings: !!(((_d = (_c = plugins.plugins) == null ? void 0 : _c[id]) == null ? void 0 : _d.settingsDisplay) || ((_f = (_e = plugins.plugins) == null ? void 0 : _e[id]) == null ? void 0 : _f.onSettingsTab)),
        description: (_h = (_g = ZH_DESCRIPTIONS[id]) != null ? _g : manifest.description) != null ? _h : ""
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
    var _a, _b, _c, _d;
    (_b = (_a = this.app.setting) == null ? void 0 : _a.open) == null ? void 0 : _b.call(_a);
    (_d = (_c = this.app.setting) == null ? void 0 : _c.openTabById) == null ? void 0 : _d.call(_c, pluginId);
  }
};

// src/services/HeatmapService.ts
var HEATMAP_KEY = "llm-wiki-dashboard-heatmap";
var HeatmapService = class {
  constructor(app) {
    this.app = app;
    this.unregister = null;
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
    const data = this.load();
    const today = this.todayStr();
    data[today] = ((_a = data[today]) != null ? _a : 0) + count;
    localStorage.setItem(HEATMAP_KEY, JSON.stringify(data));
  }
  getData() {
    return this.load();
  }
  getMonthData(year, month) {
    const all = this.load();
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const result = {};
    for (const [date, count] of Object.entries(all)) {
      if (date.startsWith(prefix))
        result[date] = count;
    }
    return result;
  }
  load() {
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

// src/modals/ModelConfigModal.ts
var import_obsidian4 = require("obsidian");
var ModelConfigModal = class extends import_obsidian4.Modal {
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
    contentEl.createEl("h2", { text: "\u6A21\u578B\u914D\u7F6E" });
    this.createTextField(contentEl, "API Base URL", "apiBaseUrl", "text", "https://api.openai.com/v1");
    this.createTextField(contentEl, "API Key", "apiKey", "password", "sk-...");
    this.createModelField(contentEl);
    this.createNumberField(contentEl, "Temperature", "temperature", 0, 2, 0.1);
    this.createNumberField(contentEl, "Max Tokens", "maxTokens", 256, 32768, 1);
    this.createTextField(contentEl, "\u7528\u91CF\u63A5\u53E3\u5730\u5740\uFF08\u9009\u586B\uFF0C\u672A\u586B\u5219\u7528\u672C\u5730\u7EDF\u8BA1\uFF09", "tokenUsageApiUrl", "text", "https://...");
    this.createTextField(contentEl, "\u4F59\u989D\u63A5\u53E3\u5730\u5740\uFF08\u9009\u586B\uFF0C\u5982 DeepSeek: https://api.deepseek.com/user/balance\uFF09", "tokenBalanceApiUrl", "text", "https://...");
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
    const saveBtn = contentEl.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta dashboard-save-btn" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.settings);
      this.close();
      new import_obsidian4.Notice("\u6A21\u578B\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
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
    const resp = await (0, import_obsidian4.requestUrl)({
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
  createTextField(parent, label, key, type, placeholder) {
    var _a;
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const input = row.createEl("input");
    input.type = type;
    input.placeholder = placeholder;
    input.value = String((_a = this.settings[key]) != null ? _a : "");
    input.addEventListener("input", () => {
      this.settings[key] = input.value;
    });
    return row;
  }
  createNumberField(parent, label, key, min, max, step) {
    var _a;
    const row = parent.createDiv("dashboard-field");
    row.createEl("label", { text: label });
    const input = row.createEl("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String((_a = this.settings[key]) != null ? _a : "");
    input.addEventListener("input", () => {
      this.settings[key] = parseFloat(input.value);
    });
    return row;
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modals/FolderConfigModal.ts
var import_obsidian5 = require("obsidian");
var FolderConfigModal = class extends import_obsidian5.Modal {
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
    const saveBtn = contentEl.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta dashboard-save-btn" });
    saveBtn.addEventListener("click", () => {
      this.settings.trackedFolders = [...this.selected];
      this.onSave(this.settings);
      this.close();
      new import_obsidian5.Notice("\u6587\u4EF6\u5939\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/modals/ReportConfigModal.ts
var import_obsidian6 = require("obsidian");
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
var ReportConfigModal = class extends import_obsidian6.Modal {
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
      if (f instanceof import_obsidian6.TFolder)
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
    const saveBtn = actions.createEl("button", { text: "\u4FDD\u5B58", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      this.onSave(this.configs);
      this.close();
      new import_obsidian6.Notice("\u62A5\u8868\u914D\u7F6E\u5DF2\u4FDD\u5B58");
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

// src/ui/DashboardView.ts
var DASHBOARD_VIEW_TYPE = "yy-obsidian-dashboard";
var DashboardView = class extends import_obsidian7.ItemView {
  constructor(leaf, settings, onSettingsChange) {
    super(leaf);
    this.executing = false;
    this.currentHeatmapYear = (/* @__PURE__ */ new Date()).getFullYear();
    this.REPORT_NAMES = {
      daily: "\u65E5\u62A5",
      weekly: "\u5468\u62A5",
      monthly: "\u6708\u62A5",
      quarterly: "\u5B63\u62A5",
      yearly: "\u5E74\u62A5"
    };
    this.settings = settings;
    this.onSettingsChange = onSettingsChange;
    this.fileService = new FileService(this.app);
    this.logService = new LogService(this.app);
    this.llmService = new LLMService(settings);
    this.pluginService = new PluginManageService(this.app);
    this.heatmapService = new HeatmapService(this.app);
  }
  getViewType() {
    return DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return "yyObsidianDashboard";
  }
  getIcon() {
    return "layout-dashboard";
  }
  updateSettings(settings) {
    this.settings = settings;
    this.llmService.updateSettings(settings);
  }
  async onOpen() {
    this.heatmapService.startTracking();
    await this.render();
  }
  async onClose() {
    this.heatmapService.stopTracking();
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("dashboard-root");
    await this.renderHeader(container);
    const scroll = container.createDiv("dashboard-scroll");
    await this.renderModule1(scroll);
    this.renderModule5(scroll);
    await this.renderModule3(scroll);
    this.renderModule4(scroll);
    this.renderModule6(scroll);
    this.renderFooter(scroll);
  }
  // ─── Header ────────────────────────────────────────────────────────────────
  async renderHeader(parent) {
    const header = parent.createDiv("dashboard-header");
    const titleRow = header.createDiv("dashboard-header-title-row");
    titleRow.createEl("h2", { text: "yyObsidianDashboard", cls: "dashboard-title" });
    const actions = titleRow.createDiv("dashboard-header-actions");
    const refreshBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "\u5237\u65B0" });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.render());
    const cfgBtn = actions.createEl("button", { cls: "dashboard-icon-btn", title: "\u6A21\u578B\u914D\u7F6E" });
    cfgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    cfgBtn.addEventListener("click", () => {
      new ModelConfigModal(this.app, this.settings, async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
      }).open();
    });
    header.createDiv({ text: `\u6700\u540E\u5237\u65B0: ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}`, cls: "dashboard-refresh-time" });
    await this.renderHeaderTokenUsage(header);
  }
  async renderHeaderTokenUsage(header) {
    var _a, _b;
    const bar = header.createDiv("dashboard-header-token");
    let today = 0;
    let thisMonth = 0;
    try {
      const store = this.loadLocalTokenStore();
      const todayStr = this.fmtDate(/* @__PURE__ */ new Date());
      const monthPrefix = todayStr.slice(0, 7);
      today = (_a = store[todayStr]) != null ? _a : 0;
      for (const [date, tokens] of Object.entries(store)) {
        if (date.startsWith(monthPrefix))
          thisMonth += tokens;
      }
    } catch (e) {
    }
    let balanceInfo = null;
    if (this.settings.tokenBalanceApiUrl && this.settings.apiKey) {
      try {
        const resp = await (0, import_obsidian7.requestUrl)({
          url: this.settings.tokenBalanceApiUrl,
          method: "GET",
          headers: { Authorization: `Bearer ${this.settings.apiKey}` },
          throw: false
        });
        if (resp.status === 200 && ((_b = resp.json) == null ? void 0 : _b.balance_infos)) {
          balanceInfo = resp.json.balance_infos;
        }
      } catch (e) {
      }
    }
    const makeChip = (label, value) => {
      const chip = bar.createDiv("dashboard-token-chip");
      chip.createEl("span", { text: label, cls: "dashboard-token-chip-label" });
      chip.createEl("span", { text: value, cls: "dashboard-token-chip-value" });
    };
    makeChip("\u4ECA\u65E5", `${today.toLocaleString()} tokens`);
    makeChip("\u672C\u6708", `${thisMonth.toLocaleString()} tokens`);
    if (balanceInfo && balanceInfo.length > 0) {
      for (const item of balanceInfo) {
        makeChip(`\u4F59\u989D(${item.currency})`, item.total_balance);
      }
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
  // ─── Module 1: File Stats ───────────────────────────────────────────────────
  async renderModule1(parent) {
    const mod = parent.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    header.createEl("span", { text: "\u{1F4C1} \u6587\u4EF6\u7EDF\u8BA1", cls: "dashboard-module-title" });
    const addBtn = header.createEl("button", { text: "+ \u589E\u52A0\u6587\u4EF6\u7EDF\u8BA1", cls: "dashboard-link-btn" });
    addBtn.addEventListener("click", () => {
      new FolderConfigModal(this.app, this.settings, this.fileService, async (s) => {
        await this.onSettingsChange(s);
        this.updateSettings(s);
        await this.render();
      }).open();
    });
    const body = mod.createDiv("dashboard-module-body");
    let stats;
    try {
      stats = await this.fileService.getStats(this.settings.trackedFolders);
    } catch (e) {
      body.createDiv({ text: "\u52A0\u8F7D\u5931\u8D25", cls: "dashboard-error" });
      return;
    }
    const totalRow = body.createDiv("dashboard-stat-total");
    totalRow.createEl("span", { text: "Vault \u603B\u6587\u4EF6" });
    totalRow.createEl("strong", { text: String(stats.total) });
    if (stats.folderStats.length > 0) {
      const maxCount = Math.max(...stats.folderStats.map((f) => f.count), 1);
      const list = body.createDiv("dashboard-folder-list");
      for (const fs of stats.folderStats) {
        const row = list.createDiv("dashboard-folder-row");
        const nameEl = row.createEl("span", { text: fs.name, cls: "dashboard-folder-row-name", title: fs.name });
        nameEl.addEventListener("click", () => {
          this.fileService.toggleFolderInExplorer(fs.name);
        });
        const barWrap = row.createDiv("dashboard-folder-row-bar-wrap");
        const fill = barWrap.createDiv("dashboard-folder-row-bar-fill");
        fill.style.width = `${Math.round(fs.count / maxCount * 100)}%`;
        row.createEl("span", { text: String(fs.count), cls: "dashboard-folder-row-count" });
      }
    }
    const anomaly = body.createDiv("dashboard-anomaly-row");
    this.createBadge(anomaly, `\u26A0 \u5B64\u7ACB ${stats.orphanCount}`, stats.orphanCount > 0 ? "warn" : "ok", `\u5B64\u7ACB\u9875\u9762\uFF08${stats.orphanCount}\uFF09`, stats.orphanFiles);
    this.createBadge(anomaly, `\u26A0 \u65E0\u6765\u6E90 ${stats.nosourceCount}`, stats.nosourceCount > 0 ? "warn" : "ok", `\u65E0\u6765\u6E90\u9875\u9762\uFF08${stats.nosourceCount}\uFF09`, stats.nosourceFiles);
    this.createBadge(anomaly, `\u26A0 \u7A7A\u767D ${stats.emptyCount}`, stats.emptyCount > 0 ? "warn" : "ok", `\u7A7A\u767D\u9875\u9762\uFF08${stats.emptyCount}\uFF09`, stats.emptyFilesList);
    const health = body.createDiv("dashboard-health");
    const healthLabel = health.createDiv("dashboard-health-label");
    healthLabel.createEl("span", { text: "\u5065\u5EB7\u5EA6" });
    healthLabel.createEl("strong", { text: `${stats.healthScore}\u5206\uFF08\u5B64\u7ACB\u536040% + \u65E0\u6765\u6E90\u536030% + \u7A7A\u767D\u536030%\uFF09` });
    const healthBar = health.createDiv("dashboard-health-track");
    const healthFill = healthBar.createDiv("dashboard-health-fill");
    healthFill.style.width = `${stats.healthScore}%`;
    healthFill.style.background = stats.healthScore >= 80 ? "var(--color-green)" : stats.healthScore >= 50 ? "var(--color-yellow)" : "var(--color-red)";
  }
  // ─── Module 3: Operation Log ───────────────────────────────────────────────
  async renderModule3(parent) {
    const mod = this.createModule(parent, "\u{1F4CB}", "\u64CD\u4F5C\u65E5\u5FD7");
    const body = mod.createDiv("dashboard-module-body");
    let logs;
    try {
      logs = await this.logService.getRecentLogs(5);
    } catch (e) {
      body.createDiv({ text: "\u65E0\u6CD5\u8BFB\u53D6\u65E5\u5FD7", cls: "dashboard-error" });
      return;
    }
    if (logs.length === 0) {
      body.createDiv({ text: "\u6682\u65E0\u65E5\u5FD7\u8BB0\u5F55", cls: "dashboard-empty" });
    } else {
      const list = body.createDiv("dashboard-log-list");
      for (const entry of logs) {
        const row = list.createDiv(`dashboard-log-row dashboard-log-${entry.type}`);
        row.createEl("span", { text: "\u25CF", cls: "dashboard-log-dot" });
        row.createEl("span", { text: entry.type, cls: "dashboard-log-type" });
        row.createEl("span", { text: entry.target, cls: "dashboard-log-target" });
        row.createEl("span", { text: this.formatLogTime(entry.time), cls: "dashboard-log-time" });
      }
    }
    const openBtn = body.createEl("button", { text: "\u6253\u5F00\u5B8C\u6574\u65E5\u5FD7", cls: "dashboard-link-btn" });
    openBtn.addEventListener("click", () => this.logService.openLogFolder());
  }
  // ─── Module 4: LLM Command ────────────────────────────────────────────────
  renderModule4(parent) {
    const mod = this.createModule(parent, "\u26A1", "LLM \u6307\u4EE4\u6267\u884C");
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
    const inputArea = body.createEl("textarea", {
      cls: "dashboard-cmd-input"
    });
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
        new import_obsidian7.Notice("\u8BF7\u8F93\u5165\u5185\u5BB9");
        return;
      }
      if (!this.settings.apiKey) {
        new import_obsidian7.Notice("\u8BF7\u5148\u914D\u7F6E API Key");
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
        exportBtn.onclick = async () => {
          const filename = `outputs/${commandSelect.value}-${Date.now()}.md`;
          try {
            await this.app.vault.create(filename, result);
          } catch (e) {
            await this.app.vault.adapter.mkdir("outputs");
            await this.app.vault.create(filename, result);
          }
          new import_obsidian7.Notice(`\u5DF2\u5BFC\u51FA\u5230 ${filename}`);
        };
      } catch (e) {
        errorEl.textContent = `\u26A0 ${e.message}`;
        errorEl.style.display = "";
      } finally {
        this.executing = false;
        execBtn.disabled = false;
        execBtn.textContent = "\u25B6 \u6267\u884C";
      }
    });
  }
  // ─── Module 5: Heatmap ───────────────────────────────────────────────────
  renderModule5(parent) {
    var _a;
    const mod = parent.createDiv("dashboard-module");
    const header = mod.createDiv("dashboard-module-header");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
    header.createEl("span", { text: "\u{1F5D3} \u5DE5\u4F5C\u70ED\u529B\u56FE", cls: "dashboard-module-title" });
    const yearNav = header.createDiv("dashboard-heatmap-year-nav");
    const prevBtn = yearNav.createEl("span", { text: "\u25C0", cls: "dashboard-heatmap-year-arrow" });
    const yearLabel = yearNav.createEl("span", { text: String(this.currentHeatmapYear), cls: "dashboard-heatmap-year-label clickable" });
    yearLabel.addEventListener("click", () => {
      if (this.settings.reportConfigs.yearly.enabled) {
        this.openOrCreateReport("yearly", new Date(this.currentHeatmapYear, 0, 1));
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
    if (this.currentHeatmapYear >= thisYear)
      nextBtn.addClass("disabled");
    prevBtn.addEventListener("click", () => {
      this.currentHeatmapYear--;
      this.render();
    });
    nextBtn.addEventListener("click", () => {
      if (this.currentHeatmapYear < thisYear) {
        this.currentHeatmapYear++;
        this.render();
      }
    });
    const body = mod.createDiv("dashboard-module-body");
    const now = /* @__PURE__ */ new Date();
    const todayStr = this.fmtDate(now);
    const data = this.heatmapService.getData();
    const maxVal = Math.max(...Object.values(data), 1);
    const year = this.currentHeatmapYear;
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
        const dateStr = this.fmtDate(cellDate);
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
    const legend = body.createDiv("dashboard-heatmap-legend");
    legend.createEl("span", { text: "\u5C11", cls: "dashboard-heatmap-legend-label" });
    for (let i = 0; i <= 4; i++) {
      legend.createDiv({ cls: `dashboard-heatmap-cell level-${i} legend-cell` });
    }
    legend.createEl("span", { text: "\u591A", cls: "dashboard-heatmap-legend-label" });
  }
  resolveReportPath(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const relPath = this.formatMomentDate(date, cfg.filenameFormat);
    const dir = cfg.directory.replace(/^\/+|\/+$/g, "");
    return dir ? `${dir}/${relPath}.md` : `${relPath}.md`;
  }
  async openOrCreateReport(type, date) {
    const cfg = this.settings.reportConfigs[type];
    const path = this.resolveReportPath(type, date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian7.TFile) {
      await this.app.workspace.getLeaf(false).openFile(file);
      return;
    }
    const doCreate = async () => {
      let content = "";
      if (cfg.templatePath) {
        const tpl = this.app.vault.getAbstractFileByPath(`${cfg.templatePath}.md`);
        if (tpl instanceof import_obsidian7.TFile)
          content = this.formatMomentDate(date, await this.app.vault.read(tpl));
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
      const name = this.REPORT_NAMES[type];
      new class extends import_obsidian7.Modal {
        onOpen() {
          this.contentEl.createEl("p", { text: `${name}\u4E0D\u5B58\u5728\uFF0C\u662F\u5426\u65B0\u5EFA\uFF1F` });
          this.contentEl.createEl("p", { text: path, cls: "dashboard-field-hint" });
          const btns = this.contentEl.createDiv("dashboard-confirm-btns");
          btns.createEl("button", { text: "\u65B0\u5EFA", cls: "mod-cta" }).addEventListener("click", async () => {
            this.close();
            try {
              await doCreate();
            } catch (e) {
              new import_obsidian7.Notice(`\u521B\u5EFA\u5931\u8D25: ${e.message}`);
            }
          });
          btns.createEl("button", { text: "\u53D6\u6D88" }).addEventListener("click", () => this.close());
        }
        onClose() {
          this.contentEl.empty();
        }
      }(this.app).open();
    } else {
      try {
        await doCreate();
      } catch (e) {
        new import_obsidian7.Notice(`\u521B\u5EFA${this.REPORT_NAMES[type]}\u5931\u8D25: ${e.message}`);
      }
    }
  }
  fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  // ─── Module 6: Plugin Manager ─────────────────────────────────────────────
  renderModule6(parent) {
    const mod = this.createModule(parent, "\u{1F50C}", "\u63D2\u4EF6\u7BA1\u7406");
    const body = mod.createDiv("dashboard-module-body");
    const plugins = this.pluginService.getInstalledPlugins();
    if (plugins.length === 0) {
      body.createDiv({ text: "\u672A\u68C0\u6D4B\u5230\u5DF2\u5B89\u88C5\u63D2\u4EF6", cls: "dashboard-empty" });
    } else {
      const table = body.createEl("table", { cls: "dashboard-plugin-table" });
      const hr = table.createEl("thead").createEl("tr");
      for (const h of ["\u63D2\u4EF6\u540D\u79F0", "\u8BF4\u660E", "\u7248\u672C", "\u542F\u7528"])
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
            new import_obsidian7.Notice(`${p.name} \u5DF2${cb.checked ? "\u542F\u7528" : "\u7981\u7528"}`);
          } catch (e) {
            new import_obsidian7.Notice(`\u64CD\u4F5C\u5931\u8D25: ${e.message}`);
            cb.checked = !cb.checked;
          } finally {
            cb.disabled = false;
          }
        });
      }
    }
    const openBtn = body.createEl("button", { text: "\u2192 \u6253\u5F00 Obsidian \u63D2\u4EF6\u8BBE\u7F6E", cls: "dashboard-link-btn" });
    openBtn.addEventListener("click", () => this.pluginService.openPluginSettings());
  }
  // ─── Footer ───────────────────────────────────────────────────────────────
  renderFooter(parent) {
    const footer = parent.createDiv("dashboard-footer");
    const shortcuts = footer.createDiv("dashboard-shortcuts");
    for (const path of ["raw", "wiki", "outputs", "AGENTS.md"]) {
      const btn = shortcuts.createEl("button", { text: path, cls: "dashboard-shortcut-btn" });
      btn.addEventListener("click", async () => {
        const f = this.app.vault.getAbstractFileByPath(path);
        if (f instanceof import_obsidian7.TFile) {
          await this.app.workspace.getLeaf(false).openFile(f);
        } else {
          new import_obsidian7.Notice(`\u672A\u627E\u5230: ${path}`);
        }
      });
    }
    const statusRow = footer.createDiv("dashboard-status-row");
    const icon = this.settings.lastConnectionStatus === "ok" ? "\u2705" : this.settings.lastConnectionStatus === "error" ? "\u274C" : "\u26AA";
    const text = this.settings.lastConnectionStatus === "ok" ? `\u6B63\u5E38\uFF08${this.settings.lastConnectionTime}\uFF09` : this.settings.lastConnectionStatus === "error" ? "\u5F02\u5E38" : "\u672A\u6D4B\u8BD5";
    statusRow.createEl("span", { text: `\u6A21\u578B\u72B6\u6001: ${icon} ${text}`, cls: "dashboard-model-status" });
  }
  // ─── Helpers ──────────────────────────────────────────────────────────────
  createModule(parent, icon, title) {
    const mod = parent.createDiv("dashboard-module");
    mod.createDiv("dashboard-module-header").createEl("span", {
      text: `${icon} ${title}`,
      cls: "dashboard-module-title"
    });
    return mod;
  }
  createBadge(parent, text, level, tooltip, files) {
    const badge = parent.createEl("span", { text, cls: `dashboard-badge dashboard-badge-${level}` });
    if (!files || files.length === 0)
      return;
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
      popover.createDiv("dashboard-popover-title").textContent = tooltip != null ? tooltip : text;
      for (const filePath of files) {
        const item = popover.createDiv("dashboard-popover-item");
        item.textContent = `\u2022 ${filePath}`;
        item.addEventListener("mousedown", async (e) => {
          e.preventDefault();
          const f = this.app.vault.getAbstractFileByPath(filePath);
          if (f instanceof import_obsidian7.TFile) {
            await this.app.workspace.getLeaf(false).openFile(f);
          }
          remove();
        });
      }
      const rect = badge.getBoundingClientRect();
      popover.style.top = `${rect.bottom + 6}px`;
      popover.style.left = `${Math.min(rect.left, window.innerWidth - 420)}px`;
      popover.addEventListener("mouseenter", clearTimer);
      popover.addEventListener("mouseleave", () => {
        hideTimer = setTimeout(remove, 200);
      });
    };
    badge.addEventListener("mouseenter", show);
    badge.addEventListener("mouseleave", () => {
      hideTimer = setTimeout(remove, 200);
    });
  }
  formatLogTime(time) {
    const d = new Date(time);
    if (isNaN(d.getTime()))
      return time;
    const diff = Math.floor((Date.now() - d.getTime()) / 6e4);
    if (diff < 1)
      return "\u521A\u521A";
    if (diff < 60)
      return `${diff}\u5206\u949F\u524D`;
    if (diff < 1440)
      return `${Math.floor(diff / 60)}\u5C0F\u65F6\u524D`;
    return `${Math.floor(diff / 1440)}\u5929\u524D`;
  }
};

// src/main.ts
var LLMWikiDashboardPlugin = class extends import_obsidian8.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this.settings, this.saveSettings.bind(this))
    );
    this.addRibbonIcon("layout-dashboard", "yyObsidianDashboard", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-dashboard",
      name: "\u6253\u5F00 yyObsidianDashboard",
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
var DashboardSettingTab = class extends import_obsidian8.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "yyObsidianDashboard \u8BBE\u7F6E" });
    new import_obsidian8.Setting(containerEl).setName("API Base URL").setDesc("OpenAI Compatible \u63A5\u53E3\u5730\u5740").addText(
      (text) => text.setPlaceholder("https://api.openai.com/v1").setValue(this.plugin.settings.apiBaseUrl).onChange(async (value) => {
        this.plugin.settings.apiBaseUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("API Key").setDesc("\u4F60\u7684 API \u5BC6\u94A5").addText((text) => {
      text.setPlaceholder("sk-...").setValue(this.plugin.settings.apiKey).onChange(async (value) => {
        this.plugin.settings.apiKey = value;
        await this.plugin.saveSettings();
      });
      text.inputEl.type = "password";
    });
    new import_obsidian8.Setting(containerEl).setName("\u6A21\u578B\u540D\u79F0").addText(
      (text) => text.setPlaceholder("gpt-4o").setValue(this.plugin.settings.modelName).onChange(async (value) => {
        this.plugin.settings.modelName = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("Temperature").addSlider(
      (slider) => slider.setLimits(0, 2, 0.1).setValue(this.plugin.settings.temperature).setDynamicTooltip().onChange(async (value) => {
        this.plugin.settings.temperature = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("Max Tokens").addText(
      (text) => text.setValue(String(this.plugin.settings.maxTokens)).onChange(async (value) => {
        const n = parseInt(value);
        if (!isNaN(n)) {
          this.plugin.settings.maxTokens = n;
          await this.plugin.saveSettings();
        }
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u7528\u91CF\u63A5\u53E3\u5730\u5740").setDesc("\u9009\u586B\u3002\u586B\u5199\u540E\u4F18\u5148\u4F7F\u7528\u63A5\u53E3\u6570\u636E\uFF0C\u5426\u5219\u7528\u672C\u5730\u7EDF\u8BA1").addText(
      (text) => text.setPlaceholder("https://...").setValue(this.plugin.settings.tokenUsageApiUrl).onChange(async (value) => {
        this.plugin.settings.tokenUsageApiUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u4F59\u989D\u63A5\u53E3\u5730\u5740").setDesc("\u9009\u586B\u3002\u5982 DeepSeek: https://api.deepseek.com/user/balance").addText(
      (text) => text.setPlaceholder("https://...").setValue(this.plugin.settings.tokenBalanceApiUrl).onChange(async (value) => {
        this.plugin.settings.tokenBalanceApiUrl = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("\u7EDF\u8BA1\u6587\u4EF6\u5939").setDesc("\u9017\u53F7\u5206\u9694\u7684\u6587\u4EF6\u5939\u8DEF\u5F84\u5217\u8868\uFF0C\u5982 raw, wiki, raw/\u5B50\u76EE\u5F55").addText(
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
      new import_obsidian8.Setting(containerEl).setName("\u542F\u7528").addToggle(
        (toggle) => toggle.setValue(cfg.enabled).onChange(async (value) => {
          cfg.enabled = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian8.Setting(containerEl).setName("\u65B0\u5EFA\u65F6\u5F39\u7A97\u786E\u8BA4").setDesc("\u70B9\u51FB\u6CA1\u6709\u5BF9\u5E94\u62A5\u544A\u7684\u65E5\u671F\u65F6\uFF0C\u662F\u5426\u5148\u5F39\u7A97\u786E\u8BA4\u518D\u65B0\u5EFA").addToggle(
        (toggle) => toggle.setValue(cfg.confirmBeforeCreate).onChange(async (value) => {
          cfg.confirmBeforeCreate = value;
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian8.Setting(containerEl).setName("\u5B58\u653E\u76EE\u5F55").setDesc("\u6587\u4EF6\u5B58\u50A8\u7684\u6839\u76EE\u5F55").addText(
        (text) => text.setValue(cfg.directory).onChange(async (value) => {
          cfg.directory = value.trim();
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian8.Setting(containerEl).setName("\u6587\u4EF6\u8DEF\u5F84\u683C\u5F0F").setDesc(`\u652F\u6301 YYYY/YY/MM/M/DD/D \u7B49 moment.js \u683C\u5F0F\u4EE4\u724C\u3002\u5982 YYYY/MM/YYYY-MM-DD`).addText(
        (text) => text.setValue(cfg.filenameFormat).onChange(async (value) => {
          cfg.filenameFormat = value.trim();
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian8.Setting(containerEl).setName("\u6A21\u677F\u8DEF\u5F84").setDesc("vault \u4E2D\u7684\u6A21\u677F\u6587\u4EF6\u8DEF\u5F84\uFF08\u4E0D\u542B .md \u540E\u7F00\uFF09\uFF0C\u7559\u7A7A\u5219\u4E0D\u4F7F\u7528\u6A21\u677F").addText(
        (text) => text.setValue(cfg.templatePath).onChange(async (value) => {
          cfg.templatePath = value.trim();
          await this.plugin.saveSettings();
        })
      );
    }
  }
};
