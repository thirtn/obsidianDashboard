export type LogType = "ingest" | "query" | "lint" | "unknown";

export interface LogEntry {
  type: LogType;
  target: string;
  time: string;
  raw: string;
}
