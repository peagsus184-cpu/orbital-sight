import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_ID = 'gemini-4-hydrogen';

interface LogRecord {
  id: string;
  timestampUtc: string;
  source: 'UPLINK' | 'SATELLITE' | 'AI_ENGINE' | 'TRIGGER' | 'TELEMETRY' | 'OPERATOR';
  command: string;
  message: string;
  severity: 'Nominal' | 'Info' | 'Warning' | 'Critical';
  meta?: string;
}

const MAX_LOGS = 250;
const activityLogs: LogRecord[] = [];
const sseClients = new Set<express.Response>();

function formatUtcNow(): string {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}Z`;
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function emitLog(entry: Omit<LogRecord, 'id' | 'timestampUtc'>): LogRecord {
  const full: LogRecord = {
    id: makeId('log'),
    timestampUtc: formatUtcNow(),
    ...entry,
  };
  activityLogs.unshift(full);
  if (activityLogs.length > MAX_LOGS) {
    activityLogs.length = MAX_LOGS;
  }

  const payload = `event: log\ndata: ${JSON.stringify(full)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
  return full;
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your API key in the Settings > Secrets panel.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('GEMINI_API_KEY is not configured')) {
    return { status: 400, message: raw };
  }
  if (raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID') || raw.includes('403')) {
    return {
      status: 403,
      message:
        'Gemini API authentication failed. Please check or select a valid API key in the Settings > Secrets panel.',
    };
  }
  if (raw.includes('RESOURCE_EXHAUSTED') || raw.includes('429')) {
    return {
      status: 429,
      message:
        'Gemini API rate limit reached (429). Wait briefly or configure a billing-enabled key in Settings > Secrets.',
    };
  }
  return { status: 500, message: raw || 'Unexpected error communicating with Gemini API.' };
}

// Seed initial ground-station boot logs
emitLog({
  source: 'SATELLITE',
  command: 'SYS_GROUND_LINK_INIT',
  message: 'Ground segment telemetry bus synchronized with LEO constellation downlink',
  severity: 'Nominal',
  meta: 'ORB-EO-04A · X-Band Lock',
});
emitLog({
  source: 'TELEMETRY',
  command: 'TLM_EPHEMERIS_SYNC',
  message: 'Two-line element set validated; nadir pointing error within 0.04 deg tolerance',
  severity: 'Info',
  meta: 'ALT 518.4 km · INC 97.46 deg',
});

// Periodic real-time telemetry heartbeat while server is running
let heartbeatCounter = 0;
setInterval(() => {
  if (sseClients.size === 0) return;
  heartbeatCounter += 1;
  const snr = (14.1 + Math.sin(heartbeatCounter * 0.7) * 0.6).toFixed(1);
  const frameSeq = 40810 + heartbeatCounter;
  emitLog({
    source: 'TELEMETRY',
    command: 'TLM_BEACON_FRAME',
    message: `CCSDS telemetry frame #${frameSeq} verified — bus voltage nominal, link SNR ${snr} dB`,
    severity: 'Nominal',
    meta: `CRC OK · 2048 B`,
  });
}, 9000);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // SSE stream for real-time activity logs
  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: snapshot\ndata: ${JSON.stringify(activityLogs.slice(0, 80))}\n\n`);
    sseClients.add(res);

    const keepAlive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(keepAlive);
        sseClients.delete(res);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
      sseClients.delete(res);
    });
  });

  // Snapshot of recent logs
  app.get('/api/logs', (_req, res) => {
    res.json({ logs: activityLogs });
  });

  // Record operator UI action to real-time command log
  app.post('/api/logs', (req, res) => {
    const { source, command, message, severity, meta } = req.body ?? {};
    if (typeof command !== 'string' || typeof message !== 'string') {
      res.status(400).json({ error: 'command and message strings are required' });
      return;
    }
    const allowedSources = ['UPLINK', 'SATELLITE', 'AI_ENGINE', 'TRIGGER', 'TELEMETRY', 'OPERATOR'];
    const allowedSeverities = ['Nominal', 'Info', 'Warning', 'Critical'];
    const safeSource = allowedSources.includes(source) ? source : 'OPERATOR';
    const safeSeverity = allowedSeverities.includes(severity) ? severity : 'Info';

    const record = emitLog({
      source: safeSource,
      command: command.slice(0, 64),
      message: message.slice(0, 320),
      severity: safeSeverity,
      meta: typeof meta === 'string' ? meta.slice(0, 120) : undefined,
    });
    res.json({ log: record });
  });

  // Dispatch a real-time satellite condition trigger command pipeline
  app.post('/api/commands/trigger', (req, res) => {
    const { triggerId, command, label, satelliteId, subsystem, telemetrySummary } = req.body ?? {};
    if (typeof triggerId !== 'string' || typeof command !== 'string') {
      res.status(400).json({ error: 'triggerId and command are required' });
      return;
    }

    const sat = typeof satelliteId === 'string' ? satelliteId : 'ORB-EO-04A';
    const sub = typeof subsystem === 'string' ? subsystem : 'Flight Bus';
    const severityMap: Record<string, 'Nominal' | 'Info' | 'Warning' | 'Critical'> = {
      thermal_spike: 'Critical',
      safe_mode: 'Critical',
      orbit_slew: 'Warning',
      cloud_mask: 'Warning',
      downlink_burst: 'Info',
      nominal: 'Nominal',
    };
    const targetSeverity = severityMap[triggerId] ?? 'Info';

    const uplinkLog = emitLog({
      source: 'TRIGGER',
      command,
      message: `Operator triggered "${label ?? triggerId}" condition on ${sat} (${sub})`,
      severity: targetSeverity,
      meta: typeof telemetrySummary === 'string' ? telemetrySummary : `${sat} · S-Band Uplink`,
    });

    // Staged spacecraft acknowledgement & actuator execution logs streamed in real time
    setTimeout(() => {
      emitLog({
        source: 'UPLINK',
        command: `${command}_ACK`,
        message: `${sat} flight computer authenticated telecommand packet (auth key valid)`,
        severity: 'Info',
        meta: `RTT 184 ms · ${sub}`,
      });
    }, 180);

    setTimeout(() => {
      const execMessages: Record<string, string> = {
        thermal_spike: `LWIR focal plane array calibrated to high-dynamic range; thermal threshold breach active`,
        orbit_slew: `Reaction wheels slewed payload boresight to 24.0 deg off-nadir; pointing settled`,
        downlink_burst: `X-Band travelling wave tube amplifier engaged; downlink burst at 1,280 Mbps`,
        cloud_mask: `Optical swath cloud fraction surged to 74%; SAR C-Band recommended for penetration`,
        safe_mode: `Aperture shutter closed; non-essential payload rails shed to 145 W standby`,
        nominal: `All payload rails, shutter state, and nadir attitude restored to nominal baseline`,
      };
      emitLog({
        source: 'SATELLITE',
        command: `${command}_EXEC`,
        message: execMessages[triggerId] ?? `${sub} executed ${command} successfully`,
        severity: targetSeverity,
        meta: `${sat} · State Confirmed`,
      });
    }, 520);

    res.json({
      accepted: true,
      receiptId: uplinkLog.id,
      timestampUtc: uplinkLog.timestampUtc,
    });
  });

  // Multimodal Gemini AI analysis of satellite imagery + live telemetry
  app.post('/api/satellite/analyze', async (req, res) => {
    const startMs = Date.now();
    const { imageBase64, mimeType, pass, band, telemetry } = req.body ?? {};

    if (typeof imageBase64 !== 'string' || imageBase64.length < 32) {
      res.status(400).json({ error: 'Valid base64 satellite image frame is required.' });
      return;
    }

    const passName = pass?.name ?? 'Custom Satellite Frame';
    const satId = pass?.satelliteId ?? 'ORB-CUSTOM';
    const activeBand = typeof band === 'string' ? band : 'optical';
    const activeCondition = telemetry?.activeCondition ?? 'nominal';

    emitLog({
      source: 'AI_ENGINE',
      command: 'AI_VISION_SCAN_START',
      message: `Analyzing ${passName} (${activeBand.toUpperCase()} band, condition: ${activeCondition}) via ${MODEL_ID}`,
      severity: 'Info',
      meta: `${satId} · Multimodal Frame`,
    });

    try {
      const ai = getAiClient();
      const cleanedBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      const resolvedMime = typeof mimeType === 'string' && mimeType.startsWith('image/') ? mimeType : 'image/png';

      const telemetryBrief = [
        `Satellite: ${satId} | Pass: ${passName} | Region: ${pass?.region ?? 'Unknown'}`,
        `Coordinates: ${pass?.lat ?? 0}, ${pass?.lon ?? 0} | GSD: ${pass?.gsdMeters ?? 0.5} m/px`,
        `Spectral Band: ${activeBand} | Active Satellite Condition: ${activeCondition}`,
        `Payload Temp: ${telemetry?.payloadTempC ?? 25} C | Cloud Cover: ${telemetry?.cloudCoverPct ?? 10}% | Off-Nadir: ${telemetry?.offNadirDeg ?? 0} deg | Downlink: ${telemetry?.downlinkMbps ?? 600} Mbps | Shutter Open: ${telemetry?.shutterOpen ?? true}`,
      ].join('\n');

      const promptText = `You are an aerospace Earth Observation remote-sensing AI vision analyst.
Inspect the provided satellite imagery frame together with its live spacecraft telemetry below.

${telemetryBrief}

Provide a precise, factual operational assessment of what is visible in the satellite frame:
1. Identify 2 to 4 distinct visible spatial features, targets, or anomalies in the frame with accurate percentage bounding boxes [x, y, width, height] where x and y are the top-left corner (0-90) and width/height are box dimensions (8-45) matching where those visual features actually appear in the image.
2. If the aperture shutter is closed (safe_mode), report shutter-closed dark frame and recommend restoring nominal mode.
3. If dense cloud occlusion (cloud_mask) obscures the optical view, note the optical obstruction and recommend switching to SAR or clearing condition.
4. If a thermal hotspot or fire/heat signature is visible (or thermal_spike is active), localize it precisely with a bounding box and classify severity accurately.
5. Choose recommendedTriggerId strictly from: "nominal", "thermal_spike", "orbit_slew", "downlink_burst", "cloud_mask", "safe_mode".
Keep prose crisp, technical, and grounded strictly in the visual frame and telemetry.`;

      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: resolvedMime,
                data: cleanedBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              classification: {
                type: Type.STRING,
                description: 'Concise 3-7 word operational classification title.',
              },
              severity: {
                type: Type.STRING,
                description: 'Must be one of: Nominal, Advisory, Alert, Critical.',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Overall assessment confidence percentage from 0 to 100.',
              },
              summary: {
                type: Type.STRING,
                description: '2-3 crisp sentences summarizing visual and telemetry findings.',
              },
              spectralNotes: {
                type: Type.STRING,
                description: '1-2 sentences detailing spectral reflectance, thermal radiance, or radar signature.',
              },
              recommendedCommand: {
                type: Type.STRING,
                description: 'Short plain-English recommended spacecraft action.',
              },
              recommendedTriggerId: {
                type: Type.STRING,
                description: 'One of: nominal, thermal_spike, orbit_slew, downlink_burst, cloud_mask, safe_mode.',
              },
              detections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    category: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                    severity: {
                      type: Type.STRING,
                      description: 'One of: Nominal, Advisory, Alert, Critical.',
                    },
                    x: { type: Type.NUMBER, description: 'Left coordinate percentage 0-92.' },
                    y: { type: Type.NUMBER, description: 'Top coordinate percentage 0-92.' },
                    width: { type: Type.NUMBER, description: 'Width percentage 8-48.' },
                    height: { type: Type.NUMBER, description: 'Height percentage 8-48.' },
                    details: { type: Type.STRING },
                  },
                  required: ['label', 'category', 'confidence', 'severity', 'x', 'y', 'width', 'height', 'details'],
                },
              },
            },
            required: [
              'classification',
              'severity',
              'confidence',
              'summary',
              'spectralNotes',
              'recommendedCommand',
              'recommendedTriggerId',
              'detections',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText);
      const latencyMs = Date.now() - startMs;

      const validSeverities = ['Nominal', 'Advisory', 'Alert', 'Critical'] as const;
      const normalizeSev = (v: unknown): 'Nominal' | 'Advisory' | 'Alert' | 'Critical' =>
        typeof v === 'string' && (validSeverities as readonly string[]).includes(v)
          ? (v as 'Nominal' | 'Advisory' | 'Alert' | 'Critical')
          : 'Advisory';

      const validTriggers = [
        'nominal',
        'thermal_spike',
        'orbit_slew',
        'downlink_burst',
        'cloud_mask',
        'safe_mode',
      ] as const;
      const recommendedTriggerId =
        typeof parsed.recommendedTriggerId === 'string' &&
        (validTriggers as readonly string[]).includes(parsed.recommendedTriggerId)
          ? parsed.recommendedTriggerId
          : 'downlink_burst';

      const detections = Array.isArray(parsed.detections)
        ? parsed.detections.slice(0, 6).map((d: Record<string, unknown>, idx: number) => {
            const x = Math.max(2, Math.min(86, Number(d.x) || 15 + idx * 18));
            const y = Math.max(2, Math.min(84, Number(d.y) || 20 + idx * 15));
            const w = Math.max(8, Math.min(96 - x, Number(d.width) || 18));
            const h = Math.max(8, Math.min(96 - y, Number(d.height) || 18));
            return {
              id: `det_${idx + 1}`,
              label: String(d.label || `Feature #${idx + 1}`),
              category: String(d.category || 'Surface Target'),
              confidence: Math.max(1, Math.min(99.9, Number(d.confidence) || 88.5)),
              severity: normalizeSev(d.severity),
              bbox: [x, y, w, h] as [number, number, number, number],
              details: String(d.details || ''),
            };
          })
        : [];

      const result = {
        id: makeId('scan'),
        timestampUtc: formatUtcNow(),
        passId: pass?.id ?? 'custom_upload',
        passName,
        band: activeBand,
        condition: activeCondition,
        classification: String(parsed.classification || 'Satellite Frame Assessment'),
        severity: normalizeSev(parsed.severity),
        confidence: Math.max(1, Math.min(99.9, Number(parsed.confidence) || 91.2)),
        summary: String(parsed.summary || ''),
        spectralNotes: String(parsed.spectralNotes || ''),
        recommendedCommand: String(parsed.recommendedCommand || 'Maintain nominal orbital capture'),
        recommendedTriggerId,
        detections,
        latencyMs,
      };

      emitLog({
        source: 'AI_ENGINE',
        command: 'AI_VISION_SCAN_DONE',
        message: `${result.classification} — ${detections.length} features localized (${result.severity}, ${result.confidence.toFixed(1)}% conf)`,
        severity:
          result.severity === 'Critical'
            ? 'Critical'
            : result.severity === 'Alert' || result.severity === 'Advisory'
              ? 'Warning'
              : 'Nominal',
        meta: `${latencyMs} ms · ${MODEL_ID}`,
      });

      res.json({ result });
    } catch (err) {
      const formatted = formatGeminiError(err);
      emitLog({
        source: 'AI_ENGINE',
        command: 'AI_VISION_SCAN_ERR',
        message: formatted.message,
        severity: 'Critical',
        meta: `HTTP ${formatted.status}`,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // Streaming Gemini Mission Analyst Chat grounded in live satellite telemetry, AI results, and logs
  app.post('/api/satellite/chat', async (req, res) => {
    const { messages, context } = req.body ?? {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required.' });
      return;
    }

    const latestUserMsg = messages[messages.length - 1];
    const queryPreview = String(latestUserMsg?.content ?? '').slice(0, 90);

    emitLog({
      source: 'AI_ENGINE',
      command: 'AI_CHAT_QUERY',
      message: `Mission analyst query: "${queryPreview}${queryPreview.length >= 90 ? '...' : ''}"`,
      severity: 'Info',
      meta: `${context?.pass?.satelliteId ?? 'ORB-EO-04A'} · Stream`,
    });

    try {
      const ai = getAiClient();

      const recentLogSummary = activityLogs
        .slice(0, 8)
        .map((l) => `[${l.timestampUtc}] ${l.source} ${l.command} (${l.severity}): ${l.message}`)
        .join('\n');

      const analysisSummary = context?.latestAnalysis
        ? `Latest AI Scan (${context.latestAnalysis.timestampUtc}): ${context.latestAnalysis.classification} [${context.latestAnalysis.severity}, ${context.latestAnalysis.confidence}% conf]. Summary: ${context.latestAnalysis.summary} Recommended: ${context.latestAnalysis.recommendedCommand}. Detections: ${(context.latestAnalysis.detections ?? [])
            .map((d: { label: string; severity: string; confidence: number }) => `${d.label} (${d.severity}, ${d.confidence}%)`)
            .join('; ')}`
        : 'No AI vision scan has been executed yet on the active frame.';

      const systemInstruction = `You are the OrbitalSight Mission Operations AI Analyst assisting a satellite ground-station operator.
Answer concisely, accurately, and practically (2-5 short sentences or crisp bullet points unless the operator requests deeper detail).
Ground every answer in the live telemetry, latest AI vision scan, and recent command activity logs below. If the operator asks what trigger to run next, reference the exact available triggers: Thermal Spike, Orbit Slew, Downlink Burst, Cloud Mask, Safe Mode, or Reset Nominal.

LIVE SATELLITE STATE:
- Pass: ${context?.pass?.name ?? 'Unknown'} (${context?.pass?.satelliteId ?? 'ORB-EO-04A'})
- Region: ${context?.pass?.region ?? 'Unknown'} | Coordinates: ${context?.pass?.lat ?? 0}, ${context?.pass?.lon ?? 0}
- Active Spectral Band: ${context?.band ?? 'optical'}
- Active Condition: ${context?.telemetry?.activeCondition ?? 'nominal'}
- Telemetry: Alt ${context?.telemetry?.altitudeKm ?? 518} km, Off-Nadir ${context?.telemetry?.offNadirDeg ?? 0} deg, Payload Temp ${context?.telemetry?.payloadTempC ?? 24} C, Downlink ${context?.telemetry?.downlinkMbps ?? 640} Mbps, Battery ${context?.telemetry?.batteryPct ?? 90}%, Cloud Cover ${context?.telemetry?.cloudCoverPct ?? 8}%, Shutter Open: ${context?.telemetry?.shutterOpen ?? true}

LATEST AI VISION RESULTS:
${analysisSummary}

RECENT REAL-TIME SYSTEM COMMAND LOGS:
${recentLogSummary}`;

      const contents = messages.slice(-12).map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content ?? '') }],
      }));

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      const stream = await ai.models.generateContentStream({
        model: MODEL_ID,
        contents,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      let charCount = 0;
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          charCount += text.length;
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      emitLog({
        source: 'AI_ENGINE',
        command: 'AI_CHAT_COMPLETE',
        message: `Mission analyst response streamed (${charCount} chars)`,
        severity: 'Nominal',
        meta: MODEL_ID,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      emitLog({
        source: 'AI_ENGINE',
        command: 'AI_CHAT_ERR',
        message: formatted.message,
        severity: 'Critical',
        meta: `HTTP ${formatted.status}`,
      });
      if (!res.headersSent) {
        res.status(formatted.status).json({ error: formatted.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: formatted.message })}\n\n`);
        res.end();
      }
    }
  });

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OrbitalSight server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
