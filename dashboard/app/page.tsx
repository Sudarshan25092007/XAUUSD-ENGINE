'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { StatsHeader } from '@/components/StatsHeader';
import { CandleChart } from '@/components/CandleChart';
import { DensityChart } from '@/components/DensityChart';
import { ImbalanceChart } from '@/components/ImbalanceChart';
import { DecisionsTable } from '@/components/DecisionsTable';
import { RegimeCards } from '@/components/RegimeCards';
import { PositionsPanel } from '@/components/PositionsPanel';

import {
  Candle1s,
  EngineDecision,
  EnginePosition,
  RegimeBaseline,
  OverviewStats,
} from '@/lib/types';
import {
  getLiveCandles,
  getLiveDecisions,
  getLivePositions,
  getLiveRegimeBaselines,
  getOverviewStats,
  isSupabaseConfigured,
} from '@/lib/supabase';
import {
  generateMockCandles,
  generateMockDecisions,
  generateMockPositions,
  MOCK_REGIME_BASELINES,
  generateMockOverviewStats,
  INITIAL_STATIC_STATS,
  getCurrentSessionUTC,
} from '@/lib/mockData';

export default function DashboardPage() {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isMockMode, setIsMockMode] = useState<boolean>(!isSupabaseConfigured);
  const [candles, setCandles] = useState<Candle1s[]>([]);
  const [decisions, setDecisions] = useState<EngineDecision[]>([]);
  const [positions, setPositions] = useState<EnginePosition[]>([]);
  const [baselines, setBaselines] = useState<RegimeBaseline[]>(MOCK_REGIME_BASELINES);
  const [stats, setStats] = useState<OverviewStats>(INITIAL_STATIC_STATS);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const activeSession = stats.currentSession || getCurrentSessionUTC();
  const currentBaseline =
    baselines.find((b) => b.session === activeSession) ||
    baselines[0] ||
    MOCK_REGIME_BASELINES[0];

  // Data fetching logic
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (isMockMode) {
        // Dynamic simulated live feed
        setCandles(generateMockCandles(100));
        setDecisions(generateMockDecisions(50));
        setPositions(generateMockPositions());
        setBaselines(MOCK_REGIME_BASELINES);
        setStats(generateMockOverviewStats());
      } else {
        const [candlesRes, decisionsRes, positionsRes, baselinesRes, statsRes] =
          await Promise.all([
            getLiveCandles(100),
            getLiveDecisions(50),
            getLivePositions(),
            getLiveRegimeBaselines(),
            getOverviewStats(),
          ]);

        setCandles(candlesRes.data);
        setDecisions(decisionsRes.data);
        setPositions(positionsRes.data);
        setBaselines(baselinesRes.data);
        setStats(statsRes);

        // If backend returned mock, update state
        if (candlesRes.isMock) {
          setIsMockMode(true);
        }
      }
    } catch {
      // Fallback gracefully on error
      setCandles(generateMockCandles(100));
      setDecisions(generateMockDecisions(50));
      setPositions(generateMockPositions());
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [isMockMode]);

  // Initial load
  useEffect(() => {
    setMounted(true);
    fetchData();
  }, [fetchData]);

  // 5-second Live Polling Loop
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchData]);

  const toggleMode = () => {
    setIsMockMode((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Top Banner for Demo State */}
      {isMockMode && (
        <div className="bg-amber-950/40 border-b border-amber-500/20 px-4 py-1.5 text-center text-xs font-mono text-amber-300 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-pulse"></span>
          <span>
            Prop Firm Live Demo Mode: Streaming synthesized 1-second ticks & decisions.
            {isSupabaseConfigured
              ? ' Supabase credentials detected — toggle mode above to query live tables.'
              : ' Set NEXT_PUBLIC_SUPABASE_URL to connect to live PostgreSQL.'}
          </span>
        </div>
      )}

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-3 sm:p-5 lg:p-6 space-y-5">
        {/* 1. Overview Header Stats */}
        <StatsHeader
          stats={stats}
          isMockMode={isMockMode}
          onToggleMode={toggleMode}
          onRefresh={fetchData}
          isRefreshing={isRefreshing}
        />

        {/* 2. Main 1-Second Candle Chart */}
        <section>
          <CandleChart candles={candles} />
        </section>

        {/* 3. Tick Density & Directional Imbalance Row */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <DensityChart candles={candles} baseline={currentBaseline} />
          <ImbalanceChart candles={candles} baseline={currentBaseline} />
        </section>

        {/* 4. Decisions Flight Recorder Table */}
        <section>
          <DecisionsTable decisions={decisions} />
        </section>

        {/* 5. Statistical Regime Baselines (μ & σ Cards) */}
        <section>
          <RegimeCards baselines={baselines} currentSession={activeSession} />
        </section>

        {/* 6. Active Positions & Execution Ledger */}
        <section>
          <PositionsPanel positions={positions} />
        </section>
      </main>

      {/* Terminal Footer */}
      <footer className="border-t border-[#1f1f1f] bg-[#0c0c0c] py-3 px-6 mt-8">
        <div className="max-w-[1720px] mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-neutral-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 font-bold">XAUUSD-ENGINE</span>
            <span>•</span>
            <span>MetaTrader 5 Low-Latency TCP Bridge (Port 5555)</span>
            <span>•</span>
            <span>Ghost Position Safety Heartbeat</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>Prop Firm Ready: Legion Funding / TopG Traders</span>
            <span>{mounted ? `UTC: ${new Date().toISOString().slice(11, 19)}` : 'UTC: ACTIVE'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
