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
}

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
};
