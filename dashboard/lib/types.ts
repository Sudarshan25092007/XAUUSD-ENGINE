export type MarketSession = 'LONDON' | 'NEW_YORK' | 'TOKYO' | 'SYDNEY';

export type DecisionStatus = 'EXECUTE' | 'BLOCK';
export type ImpulseSignal = 'IMPULSE_UP' | 'IMPULSE_DOWN';
export type OrderDirection = 'BUY' | 'SELL';

export interface TickData {
  id?: number;
  time: string;
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp_ms: number;
  session?: string;
  received_at?: string;
}

export interface Candle1s {
  id?: number;
  time: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  tick_count: number;
  spread_avg: number;
  second_ts: number;
  session: string;
  tick_density: number;
  dir_imbalance: number;
  is_impulse?: boolean;
}

export interface EngineDecision {
  id: number;
  time: string;
  signal: ImpulseSignal | string;
  session: string;
  price: number;
  status: DecisionStatus;
  reason: string;
  metadata?: {
    tick_density?: number;
    density_threshold?: number;
    dir_imbalance?: number;
    imbalance_cap?: number;
    spread?: number;
    news_active?: boolean;
    sl?: number;
    tp?: number;
    [key: string]: unknown;
  };
}

export interface EnginePosition {
  id: number;
  ticket: number;
  symbol: string;
  direction: OrderDirection;
  volume: number;
  entry_price: number;
  current_price?: number;
  sl: number;
  tp: number;
  opened_at: string;
  closed_at?: string | null;
  profit?: number | null;
  status: 'OPEN' | 'CLOSED';
}

export interface RegimeBaseline {
  id?: number;
  session: MarketSession | string;
  density_mean: number;
  density_std: number;
  density_threshold: number;
  min_imbalance: number;
  imbalance_cap: number;
  sample_size: number;
  calculated_at?: string;
}

export interface OverviewStats {
  totalTicksToday: number;
  totalCandlesToday: number;
  executeCountToday: number;
  blockCountToday: number;
  activePositionsCount: number;
  totalPnlToday: number;
  currentSession: MarketSession;
  dbStatus: 'connected' | 'offline' | 'mock';
  lastUpdated: string;
}
