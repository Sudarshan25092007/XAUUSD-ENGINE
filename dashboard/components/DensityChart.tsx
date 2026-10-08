'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { Candle1s, RegimeBaseline } from '@/lib/types';
import { Activity, ShieldCheck, Zap } from 'lucide-react';

interface DensityChartProps {
  candles: Candle1s[];
  baseline: RegimeBaseline;
}

export const DensityChart: React.FC<DensityChartProps> = ({
  candles,
  baseline,
}) => {
  const displayData = candles.slice(-50).map((c) => ({
    time: c.time.slice(14, 19),
    density: Number(c.tick_density || 0),
    isImpulse: Number(c.tick_density || 0) >= baseline.density_threshold,
    open: c.open,
    close: c.close,
  }));

  const currentDensity =
    displayData.length > 0 ? displayData[displayData.length - 1].density : 0;
  const safetyCap = Number((baseline.density_mean + baseline.density_std * 4).toFixed(2));
  const isAboveThreshold = currentDensity >= baseline.density_threshold;
  const isAboveShield = currentDensity >= safetyCap;

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 shadow-lg flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h2 className="font-mono text-sm font-bold text-white tracking-wide">
            TICK DENSITY SPECTRUM
          </h2>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
            60s SLIDING WINDOW
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
            <span>Threshold: {baseline.density_threshold.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block"></span>
            <span>Shield: {safetyCap.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Current Density Status Strip */}
      <div className="flex items-center justify-between bg-[#161616] p-2 rounded-lg border border-[#262626] mb-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <span className="text-neutral-400">Current Density:</span>
          <span
            className={`font-bold text-sm ${
              isAboveShield
                ? 'text-rose-400'
                : isAboveThreshold
                ? 'text-emerald-400'
                : 'text-neutral-200'
            }`}
          >
            {currentDensity.toFixed(2)} ticks/sec
          </span>
        </div>

        <div>
          {isAboveShield ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold">
              <ShieldCheck className="w-3 h-3" /> μ+4σ DENSITY SHIELD ACTIVE
            </span>
          ) : isAboveThreshold ? (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold animate-pulse">
              <Zap className="w-3 h-3" /> μ+1.5σ IMPULSE DETECTED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-neutral-800 text-neutral-400">
              NORMAL REGIME (Noise Filter)
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayData}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="time" stroke="#525252" fontSize={10} tickLine={false} />
            <YAxis
              stroke="#525252"
              fontSize={10}
              domain={[0, Math.max(safetyCap + 0.8, 4.5)]}
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
                      <div className="text-emerald-400 font-bold">
                        Density: {data.density.toFixed(2)} ticks/s
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        {data.isImpulse ? '⚡ Statistically Gated Impulse' : 'Sub-threshold noise'}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* μ+1.5σ Threshold line */}
            <ReferenceLine
              y={baseline.density_threshold}
              stroke="#10b981"
              strokeDasharray="4 4"
              label={{
                value: `μ+1.5σ (${baseline.density_threshold.toFixed(2)})`,
                fill: '#10b981',
                fontSize: 10,
                position: 'right',
              }}
            />
            {/* μ+4σ Safety Shield line */}
            <ReferenceLine
              y={safetyCap}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{
                value: `Shield (${safetyCap.toFixed(2)})`,
                fill: '#ef4444',
                fontSize: 10,
                position: 'right',
              }}
            />
            <Line
              type="monotone"
              dataKey="density"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (payload.isImpulse) {
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                  );
                }
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={0} />;
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
