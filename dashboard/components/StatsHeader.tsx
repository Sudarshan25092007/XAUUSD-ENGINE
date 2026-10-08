'use client';

import React from 'react';
import { OverviewStats } from '@/lib/types';
import {
  Activity,
  Flame,
  ShieldAlert,
  Layers,
  Clock,
  Database,
  Radio,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';

interface StatsHeaderProps {
  stats: OverviewStats;
  isMockMode: boolean;
  onToggleMode: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const StatsHeader: React.FC<StatsHeaderProps> = ({
  stats,
  isMockMode,
  onToggleMode,
  onRefresh,
  isRefreshing,
}) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);
  const totalDecisions = stats.executeCountToday + stats.blockCountToday;
  const executeRatio =
    totalDecisions > 0
      ? Math.round((stats.executeCountToday / totalDecisions) * 100)
      : 0;

  const sessionColors: Record<string, string> = {
    LONDON: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    NEW_YORK: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
    TOKYO: 'text-purple-400 border-purple-500/40 bg-purple-500/10',
    SYDNEY: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#262626]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-lg shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            Au
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
                XAUUSD Market Microstructure Engine
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#1e293b] text-blue-400 border border-blue-500/30">
                PRO-DESK v2.4
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono">
              1-Second Telemetry • μ+1.5σ Statistical Gating • Adverse Selection Shield
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Live Indicator */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#141414] border border-[#262626] text-xs font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-neutral-300 font-medium">LIVE TELEMETRY</span>
            <span className="text-neutral-500 text-[10px]">
              {mounted ? new Date(stats.lastUpdated).toLocaleTimeString() : 'LIVE'}
            </span>
          </div>

          {/* Mode Switcher */}
          <button
            onClick={onToggleMode}
            className={`px-3 py-1.5 rounded-md text-xs font-mono transition border ${
              isMockMode
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20'
            }`}
            title="Toggle between Supabase Live Stream and Simulated Demo Stream"
          >
            {isMockMode ? 'Mode: Simulated Demo' : 'Mode: Live Supabase'}
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-md text-xs font-mono bg-[#1c1c1c] hover:bg-[#252525] border border-[#2e2e2e] text-neutral-200 transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Radio className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Poll (5s)</span>
          </button>
        </div>
      </div>

      {/* Grid of 6 Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Ticks Today */}
        <div className="bg-[#121212] border border-[#262626] rounded-lg p-3 hover:border-[#383838] transition shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Ticks Today</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {stats.totalTicksToday.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-neutral-500 mt-0.5 flex items-center gap-1">
            <span className="text-emerald-400">~3,000</span> ticks/min peak
          </div>
        </div>

        {/* Card 2: 1s Candles Today */}
        <div className="bg-[#121212] border border-[#262626] rounded-lg p-3 hover:border-[#383838] transition shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">1s Candles</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {stats.totalCandlesToday.toLocaleString()}
          </div>
          <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
            Sliding window synthesis
          </div>
        </div>

        {/* Card 3: Decisions EXECUTE vs BLOCK */}
        <div className="bg-[#121212] border border-[#262626] rounded-lg p-3 hover:border-[#383838] transition shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Signals Today</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {stats.executeCountToday}
            </span>
            <span className="text-xs font-mono text-neutral-400">/</span>
            <span className="text-sm font-mono text-rose-400">
              {stats.blockCountToday} blk
            </span>
          </div>
          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mt-1.5 flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-500"
              style={{ width: `${Math.min(100, executeRatio * 2)}%` }}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-500 flex-1"
            />
          </div>
        </div>

        {/* Card 4: Active Positions */}
        <div className="bg-[#121212] border border-[#262626] rounded-lg p-3 hover:border-[#383838] transition shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Positions</span>
            <TrendingUp className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-white">
              {stats.activePositionsCount}
            </span>
            <span className="text-xs font-mono text-emerald-400">
              +${stats.totalPnlToday.toFixed(1)}
            </span>
          </div>
          <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
            Ghost Buster 10s sync
          </div>
        </div>

        {/* Card 5: Current Session */}
        <div className="bg-[#121212] border border-[#262626] rounded-lg p-3 hover:border-[#383838] transition shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">Session</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-sm font-bold font-mono px-2 py-0.5 rounded border ${
                sessionColors[stats.currentSession] || 'text-white'
              }`}
            >
              {stats.currentSession}
            </span>
          </div>
          <div className="text-[10px] font-mono text-neutral-500 mt-1">
            {mounted ? `UTC ${new Date().toISOString().slice(11, 16)}` : 'UTC ACTIVE'}
          </div>
        </div>

        {/* Card 6: Database & Persistence Status */}
        <div className="bg-[#121212] border border-[#262626] rounded-lg p-3 hover:border-[#383838] transition shadow-sm">
          <div className="flex items-center justify-between text-neutral-400 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider">DB Persistence</span>
            <Database className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-center gap-1.5">
            {stats.dbStatus === 'connected' ? (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ONLINE (2s TO)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-400">
                <ShieldAlert className="w-3.5 h-3.5" />
                OFFLINE FALLBACK
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-neutral-500 mt-1">
            CSV buffer failover ready
          </div>
        </div>
      </div>
    </div>
  );
};
