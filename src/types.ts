export interface FolderStat {
  name: string;
  count: number;
}

export interface FileStats {
  total: number;
  folderStats: FolderStat[];
  orphanCount: number;
  nosourceCount: number;
  emptyCount: number;
  healthScore: number;
  orphanFiles: string[];
  nosourceFiles: string[];
  emptyFilesList: string[];
}

export type LogType = "ingest" | "query" | "lint" | "unknown";

export interface LogEntry {
  type: LogType;
  target: string;
  time: string;
  raw: string;
}

export interface TokenDay {
  date: string;
  tokens: number;
}

export interface BalanceItem {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
}

export interface TokenUsage {
  today: number;
  thisMonth: number;
  remaining: number | null;
  dailyBreakdown: TokenDay[];
  balanceInfo: BalanceItem[] | null;
}

export interface HeatmapData {
  [date: string]: number;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
  hasSettings: boolean;
  description: string;
}

// ─── Report Config ──────────────────────────────────────────────────────────

export type ReportType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface ReportConfig {
  enabled: boolean;
  confirmBeforeCreate: boolean;
  directory: string;       // e.g. "raw/dayReport"
  filenameFormat: string;  // moment-style tokens, relative to directory
  templatePath: string;    // path to template file in vault
}

export type ReportSettings = Record<ReportType, ReportConfig>;

export const REPORT_LABELS: Record<ReportType, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
  quarterly: "季报",
  yearly: "年报",
};

/** Scrollable dashboard module IDs (excludes fixed header/search/workspace-bar) */
export const MODULE_IDS = [
  "file-stats",
  "heatmap",
  "llm-command",
  "operation-log",
  "git-sync",
  "remotely-save",
  "task-quickadd",
  "plugin-manage",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export const MODULE_LABELS: Record<ModuleId, string> = {
  "file-stats": "文件统计",
  heatmap: "工作热力图",
  "llm-command": "LLM 指令执行",
  "operation-log": "操作日志",
  "git-sync": "Git 同步",
  "remotely-save": "云同步记录",
  "task-quickadd": "快速添加任务",
  "plugin-manage": "插件管理",
};

export function defaultModuleVisibility(): Record<string, boolean> {
  return Object.fromEntries(MODULE_IDS.map((id) => [id, true]));
}

const defaultReportConfigs: ReportSettings = {
  daily:     { enabled: true,  confirmBeforeCreate: true,  directory: "raw/dayReport",     filenameFormat: "YYYY/MM/YYYY-MM-DD",   templatePath: "raw/dayReport/template" },
  weekly:    { enabled: false, confirmBeforeCreate: true,  directory: "raw/weekReport",    filenameFormat: "YYYY/MM/YYYY-[W]ww",   templatePath: "raw/weekReport/template" },
  monthly:   { enabled: false, confirmBeforeCreate: true,  directory: "raw/monthReport",   filenameFormat: "YYYY/MM/YYYY-MM",      templatePath: "raw/monthReport/template" },
  quarterly: { enabled: false, confirmBeforeCreate: true,  directory: "raw/quarterReport", filenameFormat: "YYYY/MM/YYYY-[Q]Q",    templatePath: "raw/quarterReport/template" },
  yearly:    { enabled: false, confirmBeforeCreate: true,  directory: "raw/yearReport",    filenameFormat: "YYYY/YYYY",            templatePath: "raw/yearReport/template" },
};

export interface DashboardSettings {
  // LLM config
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  // Token usage
  tokenUsageApiUrl: string;
  tokenBalanceApiUrl: string;
  // Folder stats config
  trackedFolders: string[];
  // Last connection test result
  lastConnectionStatus: "ok" | "error" | "untested";
  lastConnectionTime: string;
  // Report configs
  reportConfigs: ReportSettings;
  // Task quick add defaults
  taskDefaults: TaskDefaults;
  // Dashboard display
  dashboardTitle: string;
  dashboardDesc: string;
  // Git sync config
  gitEnabled: boolean;
  gitRemoteURL: string;
  gitRemoteName: string;
  gitBranchName: string;
  gitUsername: string;
  gitPassword: string;
  gitAutoPushEnabled: boolean;
  gitAutoPushInterval: number;
  gitPollInterval: number;
  gitPushTimeout: number;
  gitPollInterval: number;
  gitCommitTemplate: string;
  // Module order (drag-and-drop)
  moduleOrder: string[];
  // Per-module visibility toggles
  moduleVisibility: Record<string, boolean>;
  // Open dashboard when Obsidian starts
  openOnStartup: boolean;
  // Vault persistence paths
  heatmapDataPath: string;
  tokenUsageDataPath: string;
}

export interface TaskDefaults {
  urgent: string;
  normal: string;
  low: string;
  ongoing: string;
  ongoingPercent: string;
}

export const DEFAULT_TASK_DEFAULTS: TaskDefaults = {
  urgent: "",
  normal: "",
  low: "",
  ongoing: "",
  ongoingPercent: "0",
};

export const DEFAULT_SETTINGS: DashboardSettings = {
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
  dashboardDesc: "禹思天下有溺者，由己溺之也；稷思天下有饥者，由己饥之也。",
  gitEnabled: false,
  gitRemoteURL: "",
  gitRemoteName: "origin",
  gitBranchName: "main",
  gitUsername: "",
  gitPassword: "",
  gitAutoPushEnabled: false,
  gitAutoPushInterval: 30,
  gitPollInterval: 30,
  gitPushTimeout: 5,
  gitCommitTemplate: "auto: {{date}} {{time}}",
  moduleOrder: [
    "file-stats",
    "heatmap",
    "llm-command",
    "operation-log",
    "git-sync",
    "remotely-save",
    "task-quickadd",
    "plugin-manage",
  ],
  moduleVisibility: defaultModuleVisibility(),
  openOnStartup: false,
  heatmapDataPath: ".dashboard/heatmap.json",
  tokenUsageDataPath: ".dashboard/token-usage.json",
};
