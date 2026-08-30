export type HoldingEvent = "new" | "exit" | "add" | "cut" | "hold";

export type ChaseRow = {
  stock_id: string;
  display_name: string;
  sector: string | null;
  fund_count: number;
  fund_count_delta: number;
  net_qty_delta: number;
  net_value_delta_cr: number;
  median_weight_pct: number | null;
};

export type MfdataFamily = {
  id?: number;
  family_id?: number;
  name?: string;
  scheme_name?: string;
  amc?: string;
  amc_name?: string;
  category?: string;
  sebi_category?: string;
  has_holdings?: boolean;
  aum_cr?: number;
};

export type MfdataHolding = {
  name?: string;
  stock_name?: string;
  isin?: string;
  sector?: string;
  quantity?: number;
  market_value_cr?: number;
  weight_pct?: number;
  change_mom?: number;
};
