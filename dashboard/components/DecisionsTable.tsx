'use client';

import React, { useState, useMemo } from 'react';
import { EngineDecision, DecisionStatus } from '@/lib/types';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Terminal,
} from 'lucide-react';

interface DecisionsTableProps {
  decisions: EngineDecision[];
}

export const DecisionsTable: React.FC<DecisionsTableProps> = ({ decisions }) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | DecisionStatus>('ALL');
  const [sessionFilter, setSessionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredDecisions = useMemo(() => {
    return decisions.filter((d) => {
      if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
      if (sessionFilter !== 'ALL' && d.session !== sessionFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesReason = d.reason.toLowerCase().includes(query);
        const matchesSignal = d.signal.toLowerCase().includes(query);
        const matchesPrice = d.price.toString().includes(query);
        if (!matchesReason && !matchesSignal && !matchesPrice) return false;
      }
      return true;
    });
  }, [decisions, statusFilter, sessionFilter, searchQuery]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="bg-[#121212] border border-[#262626] rounded-xl p-4 shadow-lg">
      {/* Table Header and Control bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 mb-3 border-b border-[#222222]">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-emerald-400" />
          <div>
            <h2 className="font-mono text-base font-bold text-white flex items-center gap-2">
              DECISIONS AUDIT LOG
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-normal">
                Flight Recorder
              </span>
            </h2>
            <p className="text-xs text-neutral-400 font-mono">
              Live audit of μ+1.5σ impulses, circuit breaker blocks, and execution events
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search reason or price..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-[#181818] border border-[#303030] text-xs font-mono rounded-lg pl-8 pr-3 py-1.5 text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
            />
          </div>

          {/* Status filters */}
          <div className="flex items-center bg-[#181818] p-0.5 rounded-lg border border-[#303030] text-xs font-mono">
            {(['ALL', 'EXECUTE', 'BLOCK'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded transition text-xs ${
                  statusFilter === status
                    ? status === 'EXECUTE'
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                      : status === 'BLOCK'
                      ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                      : 'bg-neutral-700 text-white font-bold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Session filters */}
          <div className="flex items-center bg-[#181818] px-2 py-1 rounded-lg border border-[#303030] text-xs font-mono text-neutral-400">
            <Filter className="w-3 h-3 mr-1 text-neutral-500" />
            <select
              value={sessionFilter}
              onChange={(e) => setSessionFilter(e.target.value)}
              className="bg-transparent text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Sessions</option>
              <option value="LONDON">London</option>
              <option value="NEW_YORK">New York</option>
              <option value="TOKYO">Tokyo</option>
              <option value="SYDNEY">Sydney</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-[#222222] text-neutral-400 text-[11px] uppercase tracking-wider">
              <th className="py-2 px-2 w-8"></th>
              <th className="py-2 px-3">Time (UTC)</th>
              <th className="py-2 px-3">Signal</th>
              <th className="py-2 px-3">Session</th>
              <th className="py-2 px-3">Price</th>
              <th className="py-2 px-3">Gate Status</th>
              <th className="py-2 px-3">Engineering Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1c1c1c]">
            {filteredDecisions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-500">
                  No decisions matching the selected filter criteria.
                </td>
              </tr>
            ) : (
              filteredDecisions.slice(0, 50).map((d) => {
                const isExpanded = expandedId === d.id;
                const isExecute = d.status === 'EXECUTE';
                const isUp = d.signal.includes('UP') || d.signal === 'BUY';

                return (
                  <React.Fragment key={d.id}>
                    <tr
                      onClick={() => toggleExpand(d.id)}
                      className={`hover:bg-[#181818] cursor-pointer transition ${
                        isExpanded ? 'bg-[#181818]' : ''
                      }`}
                    >
                      <td className="py-2.5 px-2 text-neutral-500">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-300 whitespace-nowrap">
                        {d.time.replace('T', ' ').slice(11, 23)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isUp
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          }`}
                        >
                          {isUp ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {d.signal}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-400 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[11px]">
                          {d.session}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold whitespace-nowrap">
                        ${d.price.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold border ${
                            isExecute
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                          }`}
                        >
                          {isExecute ? (
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-400" />
                          )}
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-neutral-300 max-w-md truncate">
                        {d.reason}
                      </td>
                    </tr>

                    {/* Expandable JSON / Telemetry Metadata Row */}
                    {isExpanded && (
                      <tr className="bg-[#151515] border-b border-[#222222]">
                        <td colSpan={7} className="p-3 pl-8">
                          <div className="bg-[#0e0e0e] border border-[#2a2a2a] rounded-lg p-3 text-xs space-y-2">
                            <div className="flex items-center justify-between text-neutral-400 pb-1.5 border-b border-[#1f1f1f]">
                              <span className="font-bold text-neutral-200">
                                Decision Record #{d.id} Telemetry Snapshot
                              </span>
                              <span>Timestamp: {d.time}</span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                              <div className="bg-[#141414] p-2 rounded border border-[#222]">
                                <span className="text-neutral-500 text-[10px] block">
                                  TICK DENSITY
                                </span>
                                <span className="text-emerald-400 font-bold">
                                  {d.metadata?.tick_density?.toFixed(4) ?? 'N/A'} ticks/s
                                </span>
                              </div>
                              <div className="bg-[#141414] p-2 rounded border border-[#222]">
                                <span className="text-neutral-500 text-[10px] block">
                                  REGIME THRESHOLD
                                </span>
                                <span className="text-neutral-300 font-bold">
                                  {d.metadata?.density_threshold?.toFixed(4) ?? 'N/A'} (μ+1.5σ)
                                </span>
                              </div>
                              <div className="bg-[#141414] p-2 rounded border border-[#222]">
                                <span className="text-neutral-500 text-[10px] block">
                                  DIRECTIONAL IMBALANCE
                                </span>
                                <span className="text-blue-400 font-bold">
                                  {d.metadata?.dir_imbalance !== undefined
                                    ? `${(d.metadata.dir_imbalance * 100).toFixed(1)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="bg-[#141414] p-2 rounded border border-[#222]">
                                <span className="text-neutral-500 text-[10px] block">
                                  NEWS CIRCUIT BREAKER
                                </span>
                                <span
                                  className={`font-bold ${
                                    d.metadata?.news_active
                                      ? 'text-rose-400'
                                      : 'text-neutral-400'
                                  }`}
                                >
                                  {d.metadata?.news_active ? 'ACTIVE (BLOCKED)' : 'CLEAR'}
                                </span>
                              </div>
                            </div>

                            <div className="text-[11px] text-neutral-400 pt-1">
                              <span className="text-neutral-500">Full Raw Payload: </span>
                              <code className="text-emerald-400 bg-black/40 px-1 py-0.5 rounded">
                                {JSON.stringify(d.metadata)}
                              </code>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
