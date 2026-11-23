import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Pause,
  Play,
  Search,
} from 'lucide-react';
import type { ActivityLogEntry, LogSeverity } from '../types/satellite';

interface ActivityLogDockProps {
  logs: ActivityLogEntry[];
  streamState: 'connected' | 'reconnecting' | 'paused';
  fullScreen?: boolean;
  onTogglePause: () => void;
}

type LogFilter = 'ALL' | 'TRIGGERS' | 'COMMANDS' | 'AI' | 'TELEMETRY';

function formatLogSeverity(sev: LogSeverity): { label: string; className: string } {
  if (sev === 'Critical') return { label: '✖ Critical', className: 'text-rose-400' };
  if (sev === 'Warning') return { label: '▲ Warning', className: 'text-amber-400' };
  if (sev === 'Nominal') return { label: '● Nominal', className: 'text-emerald-400' };
  return { label: '· Info', className: 'text-cyan-400' };
}

export function ActivityLogDock({
  logs,
  streamState,
  fullScreen = false,
  onTogglePause,
}: ActivityLogDockProps) {
  const [filter, setFilter] = useState<LogFilter>('ALL');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filteredLogs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter((entry) => {
      if (filter === 'TRIGGERS' && entry.source !== 'TRIGGER') return false;
      if (
        filter === 'COMMANDS' &&
        entry.source !== 'UPLINK' &&
        entry.source !== 'SATELLITE' &&
        entry.source !== 'OPERATOR'
      ) {
        return false;
      }
      if (filter === 'AI' && entry.source !== 'AI_ENGINE') return false;
      if (filter === 'TELEMETRY' && entry.source !== 'TELEMETRY') return false;

      if (!q) return true;
      return (
        entry.command.toLowerCase().includes(q) ||
        entry.message.toLowerCase().includes(q) ||
        entry.source.toLowerCase().includes(q) ||
        (entry.meta ?? '').toLowerCase().includes(q)
      );
    });
  }, [logs, filter, query]);

  const handleExportCsv = () => {
    const header = ['UTC_Timestamp', 'Source', 'Command', 'Severity', 'Message', 'Meta'];
    const rows = filteredLogs.map((l) => [
      l.timestampUtc,
      l.source,
      l.command,
      l.severity,
      `"${l.message.replace(/"/g, '""')}"`,
      `"${(l.meta ?? '').replace(/"/g, '""')}"`,
    ]);
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orbitalsight_command_log_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      aria-label="Real-time system command activity logs"
      className={`flex flex-col bg-[#080B11] border-t border-slate-800 ${
        fullScreen ? 'flex-1 min-h-0' : expanded ? 'h-[380px] shrink-0' : 'h-[224px] shrink-0'
      }`}
    >
      {/* Log Dock Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-slate-800 bg-[#0D111A] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-xs font-semibold text-slate-200 whitespace-nowrap">
            Real-Time Command Activity Logs
          </h2>
          <span
            className={`text-xs font-mono whitespace-nowrap ${
              streamState === 'connected'
                ? 'text-emerald-400'
                : streamState === 'paused'
                  ? 'text-amber-400'
                  : 'text-rose-400'
            }`}
          >
            {streamState === 'connected'
              ? '● Live stream'
              : streamState === 'paused'
                ? '○ Stream paused'
                : '▲ Reconnecting'}
          </span>
          <span className="text-xs font-mono tabular-nums text-slate-400 hidden sm:inline">
            {filteredLogs.length} / {logs.length} events
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Functional Filter Tabs */}
          <div
            role="group"
            aria-label="Filter command logs"
            className="flex items-center p-0.5 bg-[#07090E] border border-slate-800 rounded-md"
          >
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'TRIGGERS', label: 'Triggers' },
                { id: 'COMMANDS', label: 'Commands' },
                { id: 'AI', label: 'AI Engine' },
                { id: 'TELEMETRY', label: 'Telemetry' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === f.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter commands..."
              aria-label="Filter system command logs"
              className="w-36 sm:w-44 pl-8 pr-2.5 py-1 text-xs text-slate-200 placeholder:text-slate-500 bg-[#07090E] border border-slate-800 focus:border-cyan-500/60 focus:outline-none rounded-md"
            />
          </div>

          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#151C28] hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {streamState === 'paused' ? (
              <>
                <Play className="w-3 h-3" />
                <span>Resume</span>
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" />
                <span>Pause</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-300 bg-[#151C28] hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            <span>Export CSV</span>
          </button>

          {!fullScreen && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Collapse activity log tray' : 'Expand activity log tray'}
              className="inline-flex items-center justify-center p-1.5 text-slate-300 bg-[#151C28] hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors cursor-pointer"
            >
              {expanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* High-Density Monospace Log Table */}
      <div className="flex-1 overflow-auto font-mono text-xs tabular-nums">
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 font-sans text-xs">
            No activity log entries match the active filter.
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-[#0B0F17] text-[11px] text-slate-400 border-b border-slate-800 z-10">
              <tr>
                <th className="py-1.5 pl-4 pr-3 font-medium whitespace-nowrap w-[112px]">UTC Time</th>
                <th className="py-1.5 px-3 font-medium whitespace-nowrap w-[96px]">Source</th>
                <th className="py-1.5 px-3 font-medium whitespace-nowrap w-[210px]">Command</th>
                <th className="py-1.5 px-3 font-medium whitespace-nowrap w-[98px]">Status</th>
                <th className="py-1.5 px-3 font-medium">Activity Details</th>
                <th className="py-1.5 pl-3 pr-4 font-medium text-right whitespace-nowrap hidden xl:table-cell">
                  Telemetry Meta
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.map((entry) => {
                const sev = formatLogSeverity(entry.severity);
                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-800/35 transition-colors"
                  >
                    <td className="py-1.5 pl-4 pr-3 text-slate-400 whitespace-nowrap">
                      {entry.timestampUtc}
                    </td>
                    <td className="py-1.5 px-3 text-slate-300 whitespace-nowrap">
                      {entry.source}
                    </td>
                    <td className="py-1.5 px-3 text-cyan-300 font-medium whitespace-nowrap">
                      {entry.command}
                    </td>
                    <td className={`py-1.5 px-3 whitespace-nowrap ${sev.className}`}>
                      {sev.label}
                    </td>
                    <td className="py-1.5 px-3 text-slate-200 font-sans text-xs">
                      {entry.message}
                    </td>
                    <td className="py-1.5 pl-3 pr-4 text-right text-slate-400 whitespace-nowrap hidden xl:table-cell">
                      {entry.meta ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
