'use client';

import React, { useState } from 'react';
import { EnginePosition } from '@/lib/types';
import { ShieldCheck, TrendingUp, TrendingDown, Clock, Check } from 'lucide-react';

interface PositionsPanelProps {
  positions: EnginePosition[];
}

export const PositionsPanel: React.FC<PositionsPanelProps> = ({ positions }) => {
  const [tab, setTab] = useState<'OPEN' | 'CLOSED'>('OPEN');

  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const closedPositions = positions.filter((p) => p.status === 'CLOSED');
  const activeList = tab === 'OPEN' ? openPositions : closedPositions;

  const totalOpenPnl = openPositions.reduce(
    (acc, curr) => acc + (curr.profit || 0),
    0
  );

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 shadow-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-4 h-4 text-purple-400" />
          <div>
            <h2 className="font-mono text-sm font-bold text-white tracking-wide flex items-center gap-2">
              POSITION RECONCILIATION & EXECUTION
            </h2>
            <span className="text-[10px] font-mono text-neutral-400">
              10s SYNC_POSITIONS Heartbeat Protocol • Zero Ghost Positions
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2">
          {tab === 'OPEN' && (
            <span className="text-xs font-mono text-neutral-400 mr-2">
              Unrealized PnL:{' '}
              <span
                className={`font-bold ${
                  totalOpenPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {totalOpenPnl >= 0 ? '+' : ''}${totalOpenPnl.toFixed(2)}
              </span>
            </span>
          )}

          <div className="flex bg-[#181818] p-0.5 rounded-lg border border-[#2e2e2e] text-xs font-mono">
            <button
              onClick={() => setTab('OPEN')}
              className={`px-3 py-1 rounded transition ${
                tab === 'OPEN'
                  ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Open ({openPositions.length})
            </button>
            <button
              onClick={() => setTab('CLOSED')}
              className={`px-3 py-1 rounded transition ${
                tab === 'CLOSED'
                  ? 'bg-neutral-700 text-white font-bold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Closed History ({closedPositions.length})
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-[#222222] text-neutral-400 text-[11px] uppercase tracking-wider">
              <th className="py-2 px-3">Ticket</th>
              <th className="py-2 px-3">Symbol</th>
              <th className="py-2 px-3">Direction</th>
              <th className="py-2 px-3">Lots</th>
              <th className="py-2 px-3">Entry Price</th>
              <th className="py-2 px-3">Stop Loss</th>
              <th className="py-2 px-3">Take Profit</th>
              <th className="py-2 px-3">Opened At</th>
              <th className="py-2 px-3 text-right">Profit / PnL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1c1c1c]">
            {activeList.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-6 text-center text-neutral-500">
                  {tab === 'OPEN'
                    ? 'No open positions. All trades flat.'
                    : 'No historical closed positions found.'}
                </td>
              </tr>
            ) : (
              activeList.map((pos) => {
                const isBuy = pos.direction === 'BUY';
                const pnl = pos.profit ?? 0;

                return (
                  <tr key={pos.ticket} className="hover:bg-[#181818] transition">
                    <td className="py-2.5 px-3 text-neutral-300">
                      #{pos.ticket}
                    </td>
                    <td className="py-2.5 px-3 text-white font-bold">
                      {pos.symbol}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                          isBuy
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {isBuy ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {pos.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-neutral-200">
                      {pos.volume.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-white font-medium">
                      ${pos.entry_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-rose-400">
                      ${pos.sl.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-400">
                      ${pos.tp.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                      {pos.opened_at.replace('T', ' ').slice(11, 19)} UTC
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span
                        className={pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                      >
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
