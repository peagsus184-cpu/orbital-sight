import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Scan,
  Send,
  Trash2,
} from 'lucide-react';
import type {
  AiAnalysisResult,
  ChatMessage,
  ConditionType,
  SeverityLevel,
} from '../types/satellite';

interface AiInspectorPanelProps {
  analysis: AiAnalysisResult | null;
  analysisError: string | null;
  isScanning: boolean;
  selectedDetectionId: string | null;
  chatMessages: ChatMessage[];
  isChatStreaming: boolean;
  wideMode?: boolean;
  onSelectDetection: (id: string | null) => void;
  onRunScan: () => void;
  onExecuteRecommendedTrigger: (triggerId: ConditionType) => void;
  onSendChat: (text: string) => void;
  onClearChat: () => void;
}

type PanelMode = 'split' | 'results' | 'chat';

function formatSeverity(sev: SeverityLevel): { text: string; className: string } {
  if (sev === 'Critical') return { text: '✖ Critical', className: 'text-rose-400' };
  if (sev === 'Alert') return { text: '▲ Alert', className: 'text-amber-400' };
  if (sev === 'Advisory') return { text: '▲ Advisory', className: 'text-amber-300' };
  return { text: '● Nominal', className: 'text-emerald-400' };
}

const QUICK_PROMPTS = [
  'Summarize detected anomalies',
  'Recommend next satellite trigger',
  'Assess payload thermal risk',
];

export function AiInspectorPanel({
  analysis,
  analysisError,
  isScanning,
  selectedDetectionId,
  chatMessages,
  isChatStreaming,
  wideMode = false,
  onSelectDetection,
  onRunScan,
  onExecuteRecommendedTrigger,
  onSendChat,
  onClearChat,
}: AiInspectorPanelProps) {
  const [mode, setMode] = useState<PanelMode>('split');
  const [draft, setDraft] = useState('');
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned || isChatStreaming) return;
    setDraft('');
    onSendChat(cleaned);
  };

  const showResults = mode === 'split' || mode === 'results';
  const showChat = mode === 'split' || mode === 'chat';

  return (
    <aside
      className={`${
        wideMode
          ? 'w-full lg:w-[460px] shrink-0'
          : 'w-full lg:w-[390px] xl:w-[420px] shrink-0'
      } bg-[#0D111A] flex flex-col min-h-0 overflow-hidden`}
    >
      {/* Inspector Mode Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800 shrink-0">
        <h2 className="text-xs font-semibold text-slate-200 tracking-wide whitespace-nowrap">
          AI Results &amp; Analyst
        </h2>
        <div
          role="group"
          aria-label="Inspector view mode"
          className="flex items-center p-0.5 bg-[#07090E] border border-slate-800 rounded-md"
        >
          {(
            [
              { id: 'split', label: 'Split' },
              { id: 'results', label: 'Results' },
              { id: 'chat', label: 'AI Chat' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Pane: Structured AI Inference Results */}
      {showResults && (
        <div
          className={`${
            mode === 'split' ? 'flex-1 min-h-0 border-b border-slate-800' : 'flex-1 min-h-0'
          } overflow-y-auto p-4 space-y-4`}
        >
          {isScanning && (
            <div className="space-y-3" aria-busy="true">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Inspecting satellite imagery and telemetry...</span>
              </div>
              <div className="h-4 w-3/4 bg-slate-800/80 rounded animate-pulse" />
              <div className="h-12 w-full bg-slate-800/50 rounded animate-pulse" />
              <div className="space-y-2 pt-1">
                <div className="h-11 w-full bg-slate-800/60 rounded animate-pulse" />
                <div className="h-11 w-full bg-slate-800/60 rounded animate-pulse" />
              </div>
            </div>
          )}

          {!isScanning && analysisError && (
            <div className="p-3.5 bg-rose-950/30 border border-rose-800/70 rounded-md space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>AI Analysis Error</span>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed">{analysisError}</p>
              <button
                type="button"
                onClick={onRunScan}
                className="px-3 py-1.5 text-xs font-medium text-slate-100 bg-rose-700/70 hover:bg-rose-700 rounded transition-colors cursor-pointer"
              >
                Retry AI Scan
              </button>
            </div>
          )}

          {!isScanning && !analysis && !analysisError && (
            <div className="py-6 px-3 text-center border border-dashed border-slate-800 rounded-md space-y-2.5">
              <p className="text-sm font-medium text-slate-200">
                Ready for Satellite AI Analysis
              </p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                Run an AI vision scan on the active satellite pass to localize surface targets, thermal anomalies, and recommended spacecraft commands.
              </p>
              <button
                type="button"
                onClick={onRunScan}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors cursor-pointer"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Run AI Scan</span>
              </button>
            </div>
          )}

          {!isScanning && analysis && (
            <>
              {/* Classification Header & Metadata */}
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-semibold text-slate-100 leading-snug">
                    {analysis.classification}
                  </h3>
                  <span
                    className={`text-xs font-mono whitespace-nowrap shrink-0 ${
                      formatSeverity(analysis.severity).className
                    }`}
                  >
                    {formatSeverity(analysis.severity).text}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                  <span>Confidence {analysis.confidence.toFixed(1)}%</span>
                  <span aria-hidden="true">·</span>
                  <span>{analysis.band.toUpperCase()}</span>
                  <span aria-hidden="true">·</span>
                  <span>{analysis.latencyMs} ms</span>
                  <span aria-hidden="true">·</span>
                  <span>{analysis.timestampUtc}</span>
                </div>
              </div>

              {/* Assessment Prose */}
              <p className="text-xs text-slate-300 leading-relaxed">{analysis.summary}</p>

              {analysis.spectralNotes && (
                <div className="text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                  <span className="font-medium text-slate-300">Spectral notes: </span>
                  {analysis.spectralNotes}
                </div>
              )}

              {/* Recommended Operational Action */}
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 bg-[#090C12] border border-slate-800 rounded-md">
                <div className="min-w-0">
                  <div className="text-[11px] text-slate-400">Recommended action</div>
                  <div className="text-xs font-medium text-slate-200 truncate">
                    {analysis.recommendedCommand}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onExecuteRecommendedTrigger(analysis.recommendedTriggerId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Apply</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Localized Feature Detections */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">Localized Detections</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {analysis.detections.length} targets
                  </span>
                </div>
                <div className="divide-y divide-slate-800/90 border border-slate-800 bg-[#090C12]">
                  {analysis.detections.map((det, idx) => {
                    const isSel = selectedDetectionId === det.id;
                    const sev = formatSeverity(det.severity);
                    return (
                      <button
                        key={det.id}
                        type="button"
                        onClick={() => onSelectDetection(isSel ? null : det.id)}
                        className={`w-full text-left px-3 py-2 transition-colors cursor-pointer ${
                          isSel ? 'bg-cyan-500/12' : 'hover:bg-[#111722]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-100 truncate">
                            <span className="font-mono text-cyan-400 mr-1.5">
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            {det.label}
                          </span>
                          <span className={`text-[11px] font-mono whitespace-nowrap shrink-0 ${sev.className}`}>
                            {sev.text}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-400">
                          <span>{det.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{det.confidence.toFixed(1)}%</span>
                        </div>
                        {det.details && (
                          <p className="mt-1 text-[11px] text-slate-400 leading-snug">
                            {det.details}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom Pane: AI Mission Analyst Chat Box */}
      {showChat && (
        <div
          className={`${
            mode === 'split' ? 'h-[290px] xl:h-[315px] shrink-0' : 'flex-1 min-h-0'
          } flex flex-col bg-[#090C12]`}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#0D111A] shrink-0">
            <span className="text-xs font-semibold text-slate-200">
              AI Mission Chat
            </span>
            <button
              type="button"
              onClick={onClearChat}
              disabled={chatMessages.length === 0 || isChatStreaming}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 disabled:opacity-40 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>

          {/* Chat Transcript */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {chatMessages.length === 0 ? (
              <div className="space-y-2.5">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Ask the AI analyst about current satellite imagery, telemetry readings, anomaly risk, or recommended commands.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isChatStreaming}
                      onClick={() => onSendChat(q)}
                      className="px-2.5 py-1.5 text-xs text-slate-300 bg-[#131926] hover:bg-slate-800 border border-slate-800 rounded transition-colors text-left cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className={msg.role === 'assistant' ? 'text-cyan-400' : 'text-slate-300'}>
                      {msg.role === 'assistant' ? 'AI Analyst' : 'Operator'}
                    </span>
                    <span className="tabular-nums">{msg.timestampUtc}</span>
                  </div>
                  <div
                    className={`text-xs leading-relaxed whitespace-pre-wrap px-3 py-2 rounded-md border ${
                      msg.error
                        ? 'bg-rose-950/30 border-rose-800/70 text-rose-200'
                        : msg.role === 'assistant'
                          ? 'bg-[#0E131D] border-slate-800 text-slate-200'
                          : 'bg-cyan-500/10 border-cyan-500/30 text-slate-100'
                    }`}
                  >
                    {msg.error ? msg.error : msg.content || (msg.streaming ? 'Thinking...' : '')}
                    {msg.streaming && (
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 align-middle animate-pulse" />
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-800 bg-[#0D111A] shrink-0"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask AI about satellite feed or commands..."
              disabled={isChatStreaming}
              className="flex-1 min-w-0 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 bg-[#07090E] border border-slate-800 focus:border-cyan-500/70 focus:outline-none rounded-md"
            />
            <button
              type="submit"
              disabled={isChatStreaming || !draft.trim()}
              aria-label="Send message to AI analyst"
              className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 rounded-md transition-colors shrink-0 cursor-pointer"
            >
              {isChatStreaming ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </form>
        </div>
      )}
    </aside>
  );
}
