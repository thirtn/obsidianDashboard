export class VoiceTranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async startRecording(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm",
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.start();
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob());
        return;
      }
      this.mediaRecorder.onstop = () => {
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        const blob = new Blob(this.chunks, { type: "audio/webm" });
        resolve(blob);
      };
      this.mediaRecorder.stop();
    });
  }

  cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.chunks = [];
    this.mediaRecorder = null;
  }

  async transcribe(
    audioBlob: Blob,
    apiBaseUrl: string,
    apiKey: string,
    model: string
  ): Promise<string> {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    formData.append("model", model);

    const response = await fetch(`${apiBaseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(
          "当前 API 服务商不支持 Whisper 语音转写（404）。\n请使用 OpenAI 或兼容 Whisper 的 API 地址"
        );
      }
      const err = await response.json().catch(() => ({
        error: { message: response.statusText },
      }));
      throw new Error(
        err.error?.message || `Whisper API error: ${response.status}`
      );
    }

    const data = await response.json();
    return data.text || "";
  }
}
