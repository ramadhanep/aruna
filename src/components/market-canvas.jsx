"use client";

import { useEffect, useRef } from "react";

const BASE_COLOR = "#f5f5f5";
const CARD_BG = "#111111";

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createMarketEngine(initialValue = 100) {
  return {
    value: initialValue,
    velocity: 0,
    trendBias: 0.02,
    biasFramesLeft: 120,
    breakoutFramesLeft: 0,
    breakoutForce: 0,
    pullbackFramesLeft: 0,
    phase: 0,
  };
}

function nextMarketPoint(engine) {
  if (engine.breakoutFramesLeft <= 0 && Math.random() < 0.004) {
    engine.breakoutFramesLeft = 20 + Math.floor(Math.random() * 16);
    engine.breakoutForce = (Math.random() > 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.12);
    engine.pullbackFramesLeft = 28 + Math.floor(Math.random() * 20);
  }

  if (engine.biasFramesLeft <= 0) {
    engine.biasFramesLeft = 90 + Math.floor(Math.random() * 160);
    const sign = Math.random() > 0.45 ? 1 : -1;
    engine.trendBias = sign * (0.008 + Math.random() * 0.03);
  }

  let acceleration = (Math.random() - 0.5) * 0.04;
  acceleration += engine.trendBias * 0.06;

  if (engine.breakoutFramesLeft > 0) {
    acceleration += engine.breakoutForce;
    engine.breakoutFramesLeft -= 1;
  }

  if (engine.pullbackFramesLeft > 0 && engine.breakoutFramesLeft <= 0) {
    acceleration -= engine.breakoutForce * 0.28;
    engine.pullbackFramesLeft -= 1;
  }

  engine.velocity = clamp(engine.velocity * 0.86 + acceleration, -0.7, 0.7);
  engine.value += engine.velocity;

  // Keep movement bounded around a drifting center so spikes never look synthetic.
  const driftCenter = 100 + Math.sin(engine.phase) * 8;
  engine.phase += 0.005;
  engine.value += (driftCenter - engine.value) * 0.016;

  engine.value = clamp(engine.value, 72, 132);
  engine.biasFramesLeft -= 1;

  return engine.value;
}

function buildSmoothPath(ctx, points, stepX, offsetX, toY) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(offsetX, toY(points[0]));

  for (let i = 1; i < points.length; i += 1) {
    const prevX = offsetX + (i - 1) * stepX;
    const prevY = toY(points[i - 1]);
    const currX = offsetX + i * stepX;
    const currY = toY(points[i]);
    const cpX = (prevX + currX) / 2;

    ctx.quadraticCurveTo(prevX, prevY, cpX, (prevY + currY) / 2);
    if (i === points.length - 1) {
      ctx.quadraticCurveTo(currX, currY, currX, currY);
    }
  }
}

export default function MarketCanvas() {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const dprRef = useRef(1);
  const pointsRef = useRef([]);
  const offsetRef = useRef(0);
  const lastTimeRef = useRef(0);
  const engineRef = useRef(createMarketEngine());
  const floatPhaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return undefined;
    engineRef.current.phase = Math.random() * Math.PI * 2;
    floatPhaseRef.current = Math.random() * Math.PI * 2;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const cssWidth = Math.max(320, rect.width);
      const cssHeight = Math.max(220, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(cssHeight * dpr);

      widthRef.current = cssWidth;
      heightRef.current = cssHeight;
      dprRef.current = dpr;

      const visiblePoints = Math.floor(cssWidth / 6.5) + 6;
      const current = pointsRef.current;
      const seedValue = current.length ? current[current.length - 1] : engineRef.current.value;

      if (!current.length) {
        pointsRef.current = Array.from({ length: visiblePoints }, () => nextMarketPoint(engineRef.current));
      } else if (current.length < visiblePoints) {
        const extra = visiblePoints - current.length;
        pointsRef.current = [...current, ...Array.from({ length: extra }, () => nextMarketPoint(engineRef.current))];
      } else if (current.length > visiblePoints) {
        pointsRef.current = current.slice(current.length - visiblePoints);
      }

      engineRef.current.value = seedValue;
    };

    updateSize();
    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(canvas);

    const render = (time) => {
      const width = widthRef.current;
      const height = heightRef.current;
      const dpr = dprRef.current;
      const points = pointsRef.current;

      const dt = lastTimeRef.current ? Math.min(48, time - lastTimeRef.current) : 16;
      lastTimeRef.current = time;

      const speedPxPerFrameAt60 = 1.2;
      offsetRef.current += speedPxPerFrameAt60 * (dt / 16.6667);

      const stepX = width / Math.max(1, points.length - 1);
      while (offsetRef.current >= stepX) {
        offsetRef.current -= stepX;
        points.shift();
        points.push(nextMarketPoint(engineRef.current));
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const floatY = Math.sin(floatPhaseRef.current) * 2.2;
      floatPhaseRef.current += 0.008;

      const minV = Math.min(...points);
      const maxV = Math.max(...points);
      const spread = Math.max(8, maxV - minV);
      const topPad = height * 0.16;
      const bottomPad = height * 0.18;
      const chartHeight = Math.max(60, height - topPad - bottomPad);
      const usableMin = minV - spread * 0.22;
      const usableMax = maxV + spread * 0.14;
      const toY = (v) => {
        const t = (v - usableMin) / Math.max(1, usableMax - usableMin);
        return topPad + (1 - t) * chartHeight + floatY;
      };

      const offsetX = -offsetRef.current;

      ctx.fillStyle = CARD_BG;
      ctx.fillRect(0, 0, width, height);

      // Older-data fade layer (left side), stronger fade as it ages.
      // A single crisp price line keeps the terminal calm and legible.
      ctx.save();
      buildSmoothPath(ctx, points, stepX, offsetX, toY);
      ctx.strokeStyle = BASE_COLOR;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      const latestX = offsetX + (points.length - 1) * stepX;
      const latestY = toY(points[points.length - 1]);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(latestX, latestY, 3, 0, Math.PI * 2);
      ctx.fill();

      frameRef.current = window.requestAnimationFrame(render);
    };

    frameRef.current = window.requestAnimationFrame(render);

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-lg border border-border bg-card">
      <canvas ref={canvasRef} className="h-full w-full" />

      <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-border bg-black px-3 py-2">
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-emerald-300">+7.24%</span>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Live</span>
        </div>
      </div>
    </div>
  );
}
