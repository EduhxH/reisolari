"use client";

import React, { useMemo } from "react";

/**
 * Deterministic SVG illustration of a PV module, drawn to the real aspect ratio
 * of the product and with a cell grid derived from its real cell count. No
 * external images: the same product always renders the same panel.
 */
export default function PanelGraphic({
  widthMm,
  heightMm,
  cellCount,
  powerW,
  className
}: {
  widthMm: number;
  heightMm: number;
  cellCount: number;
  powerW: number;
  className?: string;
}) {
  const { cols, rows } = useMemo(() => {
    const c = 6; // residential half-cut modules are 6 cells wide
    const r = Math.max(4, Math.round(cellCount / c));
    return { cols: c, rows: r };
  }, [cellCount]);

  // Frame + interior geometry in a coordinate space matching the real ratio.
  const ratio = heightMm / widthMm;
  const viewW = 120;
  const viewH = Math.round(viewW * ratio);
  const frame = 4;
  const innerX = frame;
  const innerY = frame;
  const innerW = viewW - frame * 2;
  const innerH = viewH - frame * 2;

  const gap = 1.1;
  const splitGap = 2.2; // central gap for half-cut technology
  const cellW = (innerW - gap * (cols - 1)) / cols;
  const cellH = (innerH - gap * (rows - 1) - splitGap) / rows;

  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const extraSplit = r >= rows / 2 ? splitGap : 0;
      cells.push({
        x: innerX + c * (cellW + gap),
        y: innerY + r * (cellH + gap) + extraSplit
      });
    }
  }

  const gid = `panel-cell-${cols}x${rows}`;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className={className}
      role="img"
      aria-label={`Painel solar de ${powerW} W`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e3a5f" />
          <stop offset="55%" stopColor="#13243b" />
          <stop offset="100%" stopColor="#0a1626" />
        </linearGradient>
        <linearGradient id={`${gid}-frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#64748b" />
        </linearGradient>
      </defs>

      {/* Aluminium frame */}
      <rect
        x="0.5"
        y="0.5"
        width={viewW - 1}
        height={viewH - 1}
        rx="3"
        fill={`url(#${gid}-frame)`}
        stroke="#475569"
        strokeWidth="1"
      />
      {/* Glass backing */}
      <rect
        x={innerX}
        y={innerY}
        width={innerW}
        height={innerH}
        fill="#0b1424"
      />

      {/* Cells */}
      {cells.map((cell, idx) => (
        <g key={idx}>
          <rect
            x={cell.x}
            y={cell.y}
            width={cellW}
            height={cellH}
            rx="0.6"
            fill={`url(#${gid})`}
            stroke="#274b6e"
            strokeWidth="0.18"
          />
          {/* Busbars */}
          <line
            x1={cell.x + cellW / 3}
            y1={cell.y}
            x2={cell.x + cellW / 3}
            y2={cell.y + cellH}
            stroke="#3b5e85"
            strokeWidth="0.16"
          />
          <line
            x1={cell.x + (2 * cellW) / 3}
            y1={cell.y}
            x2={cell.x + (2 * cellW) / 3}
            y2={cell.y + cellH}
            stroke="#3b5e85"
            strokeWidth="0.16"
          />
        </g>
      ))}

      {/* Glass sheen */}
      <polygon
        points={`${innerX},${innerY} ${innerX + innerW * 0.42},${innerY} ${innerX + innerW * 0.16},${innerY + innerH} ${innerX},${innerY + innerH}`}
        fill="#ffffff"
        opacity="0.04"
      />
    </svg>
  );
}
