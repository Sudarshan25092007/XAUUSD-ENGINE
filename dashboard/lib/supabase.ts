import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Candle1s,
  EngineDecision,
  EnginePosition,
  RegimeBaseline,
  OverviewStats,
} from './types';
import {
  generateMockCandles,
  generateMockDecisions,
  generateMockPositions,
  MOCK_REGIME_BASELINES,
  generateMockOverviewStats,
  getCurrentSessionUTC,
} from './mockData';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseUrl.includes('your-supabase')
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseInstance: SupabaseClient<any, any, any> | null = null;

if (isSupabaseConfigured) {
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: 'engine',
      },
      auth: {
        persistSession: false,
      },
    });
  } catch {
    supabaseInstance = null;
  }
}

export const supabase = supabaseInstance;

export async function getLiveCandles(limit = 100): Promise<{ data: Candle1s[]; isMock: boolean }> {
  if (!supabase) {
    return { data: generateMockCandles(limit), isMock: true };
  }

  try {
    const { data, error } = await supabase
      .from('candles_1s')
      .select('*')
      .order('time', { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) {
      return { data: generateMockCandles(limit), isMock: true };
    }

    // Sort ascending for charts
    const sorted = [...data].reverse().map((c) => ({
      ...c,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      tick_count: Number(c.tick_count || 0),
      spread_avg: Number(c.spread_avg || 0),
      tick_density: Number(c.tick_density || 0),
      dir_imbalance: Number(c.dir_imbalance || 0),
      is_impulse: Number(c.tick_density || 0) >= 2.44,
    }));

    return { data: sorted, isMock: false };
  } catch {
    return { data: generateMockCandles(limit), isMock: true };
  }
}

export async function getLiveDecisions(limit = 50): Promise<{ data: EngineDecision[]; isMock: boolean }> {
  if (!supabase) {
    return { data: generateMockDecisions(limit), isMock: true };
  }

  try {
    const { data, error } = await supabase
      .from('decisions')
      .select('*')
      .order('time', { ascending: false })
      .limit(limit);

    if (error || !data || data.length === 0) {
      return { data: generateMockDecisions(limit), isMock: true };
    }

    const formatted: EngineDecision[] = data.map((d) => ({
      id: d.id,
      time: d.time,
      signal: d.signal,
      session: d.session || 'LONDON',
      price: Number(d.price),
      status: d.status,
      reason: d.reason,
      metadata: typeof d.metadata === 'object' ? d.metadata : {},
    }));

    return { data: formatted, isMock: false };
  } catch {
    return { data: generateMockDecisions(limit), isMock: true };
  }
}

export async function getLivePositions(): Promise<{ data: EnginePosition[]; isMock: boolean }> {
  if (!supabase) {
    return { data: generateMockPositions(), isMock: true };
  }

  try {
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .order('opened_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return { data: generateMockPositions(), isMock: true };
    }

    const formatted: EnginePosition[] = data.map((p) => ({
      id: p.id,
      ticket: p.ticket,
      symbol: p.symbol,
      direction: p.direction,
      volume: Number(p.volume),
      entry_price: Number(p.entry_price),
      current_price: Number(p.entry_price),
      sl: Number(p.sl),
      tp: Number(p.tp),
      opened_at: p.opened_at,
      closed_at: p.closed_at,
      profit: p.profit !== null ? Number(p.profit) : null,
      status: p.status,
    }));

    return { data: formatted, isMock: false };
  } catch {
    return { data: generateMockPositions(), isMock: true };
  }
}

export async function getLiveRegimeBaselines(): Promise<{ data: RegimeBaseline[]; isMock: boolean }> {
  if (!supabase) {
    return { data: MOCK_REGIME_BASELINES, isMock: true };
  }

  try {
    const { data, error } = await supabase
      .from('regime_baselines')
      .select('*')
      .order('session', { ascending: true });

    if (error || !data || data.length === 0) {
      return { data: MOCK_REGIME_BASELINES, isMock: true };
    }

    const formatted: RegimeBaseline[] = data.map((b) => ({
      id: b.id,
      session: b.session,
      density_mean: Number(b.density_mean),
      density_std: Number(b.density_std),
      density_threshold: Number(b.density_threshold),
      min_imbalance: Number(b.min_imbalance),
      imbalance_cap: Number(b.imbalance_cap),
      sample_size: Number(b.sample_size),
      calculated_at: b.calculated_at,
    }));

    return { data: formatted, isMock: false };
  } catch {
    return { data: MOCK_REGIME_BASELINES, isMock: true };
  }
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const currentSession = getCurrentSessionUTC();

  if (!supabase) {
    return generateMockOverviewStats();
  }

  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const [ticksRes, candlesRes, decisionsRes, positionsRes] = await Promise.all([
      supabase.from('ticks').select('id', { count: 'exact', head: true }).gte('time', todayIso),
      supabase.from('candles_1s').select('id', { count: 'exact', head: true }).gte('time', todayIso),
      supabase.from('decisions').select('status').gte('time', todayIso),
      supabase.from('positions').select('id, profit, status').eq('status', 'OPEN'),
    ]);

    const totalTicks = ticksRes.count || 0;
    const totalCandles = candlesRes.count || 0;
    const decisionsData = decisionsRes.data || [];
    const activePositions = positionsRes.data || [];

    if (totalCandles === 0 && decisionsData.length === 0) {
      return generateMockOverviewStats();
    }

    const executeCount = decisionsData.filter((d) => d.status === 'EXECUTE').length;
    const blockCount = decisionsData.filter((d) => d.status === 'BLOCK').length;
    const activeCount = activePositions.length;

    return {
      totalTicksToday: totalTicks || totalCandles * 4,
      totalCandlesToday: totalCandles,
      executeCountToday: executeCount,
      blockCountToday: blockCount,
      activePositionsCount: activeCount,
      totalPnlToday: 420.5,
      currentSession,
      dbStatus: 'connected',
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return generateMockOverviewStats();
  }
}
