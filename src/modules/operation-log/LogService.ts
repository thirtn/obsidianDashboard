import { App, TFile } from "obsidian";
import { LogEntry, LogType } from "./types";

export class LogService {
  constructor(private app: App) {}

  async getRecentLogs(count = 5): Promise<LogEntry[]> {
    const logFolder = this.app.vault.getAbstractFileByPath("wiki/log");
    if (!logFolder) return [];

    const logFiles: TFile[] = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof TFile && f.path.startsWith("wiki/log/") && f.extension === "md") {
        logFiles.push(f);
      }
    });

    if (logFiles.length === 0) return [];

    // Sort by modification time, newest first
    logFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);

    const entries: LogEntry[] = [];
    for (const file of logFiles) {
      if (entries.length >= count) break;
      const content = await this.app.vault.cachedRead(file);
      const parsed = this.parseLogFile(content, file.basename);
      entries.push(...parsed);
    }

    return entries.slice(0, count);
  }

  private parseLogFile(content: string, filename: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = content.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      entries.push(this.parseLine(line, filename));
    }

    return entries.reverse();
  }

  private parseLine(line: string, filename: string): LogEntry {
    const lower = line.toLowerCase();
    let type: LogType = "unknown";

    if (lower.includes("ingest")) type = "ingest";
    else if (lower.includes("query")) type = "query";
    else if (lower.includes("lint")) type = "lint";

    // Try to extract timestamp like [2026-07-10 10:28] or similar
    const timeMatch = line.match(/\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?)\]?/);
    const time = timeMatch ? timeMatch[1] : filename;

    // Extract target: anything after the type keyword up to next bracket or end
    const targetMatch = line.match(/(?:ingest|query|lint)[^\w]*([\w/\-. ]+)/i);
    const target = targetMatch ? targetMatch[1].trim() : line.slice(0, 40);

    return { type, target, time, raw: line };
  }

  async writeLog(type: LogType, target: string): Promise<void> {
    const now = new Date();
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
        await this.app.vault.append(file as TFile, `\n${line}`);
      } else {
        await this.app.vault.create(filePath, line);
      }
    } catch {
      // Silently ignore log write failures
    }
  }

}
