'use client';

import React, { useState } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Candle1s } from '@/lib/types';
import { TrendingUp, TrendingDown, Layers } from 'lucide-react';

interface CandleChartProps {
  candles: Candle1s[];
}

export const CandleChart: React.FC<CandleChartProps> = ({ candles }) => {
  const [range, setRange] = useState<30 | 60 | 100>(100);

  const displayCandles = candles.slice(-range).map((c) => ({
    ...c,
    formattedTime: c.time.slice(14, 19) + '.' + c.time.slice(20, 22),
    spreadFormatted: (c.spread_avg || 0).toFixed(2),
  }));

  const latestCandle = displayCandles[displayCandles.length - 1] || null;
  const previousCandle =
    displayCandles.length > 1
      ? displayCandles[displayCandles.length - 2]
      : latestCandle;

  const priceDiff =
    latestCandle && previousCandle
      ? latestCandle.close - previousCandle.close
      : 0;

  const minPrice =
    displayCandles.length > 0
      ? Math.min(...displayCandles.map((c) => c.low || c.close)) - 0.5
      : 2880;
  const maxPrice =
    displayCandles.length > 0
      ? Math.max(...displayCandles.map((c) => c.high || c.close)) + 0.5
      : 2890;

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 shadow-lg">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-2 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-white text-base">XAUUSD</span>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              1-SEC TELEMETRY
            </span>
          </div>

          {latestCandle && (
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-xl font-bold text-white tracking-tight">
                ${latestCandle.close.toFixed(2)}
              </span>
              <span
                className={`text-xs font-semibold flex items-center gap-0.5 ${
                  priceDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {priceDiff >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {priceDiff >= 0 ? '+' : ''}
                {priceDiff.toFixed(2)} pts
              </span>
              <span className="text-neutral-500 text-xs">
                Spread: {latestCandle.spreadFormatted}
              </span>
            </div>
          )}
        </div>

        {/* Range selectors */}
        <div className="flex items-center gap-1 bg-[#181818] p-1 rounded-lg border border-[#262626]">
          <span className="text-[11px] font-mono text-neutral-400 px-2 flex items-center gap-1">
            <Layers className="w-3 h-3" /> Window:
          </span>
          {[30, 60, 100].map((val) => (
            <button
              key={val}
              onClick={() => setRange(val as 30 | 60 | 100)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition ${
                range === val
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {val}s
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={displayCandles}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="formattedTime"
              stroke="#525252"
              fontSize={10}
              tickLine={false}
              minTickGap={20}
            />
            <YAxis
              yAxisId="price"
              domain={[minPrice, maxPrice]}
              orientation="right"
              stroke="#525252"
              fontSize={10}
              tickFormatter={(v) => `$${Number(v).toFixed(1)}`}
              tickLine={false}
            />
            <YAxis
              yAxisId="volume"
              domain={[0, 30]}
              orientation="left"
              stroke="#404040"
              fontSize={9}
              tickLine={false}
              hide
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload as Candle1s;
                  return (
                    <div className="bg-[#181818]/95 border border-[#333333] p-2.5 rounded-lg shadow-xl font-mono text-xs text-neutral-200">
                      <div className="text-neutral-400 text-[11px] mb-1 pb-1 border-b border-neutral-800">
                        {data.time.replace('T', ' ').slice(0, 22)} UTC
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        <span className="text-neutral-400">Open:</span>
                        <span className="text-white text-right font-medium">
                          ${data.open.toFixed(2)}
                        </span>
                        <span className="text-neutral-400">High:</span>
                        <span className="text-emerald-400 text-right font-medium">
                          ${data.high.toFixed(2)}
                        </span>
                        <span className="text-neutral-400">Low:</span>
                        <span className="text-rose-400 text-right font-medium">
                          ${data.low.toFixed(2)}
                        </span>
                        <span className="text-neutral-400">Close:</span>
                        <span className="text-white text-right font-bold">
                          ${data.close.toFixed(2)}
                        </span>
                        <span className="text-neutral-400">Ticks:</span>
                        <span className="text-blue-400 text-right font-bold">
                          {data.tick_count}
                        </span>
                        <span className="text-neutral-400">Spread:</span>
                        <span className="text-neutral-300 text-right">
                          {data.spread_avg.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* Tick Count Bar Chart overlay at the bottom */}
            <Bar
              yAxisId="volume"
              dataKey="tick_count"
              fill="#2563eb"
              opacity={0.35}
              radius={[2, 2, 0, 0]}
            />
            {/* High-frequency 1s price wave */}
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="close"
              stroke="#10b981"
              strokeWidth={1.8}
              fillOpacity={1}
              fill="url(#priceGradient)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Footer bar */}
      <div className="flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-2 border-t border-[#1e1e1e]">
        <span>Aggregated at 1,000ms sliding boundaries</span>
        <span>Recharts Native High-Frequency Streaming Stream</span>
      </div>
    </div>
  );
};
