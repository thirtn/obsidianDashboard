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
