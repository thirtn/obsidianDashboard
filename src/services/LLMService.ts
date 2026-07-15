import { requestUrl } from "obsidian";
import { DashboardSettings, TokenUsage, TokenDay, BalanceItem } from "../types";
import { VaultPersistenceService } from "./VaultPersistenceService";

const LOCAL_STORAGE_KEY = "llm-wiki-dashboard-token-usage";

interface LocalTokenStore {
  [date: string]: number;
}

export class LLMService {
  private persistence: VaultPersistenceService;
  private vaultPath: string;

  constructor(
    private settings: DashboardSettings,
    vaultPath?: string
  ) {
    this.persistence = new VaultPersistenceService(null as any); // Will be set properly
    this.vaultPath = vaultPath || ".dashboard/token-usage.json";
  }

  /** Must be called after construction to wire up the vault adapter */
  setApp(app: any) {
    this.persistence = new VaultPersistenceService(app);
  }

  updateSettings(settings: DashboardSettings) {
    this.settings = settings;
  }

  async executeCommand(
    command: "ingest" | "query" | "lint-wiki",
    input: string,
    onChunk?: (text: string) => void
  ): Promise<string> {
    const systemPrompts: Record<string, string> = {
      ingest: "You are a knowledge ingestion assistant. Process the following content and extract key information for the wiki.",
      query: "You are a wiki assistant. Answer the following question based on the knowledge base.",
      "lint-wiki": "You are a wiki linter. Review the following content and suggest improvements for clarity, structure, and completeness.",
    };

    const body = JSON.stringify({
      model: this.settings.modelName,
      temperature: this.settings.temperature,
      max_tokens: this.settings.maxTokens,
      messages: [
        { role: "system", content: systemPrompts[command] ?? "You are a helpful assistant." },
        { role: "user", content: input },
      ],
    });

    const resp = await requestUrl({
      url: `${this.settings.apiBaseUrl}/chat/completions`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.settings.apiKey}`,
      },
      body,
      throw: false,
    });

    if (resp.status === 401) throw new Error("401: API Key 无效，请检查配置");
    if (resp.status === 429) throw new Error("429: 请求过于频繁，请稍后重试");
    if (resp.status === 408 || resp.status === 504) throw new Error("超时: 请求超时，请稍后重试");
    if (resp.status >= 500) throw new Error(`服务器错误 (${resp.status})，请稍后重试`);
    if (resp.status !== 200) throw new Error(`请求失败 (${resp.status}): ${resp.text}`);

    const data = resp.json;
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const totalTokens: number = data?.usage?.total_tokens ?? 0;

    if (totalTokens > 0) this.recordLocalTokens(totalTokens);

    return content;
  }

  async testConnection(): Promise<void> {
    const resp = await requestUrl({
      url: `${this.settings.apiBaseUrl}/models`,
      method: "GET",
      headers: { Authorization: `Bearer ${this.settings.apiKey}` },
      throw: false,
    });
    if (resp.status === 401) throw new Error("401: API Key 无效");
    if (resp.status === 404) throw new Error("404: Base URL 不正确");
    if (resp.status >= 400) throw new Error(`连接失败 (${resp.status})`);
  }

  async getTokenUsage(): Promise<TokenUsage> {
    const hasUsageApi = !!this.settings.tokenUsageApiUrl;
    const hasBalanceApi = !!this.settings.tokenBalanceApiUrl;

    const localUsage = await this.getLocalTokenUsage();

    const [apiUsage, balanceInfo] = await Promise.all([
      hasUsageApi ? this.fetchUsageApi() : null,
      hasBalanceApi ? this.fetchBalanceApi() : null,
    ]);

    return {
      today: apiUsage?.today ?? localUsage.today,
      thisMonth: apiUsage?.thisMonth ?? localUsage.thisMonth,
      remaining: apiUsage?.remaining ?? null,
      dailyBreakdown: apiUsage?.dailyBreakdown ?? localUsage.dailyBreakdown,
      balanceInfo: balanceInfo,
    };
  }

  private async getLocalTokenUsage(): Promise<Omit<TokenUsage, "balanceInfo">> {
    // Try vault file first
    const vaultData = await this.persistence.readJSON<LocalTokenStore>(this.vaultPath);
    const localData = this.loadLocalStoreSync();

    let store = vaultData ?? localData;

    // Migrate: merge localStorage into vault data, then persist
    if (!vaultData && Object.keys(localData).length > 0) {
      this.persistence.writeJSON(this.vaultPath, localData).catch(() => {});
    } else if (vaultData) {
      let merged = false;
      for (const [date, tokens] of Object.entries(localData)) {
        if (!(date in vaultData) || localData[date] > (vaultData[date] ?? 0)) {
          store[date] = tokens;
          merged = true;
        }
      }
      if (merged) {
        this.persistence.writeJSON(this.vaultPath, store).catch(() => {});
      }
    }

    const today = this.todayStr();
    const monthPrefix = today.slice(0, 7);

    const todayTokens = store[today] ?? 0;
    let thisMonth = 0;
    const dailyBreakdown: TokenDay[] = [];

    for (const [date, tokens] of Object.entries(store)) {
      if (date.startsWith(monthPrefix)) {
        thisMonth += tokens;
        dailyBreakdown.push({ date, tokens });
      }
    }

    dailyBreakdown.sort((a, b) => b.date.localeCompare(a.date));
    return { today: todayTokens, thisMonth, remaining: null, dailyBreakdown: dailyBreakdown.slice(0, 30) };
  }

  private async fetchUsageApi(): Promise<Omit<TokenUsage, "balanceInfo"> | null> {
    try {
      const resp = await requestUrl({
        url: this.settings.tokenUsageApiUrl,
        method: "GET",
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        throw: false,
      });
      if (resp.status !== 200) return null;
      const data = resp.json;
      const today = data?.daily?.today ?? data?.today ?? 0;
      const thisMonth = data?.monthly?.total ?? data?.this_month ?? 0;
      const remaining = data?.remaining ?? data?.quota_remaining ?? null;
      return { today, thisMonth, remaining, dailyBreakdown: [] };
    } catch {
      return null;
    }
  }

  private async fetchBalanceApi(): Promise<BalanceItem[] | null> {
    try {
      const resp = await requestUrl({
        url: this.settings.tokenBalanceApiUrl,
        method: "GET",
        headers: { Authorization: `Bearer ${this.settings.apiKey}` },
        throw: false,
      });
      if (resp.status !== 200) return null;
      const data = resp.json;
      if (data?.balance_infos) return data.balance_infos;
      if (data?.currency) return [data];
      return null;
    } catch {
      return null;
    }
  }

  recordLocalTokens(tokens: number) {
    const store = this.loadLocalStoreSync();
    const today = this.todayStr();
    store[today] = (store[today] ?? 0) + tokens;

    // Write to localStorage (sync)
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(store));

    // Write to vault (async, fire-and-forget)
    this.persistence.writeJSON(this.vaultPath, store).catch(() => {});
  }

  private loadLocalStoreSync(): LocalTokenStore {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}
