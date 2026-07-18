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
