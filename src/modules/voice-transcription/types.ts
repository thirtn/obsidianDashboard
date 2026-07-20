export type RecorderState = "idle" | "recording" | "transcribing" | "done";

export interface TranscriptionResult {
  text: string;
  timestamp: number;
}
