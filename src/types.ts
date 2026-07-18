export type { FolderStat, FileStats } from "./modules/file-stats/types";

export type { LogType, LogEntry } from "./modules/operation-log/types";

export type { TokenDay, BalanceItem, TokenUsage } from "./modules/llm-command/types";

export type { HeatmapData, ReportType, ReportConfig, ReportSettings } from "./modules/heatmap/types";
export { REPORT_LABELS } from "./modules/heatmap/types";

export type { PluginInfo } from "./modules/plugin-manage/types";

import type { ReportSettings } from "./modules/heatmap/types";
import type { TaskDefaults } from "./modules/task-quickadd/types";
import { DEFAULT_TASK_DEFAULTS } from "./modules/task-quickadd/types";
export type { TaskDefaults };
export { DEFAULT_TASK_DEFAULTS };

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
