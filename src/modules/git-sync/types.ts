export interface GitStatus {
  clean: boolean;
  files: string[];
  ahead: number;
  behind: number;
}

export interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  date: string;
  author: string;
}
