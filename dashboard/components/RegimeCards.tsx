'use client';

import React from 'react';
import { RegimeBaseline, MarketSession } from '@/lib/types';
import { BarChart3, CheckCircle, Shield } from 'lucide-react';

interface RegimeCardsProps {
  baselines: RegimeBaseline[];
  currentSession: MarketSession;
}

export const RegimeCards: React.FC<RegimeCardsProps> = ({
  baselines,
  currentSession,
}) => {
  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <h2 className="font-mono text-sm font-bold text-white tracking-wide">
            STATISTICAL REGIME BASELINES (μ & σ CALIBRATION)
          </h2>
        </div>
        <span className="text-[11px] font-mono text-neutral-400">
          Source: offline_regime_analyzer.py
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {baselines.map((base) => {
          const isActive = base.session === currentSession;
          const safetyCap = Number((base.density_mean + base.density_std * 4).toFixed(2));

          return (
            <div
              key={base.session}
              className={`rounded-lg p-3.5 border transition ${
                isActive
                  ? 'bg-[#181818] border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40'
                  : 'bg-[#141414] border-[#262626] hover:border-[#383838]'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-bold text-sm text-white flex items-center gap-1.5">
                  {base.session}
                  {isActive && (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-mono">
                      ACTIVE
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-mono text-neutral-500">
                  N={base.sample_size.toLocaleString()}
                </span>
              </div>

              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between items-center text-neutral-400">
                  <span>Baseline Mean (μ):</span>
                  <span className="text-neutral-200 font-medium">
                    {base.density_mean.toFixed(2)} ticks/s
                  </span>
                </div>

                <div className="flex justify-between items-center text-neutral-400">
                  <span>Std Deviation (σ):</span>
                  <span className="text-neutral-200 font-medium">
                    ±{base.density_std.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-[#222]">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Gate (μ+1.5σ):
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {base.density_threshold.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-neutral-400">
                  <span className="text-rose-400 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Shield (μ+4σ):
                  </span>
                  <span className="text-rose-400 font-medium">
                    {safetyCap}
                  </span>
                </div>

                <div className="flex justify-between items-center text-neutral-400">
                  <span>Imbalance Cap:</span>
                  <span className="text-amber-400 font-medium">
                    ±{base.imbalance_cap.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-neutral-400 text-[10px] pt-1">
                  <span>Choppy Min Filter:</span>
                  <span className="text-neutral-300">
                    &gt;{base.min_imbalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
