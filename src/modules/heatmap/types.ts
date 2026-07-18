export interface HeatmapData {
  [date: string]: number;
}

export type ReportType = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface ReportConfig {
  enabled: boolean;
  confirmBeforeCreate: boolean;
  directory: string;
  filenameFormat: string;
  templatePath: string;
}

export type ReportSettings = Record<ReportType, ReportConfig>;

export const REPORT_LABELS: Record<ReportType, string> = {
  daily: "日报",
  weekly: "周报",
  monthly: "月报",
  quarterly: "季报",
  yearly: "年报",
};
