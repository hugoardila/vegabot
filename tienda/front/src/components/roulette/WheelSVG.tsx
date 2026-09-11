import React from "react";
import { Segment } from "../../types/roulette";
import { CX, CY, R, slicePath, polarToCartesian } from "../../hooks/useRoulette";

interface WheelSVGProps {
  segments: Segment[];
}

export const WheelSVG = React.forwardRef<SVGGElement, WheelSVGProps>(
  ({ segments }, ref) => (
    <svg viewBox={`0 0 ${CX * 2} ${CY * 2}`} width={CX * 2} height={CY * 2}>
      <defs>
        <filter id="wshadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" floodOpacity="0.3" />
        </filter>
      </defs>

      <g ref={ref} style={{ transformOrigin: `${CX}px ${CY}px` }}>
        {/* Outer ring */}
        <circle
          cx={CX}
          cy={CY}
          r={R + 8}
          fill="#1a1a2e"
          filter="url(#wshadow)"
        />

        {segments.length === 0 ? (
          <>
            <circle
              cx={CX}
              cy={CY}
              r={R}
              fill="#1e1e3f"
              stroke="#fff"
              strokeWidth="2"
            />
            <text
              x={CX}
              y={CY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="14"
              fill="rgba(255,255,255,0.3)"
            >
              Sin participantes
            </text>
          </>
        ) : (
          segments.map((seg) => {
            const label = seg.name.split(" ")[0];
            const textPos = polarToCartesian(CX, CY, R * 0.65, seg.midAngle);
            return (
              <g key={seg.id}>
                <path
                  d={slicePath(CX, CY, R, seg.startAngle, seg.endAngle)}
                  fill={seg.color}
                  stroke="#fff"
                  strokeWidth="1.5"
                />
                <text
                  x={textPos.x}
                  y={textPos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={label.length > 8 ? "9" : "11"}
                  fontWeight="700"
                  fill="white"
                  transform={`rotate(${seg.midAngle + 90}, ${textPos.x}, ${textPos.y})`}
                >
                  {label.length > 11 ? label.slice(0, 10) + "…" : label}
                </text>
              </g>
            );
          })
        )}

        {/* Center hub */}
        <circle
          cx={CX}
          cy={CY}
          r={30}
          fill="#0f0f1a"
          stroke="#fff"
          strokeWidth="3"
        />
        <circle cx={CX} cy={CY} r={20} fill="#6366f1" />
        <text
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="16"
          fill="white"
        >
          🎰
        </text>
      </g>

      {/* Fixed pointer arrow */}
      <polygon
        points={`${CX - 14},${CY - R - 12} ${CX + 14},${CY - R - 12} ${CX},${CY - R + 14}`}
        fill="#fbbf24"
        stroke="#fff"
        strokeWidth="2"
        filter="url(#wshadow)"
      />
    </svg>
  ),
);
WheelSVG.displayName = "WheelSVG";
