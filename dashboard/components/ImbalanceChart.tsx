'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { Candle1s, RegimeBaseline } from '@/lib/types';
import { Compass, Scale } from 'lucide-react';

interface ImbalanceChartProps {
  candles: Candle1s[];
  baseline: RegimeBaseline;
}

export const ImbalanceChart: React.FC<ImbalanceChartProps> = ({
  candles,
  baseline,
}) => {
  const displayData = candles.slice(-50).map((c) => ({
    time: c.time.slice(14, 19),
    imbalance: Number(c.dir_imbalance || 0),
    isBuyer: (c.dir_imbalance || 0) >= 0,
    isValidMomentum:
      Math.abs(c.dir_imbalance || 0) >= baseline.min_imbalance &&
      Math.abs(c.dir_imbalance || 0) <= baseline.imbalance_cap,
  }));

  const latestImbalance =
    displayData.length > 0 ? displayData[displayData.length - 1].imbalance : 0;
  const isBuyerDominant = latestImbalance > 0;
  const isCapped = Math.abs(latestImbalance) > baseline.imbalance_cap;
  const isChoppy = Math.abs(latestImbalance) < baseline.min_imbalance;

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 shadow-lg flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-blue-400" />
          <h2 className="font-mono text-sm font-bold text-white tracking-wide">
            DIRECTIONAL IMBALANCE
          </h2>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
            [-1.0, +1.0] DELTA
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            <span>Buyer Flow</span>
          </div>
          <div className="flex items-center gap-1 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
            <span>Seller Flow</span>
          </div>
        </div>
      </div>

      {/* Current Imbalance Status Strip */}
      <div className="flex items-center justify-between bg-[#161616] p-2 rounded-lg border border-[#262626] mb-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">Delta Value:</span>
          <span
            className={`font-bold text-sm ${
              isBuyerDominant ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {latestImbalance >= 0 ? '+' : ''}
            {(latestImbalance * 100).toFixed(1)}%
          </span>
        </div>

        <div>
          {isCapped ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
              <Scale className="w-3 h-3" /> TRAP CAP EXCEEDED ({baseline.imbalance_cap})
            </span>
          ) : isChoppy ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
              CHOPPY NOISE (&lt;{baseline.min_imbalance})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
              ACTIVE MOMENTUM CONFIRMED
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={displayData}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" stroke="#525252" fontSize={10} tickLine={false} />
            <YAxis
              stroke="#525252"
              fontSize={10}
              domain={[-1.0, 1.0]}
              tickLine={false}
              tickFormatter={(v) => `${Number(v).toFixed(1)}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-[#181818] border border-[#333333] p-2 rounded shadow-lg font-mono text-xs">
                      <div className="text-neutral-400">{data.time}</div>
                      <div
                        className={`font-bold ${
                          data.isBuyer ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        Imbalance: {data.imbalance >= 0 ? '+' : ''}
                        {(data.imbalance * 100).toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {data.isValidMomentum
                          ? 'Valid Directional Momentum'
                          : 'Filtered by Gating Bounds'}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Center zero line */}
            <ReferenceLine y={0} stroke="#404040" />

            {/* Imbalance Upper & Lower Caps */}
            <ReferenceLine
              y={baseline.imbalance_cap}
              stroke="#f59e0b"
              strokeDasharray="2 2"
              label={{
                value: `+Cap (${baseline.imbalance_cap})`,
                fill: '#f59e0b',
                fontSize: 9,
                position: 'right',
              }}
            />
            <ReferenceLine
              y={-baseline.imbalance_cap}
              stroke="#f59e0b"
              strokeDasharray="2 2"
              label={{
                value: `-Cap (-${baseline.imbalance_cap})`,
                fill: '#f59e0b',
                fontSize: 9,
                position: 'right',
              }}
            />

            {/* Choppy Filter Min Bands */}
            <ReferenceLine
              y={baseline.min_imbalance}
              stroke="#6b7280"
              strokeDasharray="1 3"
            />
            <ReferenceLine
              y={-baseline.min_imbalance}
              stroke="#6b7280"
              strokeDasharray="1 3"
            />

            <Bar dataKey="imbalance" radius={[2, 2, 2, 2]}>
              {displayData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.imbalance >= 0 ? '#10b981' : '#f43f5e'}
                  opacity={entry.isValidMomentum ? 0.9 : 0.35}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
