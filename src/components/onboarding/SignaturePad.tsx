"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  /** PNG data URL, or null when the pad is empty. */
  onChange: (dataUrl: string | null) => void;
  height?: number;
}

/** Draw-your-signature box. Works with mouse, touch and stylus (pointer events). */
export function SignaturePad({ onChange, height = 160 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  // Size the canvas to its CSS box at device resolution so lines stay sharp
  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    c.width = Math.round(w * ratio);
    c.height = Math.round(height * ratio);
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0F172A";
  }, [height]);

  useEffect(() => {
    setup();
  }, [setup]);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y); // a tap leaves a dot
    ctx.stroke();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setHasInk(true);
    onChange(canvasRef.current!.toDataURL("image/png"));
  };
  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border border-slate-300 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ height, touchAction: "none" }}
          className="w-full block cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          aria-label="Signature box. Draw your signature with your finger, stylus or mouse."
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300 select-none">
            Sign here
          </span>
        )}
        <span className="pointer-events-none absolute left-4 right-4 bottom-8 border-b border-dashed border-slate-200" />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>Use your finger, stylus or mouse.</span>
        <button type="button" onClick={clear} disabled={!hasInk} className="inline-flex items-center gap-1 font-medium text-indigo-700 disabled:text-slate-300">
          <Eraser className="w-3.5 h-3.5" /> Clear
        </button>
      </div>
    </div>
  );
}
