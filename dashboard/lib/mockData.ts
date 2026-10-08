import {
  Candle1s,
  EngineDecision,
  EnginePosition,
  RegimeBaseline,
  MarketSession,
  OverviewStats,
} from './types';

export function getCurrentSessionUTC(): MarketSession {
  const hour = new Date().getUTCHours();
  if (hour >= 13 && hour < 21) return 'NEW_YORK';
  if (hour >= 7 && hour < 16) return 'LONDON';
  if (hour >= 0 && hour < 9) return 'TOKYO';
  return 'SYDNEY';
}

export const MOCK_REGIME_BASELINES: RegimeBaseline[] = [
  {
    session: 'LONDON',
    density_mean: 1.8542,
    density_std: 0.3917,
    density_threshold: 2.4418, // μ + 1.5σ
    min_imbalance: 0.3811,
    imbalance_cap: 0.7234,
    sample_size: 2180,
    calculated_at: '2026-10-08T06:00:00Z',
  },
  {
    session: 'NEW_YORK',
    density_mean: 1.3698,
    density_std: 0.2904,
    density_threshold: 1.8054, // μ + 1.5σ
    min_imbalance: 0.3296,
    imbalance_cap: 0.6645,
    sample_size: 1095,
    calculated_at: '2026-10-08T12:00:00Z',
  },
  {
    session: 'TOKYO',
    density_mean: 2.1743,
    density_std: 0.4569,
    density_threshold: 2.8596, // μ + 1.5σ
    min_imbalance: 0.4022,
    imbalance_cap: 0.7497,
    sample_size: 1420,
    calculated_at: '2026-10-08T00:00:00Z',
  },
  {
    session: 'SYDNEY',
    density_mean: 1.6699,
    density_std: 0.4004,
    density_threshold: 2.2706, // μ + 1.5σ
    min_imbalance: 0.3704,
    imbalance_cap: 0.709,
    sample_size: 633,
    calculated_at: '2026-10-07T21:00:00Z',
  },
];

export function generateMockCandles(count = 100): Candle1s[] {
  const candles: Candle1s[] = [];
  const now = Math.floor(Date.now() / 1000);
  const activeSession = getCurrentSessionUTC();
  const baseline =
    MOCK_REGIME_BASELINES.find((b) => b.session === activeSession) ||
    MOCK_REGIME_BASELINES[0];

  let currentPrice = 2884.5;

  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i;
    const timeIso = new Date(timestamp * 1000).toISOString();

    // Periodic momentum clusters
    const isImpulseCluster = i % 18 === 0 || i % 27 === 0;
    const volatility = isImpulseCluster ? 0.85 : 0.25;

    const priceDelta = (Math.random() - 0.48) * volatility;
    const open = Math.round(currentPrice * 100) / 100;
    const close = Math.round((open + priceDelta) * 100) / 100;
    const high = Math.round((Math.max(open, close) + Math.random() * 0.15) * 100) / 100;
    const low = Math.round((Math.min(open, close) - Math.random() * 0.15) * 100) / 100;
    currentPrice = close;

    const tick_count = isImpulseCluster
      ? Math.floor(12 + Math.random() * 14)
      : Math.floor(1 + Math.random() * 7);

    const tick_density = isImpulseCluster
      ? Number((baseline.density_threshold + Math.random() * 0.6).toFixed(4))
      : Number(
          Math.max(
            0.6,
            baseline.density_mean + (Math.random() - 0.5) * baseline.density_std * 1.5
          ).toFixed(4)
        );

    const dir_imbalance = Number(
      (
        (Math.random() * 2 - 1) *
        (isImpulseCluster ? 0.75 : 0.4)
      ).toFixed(4)
    );

    const spread_avg = Number(
      (0.18 + Math.random() * 0.12 + (isImpulseCluster ? 0.08 : 0)).toFixed(2)
    );

    candles.push({
      id: 10000 + (count - i),
      time: timeIso,
      symbol: 'XAUUSD',
      open,
      high,
      low,
      close,
      tick_count,
      spread_avg,
      second_ts: timestamp,
      session: activeSession,
      tick_density,
      dir_imbalance,
      is_impulse: tick_density >= baseline.density_threshold,
    });
  }

  return candles;
}

export function generateMockDecisions(count = 50): EngineDecision[] {
  const decisions: EngineDecision[] = [];
  const now = Math.floor(Date.now() / 1000);
  const activeSession = getCurrentSessionUTC();

  const reasonsList = [
    {
      status: 'EXECUTE' as const,
      signal: 'IMPULSE_UP' as const,
      reason: 'Statistically Validated: Density 2.82 >= 2.44, Imbalance +0.64 > 0.38, Spread 0.22',
      metadata: { tick_density: 2.8214, density_threshold: 2.4418, dir_imbalance: 0.642, imbalance_cap: 0.723, spread: 0.22, news_active: false },
    },
    {
      status: 'EXECUTE' as const,
      signal: 'IMPULSE_DOWN' as const,
      reason: 'Order Flow Breakdown: Density 2.68 >= 2.44, Imbalance -0.59 < -0.38, Spread 0.24',
      metadata: { tick_density: 2.6841, density_threshold: 2.4418, dir_imbalance: -0.591, imbalance_cap: 0.723, spread: 0.24, news_active: false },
    },
    {
      status: 'BLOCK' as const,
      signal: 'IMPULSE_UP' as const,
      reason: 'Gated by Sub-Threshold Density: 1.48 < session threshold 2.44 (Noise Rejection)',
      metadata: { tick_density: 1.4821, density_threshold: 2.4418, dir_imbalance: 0.45, spread: 0.21, news_active: false },
    },
    {
      status: 'BLOCK' as const,
      signal: 'IMPULSE_DOWN' as const,
      reason: 'Adverse Selection Shield: Density 4.12 exceeds μ+4σ safety ceiling 3.42',
      metadata: { tick_density: 4.1205, density_threshold: 2.4418, dir_imbalance: -0.88, spread: 0.65, news_active: false },
    },
    {
      status: 'BLOCK' as const,
      signal: 'IMPULSE_UP' as const,
      reason: 'USD News Circuit Breaker Active: High-impact release window (CPI / FOMC)',
      metadata: { tick_density: 2.9102, density_threshold: 2.4418, dir_imbalance: 0.71, spread: 0.45, news_active: true },
    },
    {
      status: 'BLOCK' as const,
      signal: 'IMPULSE_UP' as const,
      reason: 'Choppy Market Filter: Directional imbalance 0.26 below minimum required 0.38',
      metadata: { tick_density: 2.5112, density_threshold: 2.4418, dir_imbalance: 0.264, spread: 0.25, news_active: false },
    },
    {
      status: 'BLOCK' as const,
      signal: 'IMPULSE_DOWN' as const,
      reason: 'Spread Ceiling Filter: Current spread 0.88 exceeds maximum threshold 0.80',
      metadata: { tick_density: 2.7441, density_threshold: 2.4418, dir_imbalance: -0.62, spread: 0.88, news_active: false },
    },
    {
      status: 'BLOCK' as const,
      signal: 'IMPULSE_UP' as const,
      reason: 'Imbalance Cap Exceeded: 0.84 exceeds 0.72 (Liquidity Vacancy / Trap Risk)',
      metadata: { tick_density: 3.0115, density_threshold: 2.4418, dir_imbalance: 0.842, imbalance_cap: 0.723, spread: 0.30, news_active: false },
    },
  ];

  let basePrice = 2884.2;

  for (let i = 0; i < count; i++) {
    const secondsAgo = i * 14 + Math.floor(Math.random() * 8);
    const timeIso = new Date((now - secondsAgo) * 1000).toISOString();
    const template = reasonsList[i % reasonsList.length];
    const priceVariance = (Math.random() - 0.5) * 1.8;
    const price = Number((basePrice + priceVariance).toFixed(2));

    decisions.push({
      id: 5000 + i,
      time: timeIso,
      signal: template.signal,
      session: activeSession,
      price,
      status: template.status,
      reason: template.reason,
      metadata: {
        ...template.metadata,
        sl: template.signal === 'IMPULSE_UP' ? price - 3.0 : price + 3.0,
        tp: template.signal === 'IMPULSE_UP' ? price + 6.0 : price - 6.0,
      },
    });
  }

  return decisions;
}

export function generateMockPositions(): EnginePosition[] {
  return [
    {
      id: 1,
      ticket: 9812401,
      symbol: 'XAUUSD',
      direction: 'BUY',
      volume: 0.5,
      entry_price: 2883.4,
      current_price: 2885.1,
      sl: 2880.4,
      tp: 2889.4,
      opened_at: new Date(Date.now() - 145000).toISOString(),
      closed_at: null,
      profit: 85.0,
      status: 'OPEN',
    },
    {
      id: 2,
      ticket: 9812402,
      symbol: 'XAUUSD',
      direction: 'BUY',
      volume: 0.5,
      entry_price: 2884.1,
      current_price: 2885.1,
      sl: 2881.1,
      tp: 2890.1,
      opened_at: new Date(Date.now() - 48000).toISOString(),
      closed_at: null,
      profit: 50.0,
      status: 'OPEN',
    },
    {
      id: 3,
      ticket: 9812389,
      symbol: 'XAUUSD',
      direction: 'SELL',
      volume: 0.5,
      entry_price: 2887.6,
      current_price: 2881.6,
      sl: 2890.6,
      tp: 2881.6,
      opened_at: new Date(Date.now() - 950000).toISOString(),
      closed_at: new Date(Date.now() - 320000).toISOString(),
      profit: 300.0,
      status: 'CLOSED',
    },
    {
      id: 4,
      ticket: 9812376,
      symbol: 'XAUUSD',
      direction: 'BUY',
      volume: 0.5,
      entry_price: 2880.2,
      current_price: 2886.2,
      sl: 2877.2,
      tp: 2886.2,
      opened_at: new Date(Date.now() - 1800000).toISOString(),
      closed_at: new Date(Date.now() - 1100000).toISOString(),
      profit: 300.0,
      status: 'CLOSED',
    },
    {
      id: 5,
      ticket: 9812361,
      symbol: 'XAUUSD',
      direction: 'BUY',
      volume: 0.5,
      entry_price: 2882.4,
      current_price: 2881.4,
      sl: 2881.4,
      tp: 2888.4,
      opened_at: new Date(Date.now() - 2700000).toISOString(),
      closed_at: new Date(Date.now() - 2300000).toISOString(),
      profit: -50.0,
      status: 'CLOSED',
    },
    {
      id: 6,
      ticket: 9812344,
      symbol: 'XAUUSD',
      direction: 'SELL',
      volume: 0.5,
      entry_price: 2889.0,
      current_price: 2883.0,
      sl: 2892.0,
      tp: 2883.0,
      opened_at: new Date(Date.now() - 3900000).toISOString(),
      closed_at: new Date(Date.now() - 3100000).toISOString(),
      profit: 300.0,
      status: 'CLOSED',
    },
  ];
}

export const INITIAL_STATIC_STATS: OverviewStats = {
  totalTicksToday: 142850,
  totalCandlesToday: 28410,
  executeCountToday: 38,
  blockCountToday: 214,
  activePositionsCount: 2,
  totalPnlToday: 985.0,
  currentSession: 'LONDON',
  dbStatus: 'mock',
  lastUpdated: '2026-10-08T12:00:00Z',
};

export function generateMockOverviewStats(nowTs?: number): OverviewStats {
  const decisions = generateMockDecisions(50);
  const executes = decisions.filter((d) => d.status === 'EXECUTE').length;
  const blocks = decisions.filter((d) => d.status === 'BLOCK').length;
  const updated = nowTs ? new Date(nowTs).toISOString() : new Date().toISOString();

  return {
    totalTicksToday: 142850,
    totalCandlesToday: 28410,
    executeCountToday: executes * 12 + 14,
    blockCountToday: blocks * 24 + 182,
    activePositionsCount: 2,
    totalPnlToday: 985.0,
    currentSession: getCurrentSessionUTC(),
    dbStatus: 'mock',
    lastUpdated: updated,
  };
}
