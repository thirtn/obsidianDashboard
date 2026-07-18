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
