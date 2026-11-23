import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Crosshair,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Scan,
  Upload,
} from 'lucide-react';
import { SPECTRAL_BANDS } from '../data/satellitePasses';
import type {
  AiDetection,
  SatellitePass,
  SpectralBand,
  TelemetryState,
} from '../types/satellite';

export interface SatelliteCanvasHandle {
  captureFrameBase64: () => string | null;
}

interface SatelliteCanvasProps {
  pass: SatellitePass;
  band: SpectralBand;
  telemetry: TelemetryState;
  detections: AiDetection[];
  selectedDetectionId: string | null;
  isScanning: boolean;
  customImageUrl: string | null;
  onBandChange: (band: SpectralBand) => void;
  onSelectDetection: (id: string | null) => void;
  onUploadCustomImage: (dataUrl: string, fileName: string) => void;
  onRunScan: () => void;
}

const CANVAS_W = 960;
const CANVAS_H = 540;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPortShippingScene(ctx: CanvasRenderingContext2D) {
  const rand = mulberry32(4109);
  // Deep maritime channel water
  const seaGrad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  seaGrad.addColorStop(0, '#071c2e');
  seaGrad.addColorStop(0.55, '#0b2942');
  seaGrad.addColorStop(1, '#081b2c');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle bathymetry wave bands
  ctx.strokeStyle = 'rgba(56, 130, 178, 0.09)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 36; i++) {
    ctx.beginPath();
    const y0 = i * 16;
    ctx.moveTo(0, y0);
    ctx.bezierCurveTo(320, y0 + 18, 640, y0 - 16, CANVAS_W, y0 + 8);
    ctx.stroke();
  }

  // Reclaimed port peninsula landmass (left & bottom-left)
  ctx.fillStyle = '#2d3438';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(395, 0);
  ctx.lineTo(368, 128);
  ctx.lineTo(448, 152);
  ctx.lineTo(432, 230);
  ctx.lineTo(320, 224);
  ctx.lineTo(302, 336);
  ctx.lineTo(418, 362);
  ctx.lineTo(405, 448);
  ctx.lineTo(255, 440);
  ctx.lineTo(240, CANVAS_H);
  ctx.lineTo(0, CANVAS_H);
  ctx.closePath();
  ctx.fill();

  // Coastal concrete seawall edge
  ctx.strokeStyle = '#68747c';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Container terminal blocks (multicolor stacked TEUs)
  const containerColors = ['#8a3b2c', '#29577a', '#9c6f2d', '#3e6352', '#5b6670', '#a34a39'];
  const drawYard = (x0: number, y0: number, cols: number, rows: number) => {
    ctx.fillStyle = '#3a4248';
    ctx.fillRect(x0 - 6, y0 - 6, cols * 16 + 12, rows * 7 + 12);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() > 0.14) {
          ctx.fillStyle = containerColors[Math.floor(rand() * containerColors.length)];
          ctx.fillRect(x0 + c * 16, y0 + r * 7, 13, 4.5);
        }
      }
    }
  };
  drawYard(38, 28, 18, 12);
  drawYard(44, 156, 21, 10);
  drawYard(30, 344, 17, 12);

  // Port access roads
  ctx.strokeStyle = '#1b2024';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 136);
  ctx.lineTo(362, 136);
  ctx.moveTo(160, 0);
  ctx.lineTo(160, 540);
  ctx.stroke();

  // Fuel storage tank farm (circular bright tanks - thermal hotspots)
  const tanks = [
    [92, 274, 20],
    [142, 274, 20],
    [192, 274, 20],
    [92, 316, 18],
    [142, 316, 18],
    [192, 316, 18],
    [244, 294, 22],
  ];
  for (const [cx, cy, rad] of tanks) {
    ctx.fillStyle = '#20262b';
    ctx.beginPath();
    ctx.arc(cx + 3, cy + 3, rad + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8d0d6';
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#6c7780';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#9aa5ae';
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, rad * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // Quay gantry cranes along pier edges
  ctx.fillStyle = '#d48238';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(364 + i * 11, 146, 5, 22);
    ctx.fillRect(318 + i * 14, 346, 5, 20);
  }

  // Cargo vessels in shipping channel with crisp wakes
  const drawVessel = (x: number, y: number, len: number, wid: number, angle: number, hull: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Wake cone
    const wakeGrad = ctx.createLinearGradient(-len * 2.2, 0, -len * 0.4, 0);
    wakeGrad.addColorStop(0, 'rgba(180, 222, 245, 0)');
    wakeGrad.addColorStop(1, 'rgba(215, 238, 250, 0.45)');
    ctx.fillStyle = wakeGrad;
    ctx.beginPath();
    ctx.moveTo(-len * 0.45, -wid * 0.35);
    ctx.lineTo(-len * 2.3, -wid * 1.6);
    ctx.lineTo(-len * 2.3, wid * 1.6);
    ctx.lineTo(-len * 0.45, wid * 0.35);
    ctx.closePath();
    ctx.fill();

    // Hull
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(len * 0.5, 0);
    ctx.lineTo(len * 0.25, -wid * 0.5);
    ctx.lineTo(-len * 0.5, -wid * 0.45);
    ctx.lineTo(-len * 0.5, wid * 0.45);
    ctx.lineTo(len * 0.25, wid * 0.5);
    ctx.closePath();
    ctx.fill();

    // Deck containers + bridge
    ctx.fillStyle = '#c45b3e';
    ctx.fillRect(-len * 0.34, -wid * 0.32, len * 0.46, wid * 0.64);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-len * 0.44, -wid * 0.34, len * 0.1, wid * 0.68);
    ctx.restore();
  };

  drawVessel(595, 162, 118, 20, -0.18, '#2b333a');
  drawVessel(768, 286, 134, 23, 0.34, '#362e2d');
  drawVessel(556, 396, 94, 17, -0.42, '#243440');
  drawVessel(828, 108, 86, 15, 0.14, '#383b40');
  // Docked berth ship
  drawVessel(446, 186, 78, 16, 1.57, '#2d3740');
}

function drawWildfireRidgeScene(ctx: CanvasRenderingContext2D) {
  const rand = mulberry32(8217);
  // Dark alpine conifer valley base
  const terrainGrad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  terrainGrad.addColorStop(0, '#16241b');
  terrainGrad.addColorStop(0.45, '#1d2d20');
  terrainGrad.addColorStop(1, '#232b1e');
  ctx.fillStyle = terrainGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Mountain elevation ridges and topographic shadow folds
  for (let i = 0; i < 24; i++) {
    const x0 = rand() * CANVAS_W;
    const y0 = rand() * CANVAS_H;
    const rad = 70 + rand() * 140;
    const g = ctx.createRadialGradient(x0, y0, 4, x0, y0, rad);
    g.addColorStop(0, i % 2 === 0 ? 'rgba(46, 68, 44, 0.42)' : 'rgba(12, 18, 14, 0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0 - rad, y0 - rad, rad * 2, rad * 2);
  }

  // Conifer forest canopy stipple
  for (let i = 0; i < 1600; i++) {
    const x = rand() * CANVAS_W;
    const y = rand() * CANVAS_H;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(34, 54, 34, 0.48)' : 'rgba(18, 30, 20, 0.52)';
    ctx.fillRect(x, y, 3, 3);
  }

  // Winding mountain river cutting across valley
  ctx.strokeStyle = '#183c54';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(760, 0);
  ctx.bezierCurveTo(700, 140, 810, 260, 680, 390);
  ctx.bezierCurveTo(610, 460, 660, 500, 610, CANVAS_H);
  ctx.stroke();
  ctx.strokeStyle = '#2d5c78';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Burn scar charred polygon behind active front
  ctx.fillStyle = '#161414';
  ctx.beginPath();
  ctx.moveTo(155, 290);
  ctx.quadraticCurveTo(240, 215, 365, 248);
  ctx.quadraticCurveTo(448, 286, 422, 392);
  ctx.quadraticCurveTo(312, 462, 198, 412);
  ctx.quadraticCurveTo(126, 355, 155, 290);
  ctx.closePath();
  ctx.fill();

  // Glowing active wildfire ridge perimeter (intense thermal radiance)
  const firePoints: [number, number][] = [
    [258, 238],
    [318, 232],
    [372, 256],
    [418, 294],
    [438, 344],
    [414, 394],
    [362, 426],
  ];
  // Outer heat halo
  ctx.strokeStyle = 'rgba(234, 88, 12, 0.55)';
  ctx.lineWidth = 22;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  firePoints.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();

  // Core incandescent fire front
  ctx.strokeStyle = '#ff922b';
  ctx.lineWidth = 9;
  ctx.stroke();
  ctx.strokeStyle = '#fff3bf';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // Secondary spot fire ignition northeast of river
  const spotGrad = ctx.createRadialGradient(545, 224, 2, 545, 224, 26);
  spotGrad.addColorStop(0, '#fff4cc');
  spotGrad.addColorStop(0.35, '#f97316');
  spotGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
  ctx.fillStyle = spotGrad;
  ctx.beginPath();
  ctx.arc(545, 224, 26, 0, Math.PI * 2);
  ctx.fill();

  // Diagonal wind-blown smoke plume sweeping northeast
  for (let i = 0; i < 18; i++) {
    const px = 345 + i * 32;
    const py = 290 - i * 16 + Math.sin(i * 0.8) * 14;
    const pr = 38 + i * 8.5;
    const sg = ctx.createRadialGradient(px, py, 6, px, py, pr);
    sg.addColorStop(0, `rgba(203, 213, 225, ${Math.max(0.08, 0.34 - i * 0.014)})`);
    sg.addColorStop(1, 'rgba(148, 163, 184, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPolarGlacierScene(ctx: CanvasRenderingContext2D) {
  const rand = mulberry32(9321);
  // Deep polar ocean
  const sea = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  sea.addColorStop(0, '#071324');
  sea.addColorStop(1, '#0b1e36');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Sea ice brash scatter in ocean
  for (let i = 0; i < 650; i++) {
    const x = 420 + rand() * 540;
    const y = rand() * CANVAS_H;
    const w = 2 + rand() * 8;
    ctx.fillStyle = `rgba(186, 218, 240, ${0.08 + rand() * 0.22})`;
    ctx.fillRect(x, y, w, w * 0.6);
  }

  // Massive coastal glacier ice shelf (left & top)
  const shelfGrad = ctx.createLinearGradient(0, 0, 560, CANVAS_H);
  shelfGrad.addColorStop(0, '#dce8f2');
  shelfGrad.addColorStop(0.6, '#b8d0e4');
  shelfGrad.addColorStop(1, '#8fb2cc');
  ctx.fillStyle = shelfGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(590, 0);
  ctx.lineTo(548, 92);
  ctx.lineTo(486, 152);
  ctx.lineTo(525, 245);
  ctx.lineTo(440, 326);
  ctx.lineTo(492, 412);
  ctx.lineTo(396, 488);
  ctx.lineTo(368, CANVAS_H);
  ctx.lineTo(0, CANVAS_H);
  ctx.closePath();
  ctx.fill();

  // Deep glacial flow ridges
  ctx.strokeStyle = 'rgba(100, 140, 175, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 22 * i + 20);
    ctx.quadraticCurveTo(220, 26 * i - 10, 460, 24 * i + 45);
    ctx.stroke();
  }

  // Primary fracture crevasse network (critical calving rift)
  ctx.strokeStyle = '#0e4a6b';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(310, 118);
  ctx.lineTo(356, 174);
  ctx.lineTo(334, 248);
  ctx.lineTo(388, 310);
  ctx.lineTo(362, 388);
  ctx.stroke();

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Supraglacial cyan meltwater ponds
  const ponds = [
    [175, 195, 36, 18, 0.3],
    [252, 342, 44, 22, -0.2],
    [138, 418, 30, 14, 0.45],
  ];
  for (const [x, y, rx, ry, rot] of ponds) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.ellipse(-4, -2, rx * 0.55, ry * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Drifting tabular icebergs
  const drawBerg = (pts: [number, number][]) => {
    ctx.fillStyle = '#d4e6f4';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#6488a8';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  drawBerg([
    [625, 112],
    [742, 98],
    [766, 168],
    [678, 196],
    [612, 164],
  ]);
  drawBerg([
    [590, 316],
    [684, 294],
    [712, 362],
    [640, 398],
    [572, 368],
  ]);
  drawBerg([
    [795, 255],
    [872, 240],
    [890, 305],
    [814, 316],
  ]);
}

function drawDesertSolarScene(ctx: CanvasRenderingContext2D) {
  const rand = mulberry32(5512);
  // Arid ochre plateau terrain
  const sandGrad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  sandGrad.addColorStop(0, '#6e5842');
  sandGrad.addColorStop(0.5, '#7c644b');
  sandGrad.addColorStop(1, '#5e4a38');
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Braided dry alluvial river channels
  ctx.strokeStyle = 'rgba(155, 130, 102, 0.36)';
  ctx.lineWidth = 10;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 390 + i * 24);
    ctx.bezierCurveTo(280, 360 + i * 18, 620, 480 + i * 10, CANVAS_W, 410 + i * 20);
    ctx.stroke();
  }

  // Surface dust grain
  for (let i = 0; i < 1200; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(180, 152, 120, 0.14)' : 'rgba(54, 40, 28, 0.16)';
    ctx.fillRect(rand() * CANVAS_W, rand() * CANVAS_H, 3, 2);
  }

  // Straight desert access roads
  ctx.strokeStyle = '#a3927d';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 275);
  ctx.lineTo(CANVAS_W, 275);
  ctx.moveTo(510, 0);
  ctx.lineTo(510, CANVAS_H);
  ctx.stroke();

  // Utility-scale dark photovoltaic panel array grids (left sector)
  const drawPvBlock = (x0: number, y0: number, w: number, h: number, dusty = false) => {
    ctx.fillStyle = '#473a2c';
    ctx.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
    ctx.fillStyle = dusty ? '#2b3946' : '#102238';
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = '#334e6e';
    ctx.lineWidth = 1;
    for (let y = y0 + 6; y < y0 + h; y += 7) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
    }
    for (let x = x0 + 24; x < x0 + w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + h);
      ctx.stroke();
    }
  };

  drawPvBlock(48, 42, 200, 195);
  drawPvBlock(274, 42, 200, 195);
  drawPvBlock(48, 304, 200, 185, true);
  drawPvBlock(274, 304, 200, 185);

  // Concentric CSP solar thermal receiver towers (right sector — high thermal radiance)
  const towers: [number, number, number][] = [
    [664, 152, 86],
    [826, 206, 74],
    [708, 384, 92],
  ];
  for (const [cx, cy, rad] of towers) {
    // Heliostat mirror rings
    for (let r = rad; r >= 20; r -= 11) {
      ctx.strokeStyle = 'rgba(182, 202, 218, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Luminous central receiver tower
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 24);
    glow.addColorStop(0, '#ffffff');
    glow.addColorStop(0.4, '#fcd34d');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
  }
}

function applySpectralBand(ctx: CanvasRenderingContext2D, band: SpectralBand) {
  if (band === 'optical') return;
  const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const d = img.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];

    if (band === 'thermal') {
      // Weight warm red/orange brightness strongly for LWIR thermal signature
      const heat = Math.min(255, Math.max(0, r * 0.62 + g * 0.3 - b * 0.18 + 26));
      const t = heat / 255;
      if (t < 0.25) {
        const k = t / 0.25;
        d[i] = Math.round(14 + k * 52);
        d[i + 1] = Math.round(10 + k * 14);
        d[i + 2] = Math.round(48 + k * 84);
      } else if (t < 0.55) {
        const k = (t - 0.25) / 0.3;
        d[i] = Math.round(66 + k * 140);
        d[i + 1] = Math.round(24 + k * 32);
        d[i + 2] = Math.round(132 - k * 52);
      } else if (t < 0.82) {
        const k = (t - 0.55) / 0.27;
        d[i] = Math.round(206 + k * 48);
        d[i + 1] = Math.round(56 + k * 138);
        d[i + 2] = Math.round(80 - k * 65);
      } else {
        const k = (t - 0.82) / 0.18;
        d[i] = 255;
        d[i + 1] = Math.round(194 + k * 61);
        d[i + 2] = Math.round(15 + k * 230);
      }
    } else if (band === 'ndvi') {
      // False-color NIR vegetation/mineral differentiation
      const veg = (g - r) * 1.45 + 110;
      const lum = (r + g + b) / 3;
      if (g > r + 4 && g > b) {
        d[i] = Math.min(255, Math.round(140 + veg * 0.55));
        d[i + 1] = Math.round(45 + lum * 0.35);
        d[i + 2] = Math.round(52 + lum * 0.25);
      } else if (b > r + 8) {
        d[i] = Math.round(8 + lum * 0.18);
        d[i + 1] = Math.round(32 + lum * 0.35);
        d[i + 2] = Math.round(58 + lum * 0.55);
      } else {
        d[i] = Math.round(lum * 0.72);
        d[i + 1] = Math.round(lum * 0.92);
        d[i + 2] = Math.round(lum * 0.98);
      }
    } else if (band === 'sar') {
      // High-contrast monochrome C-Band radar backscatter with mild speckle
      const lum = r * 0.34 + g * 0.48 + b * 0.18;
      const contrast = Math.min(255, Math.max(0, (lum - 70) * 1.45 + 92));
      const speckle = (((i * 2654435761) >>> 24) & 15) - 7;
      const v = Math.min(255, Math.max(0, contrast + speckle));
      d[i] = Math.round(v * 0.92);
      d[i + 1] = Math.round(v * 0.98);
      d[i + 2] = Math.min(255, Math.round(v * 1.04));
    }
  }
  ctx.putImageData(img, 0, 0);
}

function drawConditionEffects(
  ctx: CanvasRenderingContext2D,
  condition: TelemetryState['activeCondition'],
  band: SpectralBand
) {
  if (condition === 'thermal_spike') {
    // High-radiance injected thermal hotspot in upper-right quadrant
    const hx = 640;
    const hy = 235;
    const g = ctx.createRadialGradient(hx, hy, 4, hx, hy, 68);
    g.addColorStop(0, 'rgba(255, 250, 220, 0.96)');
    g.addColorStop(0.28, 'rgba(249, 115, 22, 0.85)');
    g.addColorStop(0.65, 'rgba(220, 38, 38, 0.42)');
    g.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(hx, hy, 68, 0, Math.PI * 2);
    ctx.fill();

    // Subtle isotherm calibration ring
    ctx.strokeStyle = 'rgba(251, 146, 60, 0.72)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(hx, hy, 44, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (condition === 'cloud_mask') {
    // SAR C-Band penetrates clouds; optical/NDVI heavily occluded, thermal partially occluded
    const opacityMult = band === 'sar' ? 0.08 : band === 'thermal' ? 0.35 : 0.82;
    const puffs = [
      [180, 140, 175],
      [330, 110, 190],
      [485, 185, 200],
      [680, 155, 195],
      [810, 260, 180],
      [280, 320, 195],
      [530, 375, 210],
      [740, 425, 185],
    ];
    for (const [cx, cy, rad] of puffs) {
      const cg = ctx.createRadialGradient(cx, cy, rad * 0.12, cx, cy, rad);
      cg.addColorStop(0, `rgba(226, 234, 244, ${0.88 * opacityMult})`);
      cg.addColorStop(0.55, `rgba(195, 208, 222, ${0.58 * opacityMult})`);
      cg.addColorStop(1, 'rgba(180, 196, 212, 0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (condition === 'orbit_slew') {
    // Subtle off-nadir swath alignment grid
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.38)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(85, 34);
    ctx.lineTo(CANVAS_W - 35, 62);
    ctx.lineTo(CANVAS_W - 85, CANVAS_H - 34);
    ctx.lineTo(35, CANVAS_H - 62);
    ctx.closePath();
    ctx.stroke();
  }

  if (condition === 'safe_mode') {
    ctx.fillStyle = 'rgba(7, 9, 14, 0.92)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = 0; y < CANVAS_H; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
  }
}

export const SatelliteCanvas = forwardRef<SatelliteCanvasHandle, SatelliteCanvasProps>(
  function SatelliteCanvas(
    {
      pass,
      band,
      telemetry,
      detections,
      selectedDetectionId,
      isScanning,
      customImageUrl,
      onBandChange,
      onSelectDetection,
      onUploadCustomImage,
      onRunScan,
    },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [showOverlays, setShowOverlays] = useState(true);
    const [probe, setProbe] = useState<{
      xPct: number;
      yPct: number;
      lat: number;
      lon: number;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      captureFrameBase64: () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return canvas.toDataURL('image/png');
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      const renderScene = (uploadedImg?: HTMLImageElement) => {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.save();
        if (telemetry.activeCondition === 'orbit_slew') {
          ctx.translate(CANVAS_W * 0.5, CANVAS_H * 0.5);
          ctx.rotate(-0.045);
          ctx.scale(1.06, 1.06);
          ctx.translate(-CANVAS_W * 0.5, -CANVAS_H * 0.5);
        }

        if (uploadedImg) {
          const scale = Math.max(CANVAS_W / uploadedImg.width, CANVAS_H / uploadedImg.height);
          const drawW = uploadedImg.width * scale;
          const drawH = uploadedImg.height * scale;
          ctx.drawImage(uploadedImg, (CANVAS_W - drawW) / 2, (CANVAS_H - drawH) / 2, drawW, drawH);
        } else if (pass.id === 'port_shipping') {
          drawPortShippingScene(ctx);
        } else if (pass.id === 'wildfire_ridge') {
          drawWildfireRidgeScene(ctx);
        } else if (pass.id === 'polar_glacier') {
          drawPolarGlacierScene(ctx);
        } else {
          drawDesertSolarScene(ctx);
        }
        ctx.restore();

        // Apply thermal hotspot before spectral pass so LWIR picks it up vividly
        if (telemetry.activeCondition === 'thermal_spike') {
          drawConditionEffects(ctx, 'thermal_spike', band);
        }

        applySpectralBand(ctx, band);

        if (telemetry.activeCondition !== 'thermal_spike' && telemetry.activeCondition !== 'nominal') {
          drawConditionEffects(ctx, telemetry.activeCondition, band);
        }

        // Subtle sensor reticle ticks along frame edges
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = 1;
        for (let x = 96; x < CANVAS_W; x += 96) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, 7);
          ctx.moveTo(x, CANVAS_H - 7);
          ctx.lineTo(x, CANVAS_H);
          ctx.stroke();
        }
        for (let y = 90; y < CANVAS_H; y += 90) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(7, y);
          ctx.moveTo(CANVAS_W - 7, y);
          ctx.lineTo(CANVAS_W, y);
          ctx.stroke();
        }
      };

      if (pass.id === 'custom_upload' && customImageUrl) {
        const img = new Image();
        img.onload = () => renderScene(img);
        img.src = customImageUrl;
      } else {
        renderScene();
      }
    }, [pass.id, band, telemetry.activeCondition, customImageUrl]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const yPct = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      const latOffset = (0.5 - yPct) * 0.14;
      const lonOffset = (xPct - 0.5) * 0.24;
      setProbe({
        xPct: Math.round(xPct * CANVAS_W),
        yPct: Math.round(yPct * CANVAS_H),
        lat: pass.lat + latOffset,
        lon: pass.lon + lonOffset,
      });
    };

    const handleDownloadFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const link = document.createElement('a');
      link.download = `${pass.satelliteId}_${pass.id}_${band}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onUploadCustomImage(reader.result, file.name);
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };

    const severityStroke = (sev: AiDetection['severity'], selected: boolean) => {
      if (selected) return '#22d3ee';
      if (sev === 'Critical') return '#f43f5e';
      if (sev === 'Alert' || sev === 'Advisory') return '#f59e0b';
      return '#10b981';
    };

    return (
      <section className="flex flex-col flex-1 min-w-0 bg-[#0A0D14] border-b lg:border-b-0 lg:border-r border-slate-800">
        {/* Viewport Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-800 bg-[#0D111A]">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">
              {pass.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums truncate">
              <span>{pass.satelliteId}</span>
              <span aria-hidden="true">·</span>
              <span>{pass.region}</span>
              <span aria-hidden="true">·</span>
              <span>GSD {pass.gsdMeters.toFixed(2)} m</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Functional Spectral Band Segmented Control */}
            <div
              role="group"
              aria-label="Spectral sensor band"
              className="flex items-center p-0.5 bg-[#07090E] border border-slate-800 rounded-md"
            >
              {SPECTRAL_BANDS.map((b) => {
                const active = band === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onBandChange(b.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowOverlays((v) => !v)}
              title={showOverlays ? 'Hide AI detection overlays' : 'Show AI detection overlays'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#151C28] hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {showOverlays ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showOverlays ? 'Boxes On' : 'Boxes Off'}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 bg-[#151C28] hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Frame</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadFrame}
              title="Export satellite frame PNG"
              className="inline-flex items-center justify-center p-1.5 text-slate-300 bg-[#151C28] hover:bg-slate-800 border border-slate-700/80 rounded-md transition-colors cursor-pointer"
              aria-label="Export satellite frame PNG"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Interactive Satellite Imagery Viewport Stage */}
        <div className="relative flex-1 flex items-center justify-center bg-[#06080D] p-4 min-h-[300px]">
          <div
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setProbe(null)}
            className="relative w-full max-w-[960px] aspect-video border border-slate-800 bg-[#07090E] overflow-hidden cursor-crosshair select-none"
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="w-full h-full block object-cover"
            />

            {/* Safe Mode Aperture Shutter Readout */}
            {telemetry.activeCondition === 'safe_mode' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#07090E]/70 px-6 text-center pointer-events-none">
                <p className="text-sm font-semibold text-rose-400">
                  ✖ Aperture Shutter Closed — Safe Mode Standby
                </p>
                <p className="mt-1 text-xs text-slate-400 max-w-md">
                  Optical and thermal focal planes are shielded. Trigger Reset Nominal to reopen the payload shutter and resume Earth observation capture.
                </p>
              </div>
            )}

            {/* SVG AI Detection Bounding Box Overlay */}
            {showOverlays && detections.length > 0 && telemetry.shutterOpen && (
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                {detections.map((det, idx) => {
                  const [x, y, w, h] = det.bbox;
                  const isSel = selectedDetectionId === det.id;
                  const stroke = severityStroke(det.severity, isSel);
                  const corner = Math.min(3.2, w * 0.25, h * 0.25);

                  return (
                    <g
                      key={det.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDetection(isSel ? null : det.id);
                      }}
                      className="pointer-events-auto cursor-pointer"
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        fill={isSel ? 'rgba(6, 182, 212, 0.14)' : 'rgba(7, 9, 14, 0.12)'}
                        stroke={stroke}
                        strokeWidth={isSel ? 0.45 : 0.28}
                        strokeDasharray={isSel ? undefined : '1.4 0.8'}
                      />
                      {/* Precision corner brackets */}
                      <path
                        d={`M ${x} ${y + corner} L ${x} ${y} L ${x + corner} ${y}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={0.65}
                      />
                      <path
                        d={`M ${x + w - corner} ${y} L ${x + w} ${y} L ${x + w} ${y + corner}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={0.65}
                      />
                      <path
                        d={`M ${x} ${y + h - corner} L ${x} ${y + h} L ${x + corner} ${y + h}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={0.65}
                      />
                      <path
                        d={`M ${x + w - corner} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + h - corner}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={0.65}
                      />
                      {/* Compact target index tag */}
                      <rect
                        x={x}
                        y={Math.max(0.5, y - 4.2)}
                        width={Math.min(38, Math.max(12, det.label.length * 1.15 + 6))}
                        height={4.0}
                        fill="rgba(7, 9, 14, 0.88)"
                        stroke={stroke}
                        strokeWidth={0.22}
                      />
                      <text
                        x={x + 1.1}
                        y={Math.max(3.3, y - 1.3)}
                        fill="#f8fafc"
                        fontSize="2.25"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {String(idx + 1).padStart(2, '0')} {det.label.slice(0, 20)} {det.confidence.toFixed(0)}%
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Active AI Scan Progress Overlay */}
            {isScanning && (
              <div className="absolute inset-0 bg-[#07090E]/55 flex flex-col items-center justify-center gap-2.5 pointer-events-none">
                <div className="flex items-center gap-2 px-3.5 py-2 bg-[#0D111A] border border-cyan-500/50 rounded-md">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span className="text-xs font-mono text-cyan-200">
                    Running Gemini Vision inference on {band.toUpperCase()} frame...
                  </span>
                </div>
              </div>
            )}

            {/* Bottom Contrast Scrim with Crosshair Coordinate Probe */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-3.5 py-2.5 flex items-center justify-between gap-4 pointer-events-none">
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-200">
                <Crosshair className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                {probe ? (
                  <span>
                    LAT {probe.lat.toFixed(4)}° / LON {probe.lon.toFixed(4)}° · PX {probe.xPct},{probe.yPct}
                  </span>
                ) : (
                  <span>
                    NADIR {pass.lat.toFixed(4)}° / {pass.lon.toFixed(4)}° · SWATH {pass.swathKm.toFixed(1)} km
                  </span>
                )}
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-300 hidden sm:block">
                {SPECTRAL_BANDS.find((b) => b.id === band)?.wavelength} · {pass.captureUtc}
              </div>
            </div>
          </div>
        </div>

        {/* Compact Sub-Stage Telemetry Action Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-slate-800 bg-[#0D111A] text-xs">
          <div className="flex flex-wrap items-center gap-3 text-slate-400 font-mono tabular-nums">
            <span>Orbit #{pass.orbitNumber}</span>
            <span aria-hidden="true">·</span>
            <span>Condition: {telemetry.activeCondition.replace('_', ' ')}</span>
            <span aria-hidden="true">·</span>
            <span>Detections: {detections.length}</span>
          </div>
          <button
            type="button"
            onClick={onRunScan}
            disabled={isScanning}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Scan className="w-3.5 h-3.5" />
            <span>{isScanning ? 'Scanning Frame...' : 'Re-scan Current Frame'}</span>
          </button>
        </div>
      </section>
    );
  }
);
