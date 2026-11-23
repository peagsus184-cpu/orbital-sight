import React from 'react';
import {
  CloudRain,
  Compass,
  Flame,
  Radio,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { CONDITION_TRIGGERS, SATELLITE_PASSES } from '../data/satellitePasses';
import type {
  AutoTriggerRule,
  ConditionType,
  SatellitePass,
  SatellitePassId,
  TelemetryHistoryPoint,
  TelemetryState,
} from '../types/satellite';

interface TriggerControlPanelProps {
  activePass: SatellitePass;
  telemetry: TelemetryState;
  history: TelemetryHistoryPoint[];
  autoRule: AutoTriggerRule;
  busyTrigger: ConditionType | null;
  expandedMode?: boolean;
  onSelectPass: (passId: SatellitePassId) => void;
  onTriggerCondition: (conditionId: ConditionType) => void;
  onUpdateAutoRule: (patch: Partial<AutoTriggerRule>) => void;
}

const TRIGGER_ICONS: Record<ConditionType, React.ReactNode> = {
  thermal_spike: <Flame className="w-3.5 h-3.5 shrink-0" />,
  orbit_slew: <Compass className="w-3.5 h-3.5 shrink-0" />,
  downlink_burst: <Radio className="w-3.5 h-3.5 shrink-0" />,
  cloud_mask: <CloudRain className="w-3.5 h-3.5 shrink-0" />,
  safe_mode: <ShieldAlert className="w-3.5 h-3.5 shrink-0" />,
  nominal: <RotateCcw className="w-3.5 h-3.5 shrink-0" />,
};

function TelemetrySparkline({ history }: { history: TelemetryHistoryPoint[] }) {
  if (history.length < 2) return null;
  const w = 280;
  const h = 58;
  const padX = 4;
  const padY = 6;

  const tempPoints = history.map((pt, i) => {
    const x = padX + (i / (history.length - 1)) * (w - padX * 2);
    const norm = Math.max(0, Math.min(1, (pt.payloadTempC - 10) / 80));
    const y = h - padY - norm * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const ratePoints = history.map((pt, i) => {
    const x = padX + (i / (history.length - 1)) * (w - padX * 2);
    const norm = Math.max(0, Math.min(1, pt.downlinkMbps / 1400));
    const y = h - padY - norm * (h - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
        <span>Thermal (°C) / Downlink (Mbps)</span>
        <span className="tabular-nums">
          {history[history.length - 1].payloadTempC.toFixed(1)}°C · {Math.round(history[history.length - 1].downlinkMbps)} Mbps
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-[58px] bg-[#07090E] border border-slate-800/90"
        aria-label="Live payload temperature and downlink telemetry trend"
      >
        <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
        <polyline
          fill="none"
          stroke="#06b6d4"
          strokeWidth="1.6"
          points={ratePoints.join(' ')}
        />
        <polyline
          fill="none"
          stroke="#f59e0b"
          strokeWidth="1.6"
          strokeDasharray="4 2"
          points={tempPoints.join(' ')}
        />
      </svg>
    </div>
  );
}

export function TriggerControlPanel({
  activePass,
  telemetry,
  history,
  autoRule,
  busyTrigger,
  expandedMode = false,
  onSelectPass,
  onTriggerCondition,
  onUpdateAutoRule,
}: TriggerControlPanelProps) {
  const thermalExceeded = telemetry.payloadTempC >= autoRule.thermalThresholdC;
  const cloudExceeded = telemetry.cloudCoverPct >= autoRule.cloudThresholdPct;

  return (
    <aside
      className={`${
        expandedMode
          ? 'w-full max-w-5xl mx-auto border-x border-slate-800'
          : 'w-full lg:w-[324px] xl:w-[344px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-800'
      } bg-[#0D111A] flex flex-col overflow-y-auto`}
    >
      {/* Section 1: Satellite Pass Selection */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
            Satellite Input Feed
          </h2>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {SATELLITE_PASSES.length} passes
          </span>
        </div>
        <div className={`grid gap-1.5 ${expandedMode ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1'}`}>
          {SATELLITE_PASSES.map((p) => {
            const isActive = activePass.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPass(p.id)}
                className={`w-full text-left px-3 py-2 rounded-md border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/12 border-cyan-500/60 text-slate-100'
                    : 'bg-[#090C12] border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-[#111622]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{p.name}</span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                    {p.satelliteId}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-400 truncate">
                  {p.region} · {p.gsdMeters.toFixed(2)} m GSD
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Satellite Condition Triggers */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
            Satellite Condition Triggers
          </h2>
          <span
            className={`text-xs font-mono ${
              telemetry.activeCondition === 'nominal'
                ? 'text-emerald-400'
                : telemetry.activeCondition === 'thermal_spike' ||
                    telemetry.activeCondition === 'safe_mode'
                  ? 'text-rose-400'
                  : 'text-amber-400'
            }`}
          >
            {telemetry.activeCondition === 'nominal'
              ? '● Nominal'
              : telemetry.activeCondition === 'thermal_spike' ||
                  telemetry.activeCondition === 'safe_mode'
                ? '✖ Fault Active'
                : '▲ Condition Set'}
          </span>
        </div>

        <div className={`grid gap-2 ${expandedMode ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2'}`}>
          {CONDITION_TRIGGERS.map((trg) => {
            const isActive = telemetry.activeCondition === trg.id;
            const isBusy = busyTrigger === trg.id;
            const activeStyle =
              trg.id === 'nominal'
                ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                : trg.targetSeverity === 'Critical'
                  ? 'bg-rose-500/15 border-rose-500/60 text-rose-200'
                  : trg.targetSeverity === 'Warning'
                    ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                    : 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200';

            return (
              <button
                key={trg.id}
                type="button"
                disabled={isBusy}
                onClick={() => onTriggerCondition(trg.id)}
                title={trg.shortDesc}
                className={`flex flex-col items-start gap-1 px-3 py-2.5 rounded-md border text-left transition-colors cursor-pointer disabled:opacity-60 ${
                  isActive
                    ? activeStyle
                    : 'bg-[#090C12] border-slate-800 text-slate-200 hover:border-slate-600 hover:bg-[#131926]'
                }`}
              >
                <div className="w-full flex items-center justify-between gap-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap truncate">
                    {TRIGGER_ICONS[trg.id]}
                    <span>{trg.label}</span>
                  </span>
                </div>
                <span className="text-[11px] font-mono text-slate-400 truncate w-full">
                  {isBusy ? 'Sending...' : isActive ? 'Active' : trg.subsystem}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Live Orbital Telemetry Metrics */}
      <div className="p-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
            Spacecraft Telemetry
          </h2>
          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
            {telemetry.shutterOpen ? 'Shutter Open' : 'Shutter Closed'}
          </span>
        </div>

        <div className={`grid gap-px bg-slate-800 border border-slate-800 ${expandedMode ? 'grid-cols-3 md:grid-cols-6' : 'grid-cols-2'}`}>
          <div className="bg-[#090C12] px-2.5 py-2">
            <div className="text-[11px] text-slate-400">Payload Temp</div>
            <div className="mt-0.5 flex items-baseline">
              <span
                className={`text-base font-mono font-semibold tabular-nums ${
                  thermalExceeded ? 'text-rose-400' : 'text-slate-100'
                }`}
              >
                {telemetry.payloadTempC.toFixed(1)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 ml-1">°C</span>
            </div>
          </div>

          <div className="bg-[#090C12] px-2.5 py-2">
            <div className="text-[11px] text-slate-400">X-Band Rate</div>
            <div className="mt-0.5 flex items-baseline">
              <span className="text-base font-mono font-semibold tabular-nums text-cyan-300">
                {Math.round(telemetry.downlinkMbps)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 ml-1">Mbps</span>
            </div>
          </div>

          <div className="bg-[#090C12] px-2.5 py-2">
            <div className="text-[11px] text-slate-400">Off-Nadir</div>
            <div className="mt-0.5 flex items-baseline">
              <span className="text-base font-mono font-semibold tabular-nums text-slate-100">
                {telemetry.offNadirDeg.toFixed(1)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 ml-1">deg</span>
            </div>
          </div>

          <div className="bg-[#090C12] px-2.5 py-2">
            <div className="text-[11px] text-slate-400">Cloud Cover</div>
            <div className="mt-0.5 flex items-baseline">
              <span
                className={`text-base font-mono font-semibold tabular-nums ${
                  cloudExceeded ? 'text-amber-400' : 'text-slate-100'
                }`}
              >
                {telemetry.cloudCoverPct.toFixed(0)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 ml-1">%</span>
            </div>
          </div>

          <div className="bg-[#090C12] px-2.5 py-2">
            <div className="text-[11px] text-slate-400">Altitude</div>
            <div className="mt-0.5 flex items-baseline">
              <span className="text-base font-mono font-semibold tabular-nums text-slate-100">
                {telemetry.altitudeKm.toFixed(1)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 ml-1">km</span>
            </div>
          </div>

          <div className="bg-[#090C12] px-2.5 py-2">
            <div className="text-[11px] text-slate-400">Battery SOC</div>
            <div className="mt-0.5 flex items-baseline">
              <span className="text-base font-mono font-semibold tabular-nums text-slate-100">
                {telemetry.batteryPct.toFixed(1)}
              </span>
              <span className="text-[11px] font-mono text-slate-400 ml-1">%</span>
            </div>
          </div>
        </div>

        <TelemetrySparkline history={history} />
      </div>

      {/* Section 4: Automated Condition Rules */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-slate-200 tracking-wide">
            Condition Thresholds
          </h2>
          <span
            className={`text-[11px] font-mono ${
              thermalExceeded || cloudExceeded ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {thermalExceeded || cloudExceeded ? '▲ Limit Breached' : '● Within Bounds'}
          </span>
        </div>

        <label className="flex items-center justify-between gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <span>Auto-run AI scan on trigger</span>
          <input
            type="checkbox"
            checked={autoRule.autoAnalyzeOnTrigger}
            onChange={(e) => onUpdateAutoRule({ autoAnalyzeOnTrigger: e.target.checked })}
            className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
          />
        </label>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="thermal-threshold" className="text-slate-400">
              Thermal alert limit
            </label>
            <span className="font-mono tabular-nums text-slate-200">
              {autoRule.thermalThresholdC} °C
            </span>
          </div>
          <input
            id="thermal-threshold"
            type="range"
            min={35}
            max={85}
            step={1}
            value={autoRule.thermalThresholdC}
            onChange={(e) => onUpdateAutoRule({ thermalThresholdC: Number(e.target.value) })}
            className="w-full accent-cyan-500 cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="cloud-threshold" className="text-slate-400">
              Cloud occlusion limit
            </label>
            <span className="font-mono tabular-nums text-slate-200">
              {autoRule.cloudThresholdPct} %
            </span>
          </div>
          <input
            id="cloud-threshold"
            type="range"
            min={20}
            max={90}
            step={5}
            value={autoRule.cloudThresholdPct}
            onChange={(e) => onUpdateAutoRule({ cloudThresholdPct: Number(e.target.value) })}
            className="w-full accent-cyan-500 cursor-pointer"
          />
        </div>
      </div>
    </aside>
  );
}
