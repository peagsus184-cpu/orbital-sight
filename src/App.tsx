/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Scan } from 'lucide-react';
import { ActivityLogDock } from './components/ActivityLogDock';
import { AiInspectorPanel } from './components/AiInspectorPanel';
import {
  SatelliteCanvas,
  type SatelliteCanvasHandle,
} from './components/SatelliteCanvas';
import { TriggerControlPanel } from './components/TriggerControlPanel';
import { CONDITION_TRIGGERS, SATELLITE_PASSES } from './data/satellitePasses';
import type {
  ActivityLogEntry,
  AiAnalysisResult,
  AutoTriggerRule,
  ChatMessage,
  ConditionType,
  SatellitePass,
  SatellitePassId,
  SpectralBand,
  TelemetryHistoryPoint,
  TelemetryState,
  WorkspaceView,
} from './types/satellite';

function formatUtcShort(): string {
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}Z`;
}

function buildInitialHistory(base: TelemetryState): TelemetryHistoryPoint[] {
  const pts: TelemetryHistoryPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    pts.push({
      timeLabel: `-${i * 3}s`,
      payloadTempC: Number((base.payloadTempC + Math.sin(i * 0.6) * 0.7).toFixed(1)),
      downlinkMbps: Math.round(base.downlinkMbps + Math.cos(i * 0.5) * 18),
    });
  }
  return pts;
}

export default function App() {
  const [view, setView] = useState<WorkspaceView>('console');
  const [activePass, setActivePass] = useState<SatellitePass>(SATELLITE_PASSES[0]);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [band, setBand] = useState<SpectralBand>(SATELLITE_PASSES[0].defaultBand);
  const [telemetry, setTelemetry] = useState<TelemetryState>(
    SATELLITE_PASSES[0].baselineTelemetry
  );
  const [history, setHistory] = useState<TelemetryHistoryPoint[]>(() =>
    buildInitialHistory(SATELLITE_PASSES[0].baselineTelemetry)
  );
  const [autoRule, setAutoRule] = useState<AutoTriggerRule>({
    enabled: true,
    thermalThresholdC: 55,
    cloudThresholdPct: 60,
    autoAnalyzeOnTrigger: true,
  });

  const [busyTrigger, setBusyTrigger] = useState<ConditionType | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [streamPaused, setStreamPaused] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);

  const canvasRef = useRef<SatelliteCanvasHandle | null>(null);
  const pausedQueueRef = useRef<ActivityLogEntry[]>([]);
  const streamPausedRef = useRef(false);
  const initialScanFiredRef = useRef(false);

  useEffect(() => {
    streamPausedRef.current = streamPaused;
    if (!streamPaused && pausedQueueRef.current.length > 0) {
      const queued = pausedQueueRef.current;
      pausedQueueRef.current = [];
      setLogs((prev) => [...queued, ...prev].slice(0, 250));
    }
  }, [streamPaused]);

  // Connect to real-time SSE activity log stream from Express server
  useEffect(() => {
    const es = new EventSource('/api/events');

    es.onopen = () => {
      setSseConnected(true);
    };

    es.addEventListener('snapshot', (ev) => {
      try {
        const snapshot: ActivityLogEntry[] = JSON.parse((ev as MessageEvent).data);
        setLogs(snapshot);
        setSseConnected(true);
      } catch {
        // Ignore malformed snapshot frame
      }
    });

    es.addEventListener('log', (ev) => {
      try {
        const entry: ActivityLogEntry = JSON.parse((ev as MessageEvent).data);
        if (streamPausedRef.current) {
          pausedQueueRef.current = [entry, ...pausedQueueRef.current].slice(0, 100);
        } else {
          setLogs((prev) => [entry, ...prev].slice(0, 250));
        }
      } catch {
        // Ignore malformed log event
      }
    });

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
    };
  }, []);

  // Periodic live orbital telemetry drift & sparkline feed
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTelemetry((prev) => {
        const tempJitter = (Math.random() - 0.48) * 0.35;
        const rateJitter = (Math.random() - 0.5) * 14;
        const nextTemp = Number(
          Math.max(10, Math.min(92, prev.payloadTempC + tempJitter)).toFixed(1)
        );
        const nextRate = Math.max(
          48,
          Math.round(prev.downlinkMbps + (prev.activeCondition === 'safe_mode' ? 0 : rateJitter))
        );
        const nextBatt = Number(
          Math.max(
            20,
            Math.min(
              100,
              prev.batteryPct + (prev.activeCondition === 'downlink_burst' ? -0.12 : 0.02)
            )
          ).toFixed(1)
        );

        setHistory((h) => [
          ...h.slice(-17),
          {
            timeLabel: formatUtcShort(),
            payloadTempC: nextTemp,
            downlinkMbps: nextRate,
          },
        ]);

        return {
          ...prev,
          payloadTempC: nextTemp,
          downlinkMbps: nextRate,
          batteryPct: nextBatt,
        };
      });
    }, 2800);

    return () => window.clearInterval(timer);
  }, []);

  const recordOperatorLog = useCallback(
    async (
      command: string,
      message: string,
      severity: ActivityLogEntry['severity'] = 'Info',
      meta?: string
    ) => {
      try {
        await fetch('/api/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: 'OPERATOR',
            command,
            message,
            severity,
            meta,
          }),
        });
      } catch {
        // Non-blocking telemetry audit log
      }
    },
    []
  );

  // Execute real multimodal Gemini AI vision analysis on the current satellite canvas frame
  const runAiScan = useCallback(
    async (
      overridePass?: SatellitePass,
      overrideBand?: SpectralBand,
      overrideTelemetry?: TelemetryState
    ) => {
      const targetPass = overridePass ?? activePass;
      const targetBand = overrideBand ?? band;
      const targetTelemetry = overrideTelemetry ?? telemetry;

      const frameBase64 = canvasRef.current?.captureFrameBase64();
      if (!frameBase64) {
        setView('console');
        window.setTimeout(() => {
          const retryFrame = canvasRef.current?.captureFrameBase64();
          if (retryFrame) {
            runAiScan(targetPass, targetBand, targetTelemetry);
          }
        }, 250);
        return;
      }

      setIsScanning(true);
      setAnalysisError(null);
      setSelectedDetectionId(null);

      try {
        const response = await fetch('/api/satellite/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: frameBase64,
            mimeType: 'image/png',
            pass: targetPass,
            band: targetBand,
            telemetry: targetTelemetry,
          }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || `Scan failed with HTTP ${response.status}`);
        }
        setAnalysis(data.result as AiAnalysisResult);
      } catch (err) {
        setAnalysisError(err instanceof Error ? err.message : 'Unable to complete AI vision scan.');
      } finally {
        setIsScanning(false);
      }
    },
    [activePass, band, telemetry]
  );

  // Run one initial live AI scan right after first canvas paint so user sees live AI results
  useEffect(() => {
    if (initialScanFiredRef.current) return;
    initialScanFiredRef.current = true;
    const t = window.setTimeout(() => {
      runAiScan();
    }, 450);
    return () => window.clearTimeout(t);
  }, [runAiScan]);

  const handleSelectPass = (passId: SatellitePassId) => {
    const found = SATELLITE_PASSES.find((p) => p.id === passId);
    if (!found) return;
    setActivePass(found);
    setCustomImageUrl(null);
    setBand(found.defaultBand);
    setTelemetry(found.baselineTelemetry);
    setHistory(buildInitialHistory(found.baselineTelemetry));
    setSelectedDetectionId(null);
    recordOperatorLog(
      'OP_PASS_SELECT',
      `Switched active satellite feed to ${found.name} (${found.satelliteId}, ${found.defaultBand.toUpperCase()})`,
      'Info',
      `${found.region}`
    );
    window.setTimeout(() => {
      runAiScan(found, found.defaultBand, found.baselineTelemetry);
    }, 220);
  };

  const handleBandChange = (nextBand: SpectralBand) => {
    setBand(nextBand);
    recordOperatorLog(
      'OP_BAND_SWITCH',
      `Sensor spectral channel switched to ${nextBand.toUpperCase()} on ${activePass.satelliteId}`,
      'Info',
      activePass.name
    );
  };

  const handleUploadCustomImage = (dataUrl: string, fileName: string) => {
    const customPass: SatellitePass = {
      id: 'custom_upload',
      name: fileName.replace(/\.[^/.]+$/, '').slice(0, 32) || 'Uploaded Satellite Frame',
      satelliteId: 'ORB-EXT-USR',
      orbitNumber: 99001,
      region: 'Operator Uploaded Imagery',
      lat: 0.0,
      lon: 0.0,
      gsdMeters: 0.5,
      swathKm: 16.0,
      captureUtc: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
      description: 'Operator-supplied satellite or aerial image loaded for live AI inspection.',
      defaultBand: 'optical',
      baselineTelemetry: {
        ...activePass.baselineTelemetry,
        activeCondition: 'nominal',
        shutterOpen: true,
      },
    };
    setCustomImageUrl(dataUrl);
    setActivePass(customPass);
    setBand('optical');
    setTelemetry(customPass.baselineTelemetry);
    setSelectedDetectionId(null);
    recordOperatorLog(
      'OP_FRAME_UPLOAD',
      `Loaded custom satellite image "${fileName}" for AI vision analysis`,
      'Info',
      'Optical RGB'
    );
    window.setTimeout(() => {
      runAiScan(customPass, 'optical', customPass.baselineTelemetry);
    }, 320);
  };

  const handleTriggerCondition = async (conditionId: ConditionType) => {
    const def = CONDITION_TRIGGERS.find((c) => c.id === conditionId);
    if (!def) return;
    setBusyTrigger(conditionId);

    const base = activePass.baselineTelemetry;
    let nextTelemetry: TelemetryState;
    let nextBand = band;

    if (conditionId === 'thermal_spike') {
      nextTelemetry = {
        ...telemetry,
        payloadTempC: 76.4,
        busPowerW: 542,
        shutterOpen: true,
        activeCondition: 'thermal_spike',
      };
      nextBand = 'thermal';
    } else if (conditionId === 'orbit_slew') {
      nextTelemetry = {
        ...telemetry,
        offNadirDeg: 24.0,
        signalDbm: -84.8,
        shutterOpen: true,
        activeCondition: 'orbit_slew',
      };
    } else if (conditionId === 'downlink_burst') {
      nextTelemetry = {
        ...telemetry,
        downlinkMbps: 1280,
        busPowerW: 595,
        signalDbm: -72.4,
        shutterOpen: true,
        activeCondition: 'downlink_burst',
      };
    } else if (conditionId === 'cloud_mask') {
      nextTelemetry = {
        ...telemetry,
        cloudCoverPct: 74.0,
        shutterOpen: true,
        activeCondition: 'cloud_mask',
      };
      if (band === 'sar') nextBand = 'optical';
    } else if (conditionId === 'safe_mode') {
      nextTelemetry = {
        ...telemetry,
        shutterOpen: false,
        busPowerW: 145,
        downlinkMbps: 64,
        payloadTempC: 18.2,
        activeCondition: 'safe_mode',
      };
    } else {
      nextTelemetry = {
        ...base,
        activeCondition: 'nominal',
        shutterOpen: true,
      };
      nextBand = activePass.defaultBand;
    }

    setTelemetry(nextTelemetry);
    setBand(nextBand);
    setHistory((h) => [
      ...h.slice(-17),
      {
        timeLabel: formatUtcShort(),
        payloadTempC: nextTelemetry.payloadTempC,
        downlinkMbps: nextTelemetry.downlinkMbps,
      },
    ]);

    try {
      await fetch('/api/commands/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerId: def.id,
          command: def.command,
          label: def.label,
          satelliteId: activePass.satelliteId,
          subsystem: def.subsystem,
          telemetrySummary: `${nextTelemetry.payloadTempC.toFixed(1)}°C · ${Math.round(nextTelemetry.downlinkMbps)} Mbps`,
        }),
      });
    } catch {
      // Command bus error handled gracefully
    } finally {
      window.setTimeout(() => setBusyTrigger(null), 420);
    }

    if (autoRule.autoAnalyzeOnTrigger && canvasRef.current) {
      window.setTimeout(() => {
        runAiScan(activePass, nextBand, nextTelemetry);
      }, 360);
    }
  };

  const handleSendChat = async (text: string) => {
    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text,
      timestampUtc: formatUtcShort(),
    };
    const assistantId = `a_${Date.now() + 1}`;
    const placeholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestampUtc: formatUtcShort(),
      streaming: true,
    };

    const nextThread = [...chatMessages, userMsg];
    setChatMessages([...nextThread, placeholder]);
    setIsChatStreaming(true);

    try {
      const response = await fetch('/api/satellite/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextThread.map((m) => ({ role: m.role, content: m.content })),
          context: {
            pass: activePass,
            band,
            telemetry,
            latestAnalysis: analysis,
          },
        }),
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload?.error || `Chat request failed (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming response body unavailable.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.error) {
              throw new Error(evt.error);
            }
            if (typeof evt.text === 'string') {
              setChatMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + evt.text } : m
                )
              );
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr;
            }
          }
        }
      }

      setChatMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unable to reach AI mission analyst.';
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false, error: errMsg } : m
        )
      );
    } finally {
      setIsChatStreaming(false);
    }
  };

  const navItems: { id: WorkspaceView; label: string }[] = [
    { id: 'console', label: 'Console' },
    { id: 'detections', label: 'Detections' },
    { id: 'triggers', label: 'Triggers' },
    { id: 'logs', label: 'Activity Log' },
  ];

  const streamState: 'connected' | 'reconnecting' | 'paused' = streamPaused
    ? 'paused'
    : sseConnected
      ? 'connected'
      : 'reconnecting';

  return (
    <div className="min-h-screen lg:h-screen flex flex-col bg-[#07090E] text-slate-100 lg:overflow-hidden">
      {/* Top Bar Contract: Exactly 3 zones separated by gap-8 */}
      <header className="h-14 flex items-center justify-between gap-8 px-5 border-b border-slate-800 bg-[#0A0E16] shrink-0">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#console"
          onClick={(e) => {
            e.preventDefault();
            setView('console');
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          OrbitalSight
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav aria-label="Primary workspace views" className="hidden md:flex items-center gap-7 text-sm">
          {navItems.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={`py-1 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  active
                    ? 'text-cyan-300 border-cyan-400'
                    : 'text-slate-400 border-transparent hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary CTA action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => runAiScan()}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-60 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Scan className="w-3.5 h-3.5" />
            )}
            <span>{isScanning ? 'Scanning...' : 'Run AI Scan'}</span>
          </button>
        </div>
      </header>

      {/* Mobile compact view selector */}
      <div className="flex md:hidden items-center justify-around border-b border-slate-800 bg-[#0D111A] px-2 py-1.5">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setView(item.id)}
            className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
              view === item.id ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {view === 'console' && (
          <>
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
              <TriggerControlPanel
                activePass={activePass}
                telemetry={telemetry}
                history={history}
                autoRule={autoRule}
                busyTrigger={busyTrigger}
                onSelectPass={handleSelectPass}
                onTriggerCondition={handleTriggerCondition}
                onUpdateAutoRule={(patch) => setAutoRule((r) => ({ ...r, ...patch }))}
              />

              <SatelliteCanvas
                ref={canvasRef}
                pass={activePass}
                band={band}
                telemetry={telemetry}
                detections={analysis?.detections ?? []}
                selectedDetectionId={selectedDetectionId}
                isScanning={isScanning}
                customImageUrl={customImageUrl}
                onBandChange={handleBandChange}
                onSelectDetection={setSelectedDetectionId}
                onUploadCustomImage={handleUploadCustomImage}
                onRunScan={() => runAiScan()}
              />

              <AiInspectorPanel
                analysis={analysis}
                analysisError={analysisError}
                isScanning={isScanning}
                selectedDetectionId={selectedDetectionId}
                chatMessages={chatMessages}
                isChatStreaming={isChatStreaming}
                onSelectDetection={setSelectedDetectionId}
                onRunScan={() => runAiScan()}
                onExecuteRecommendedTrigger={handleTriggerCondition}
                onSendChat={handleSendChat}
                onClearChat={() => setChatMessages([])}
              />
            </div>

            <ActivityLogDock
              logs={logs}
              streamState={streamState}
              onTogglePause={() => setStreamPaused((p) => !p)}
            />
          </>
        )}

        {view === 'detections' && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-y-auto lg:overflow-hidden">
            <SatelliteCanvas
              ref={canvasRef}
              pass={activePass}
              band={band}
              telemetry={telemetry}
              detections={analysis?.detections ?? []}
              selectedDetectionId={selectedDetectionId}
              isScanning={isScanning}
              customImageUrl={customImageUrl}
              onBandChange={handleBandChange}
              onSelectDetection={setSelectedDetectionId}
              onUploadCustomImage={handleUploadCustomImage}
              onRunScan={() => runAiScan()}
            />

            <AiInspectorPanel
              analysis={analysis}
              analysisError={analysisError}
              isScanning={isScanning}
              selectedDetectionId={selectedDetectionId}
              chatMessages={chatMessages}
              isChatStreaming={isChatStreaming}
              wideMode
              onSelectDetection={setSelectedDetectionId}
              onRunScan={() => runAiScan()}
              onExecuteRecommendedTrigger={handleTriggerCondition}
              onSendChat={handleSendChat}
              onClearChat={() => setChatMessages([])}
            />
          </div>
        )}

        {view === 'triggers' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto bg-[#07090E]">
              <TriggerControlPanel
                activePass={activePass}
                telemetry={telemetry}
                history={history}
                autoRule={autoRule}
                busyTrigger={busyTrigger}
                expandedMode
                onSelectPass={handleSelectPass}
                onTriggerCondition={handleTriggerCondition}
                onUpdateAutoRule={(patch) => setAutoRule((r) => ({ ...r, ...patch }))}
              />
            </div>
            <ActivityLogDock
              logs={logs}
              streamState={streamState}
              onTogglePause={() => setStreamPaused((p) => !p)}
            />
          </div>
        )}

        {view === 'logs' && (
          <ActivityLogDock
            logs={logs}
            streamState={streamState}
            fullScreen
            onTogglePause={() => setStreamPaused((p) => !p)}
          />
        )}
      </main>
    </div>
  );
}
