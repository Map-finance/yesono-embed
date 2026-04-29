"use client";

/**
 * 可复用的 LineValue 切换器：黄色倒三角固定居中，选中按钮通过 translateX 滑动到中间。
 * 从 SportsEventCard.tsx 拆出（保持原实现，无修改）。
 */

import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LineValueSwitcherProps {
  lines: { value: number; idx: number }[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}

export default function LineValueSwitcher({
  lines,
  activeIdx,
  onSelect,
}: LineValueSwitcherProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [tx, setTx] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const btn = inner.querySelector(
      `[data-line-idx="${activeIdx}"]`
    ) as HTMLElement | null;
    if (!btn) return;
    const offset =
      btn.offsetLeft + btn.offsetWidth / 2 - container.offsetWidth / 2;
    setTx(-offset);
  }, [activeIdx, lines]);

  return (
    <div
      className="relative mt-2 border-t border-(--border)"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px z-10 text-(--accent) text-[10px] leading-none pointer-events-none">
        ▼
      </div>
      <div className="flex items-center justify-center pt-3">
        <button
          className="p-1 text-(--text-tertiary) hover:text-(--text-primary) shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(Math.max(0, activeIdx - 1));
          }}
        >
          <ChevronLeft size={14} />
        </button>
        <div ref={containerRef} className="overflow-hidden flex-1 min-w-0">
          <div
            ref={innerRef}
            className="flex items-center gap-3 w-max transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(${tx}px)` }}
          >
            {lines.map((lv) => {
              const isActive = lv.idx === activeIdx;
              return (
                <button
                  key={lv.idx}
                  data-line-idx={lv.idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(lv.idx);
                  }}
                  className={`relative flex items-center justify-center h-6 px-2 shrink-0 transition-all duration-200 ${
                    isActive
                      ? "text-(--text-primary)"
                      : "text-(--text-tertiary) hover:text-(--text-secondary)"
                  }`}
                >
                  <span
                    className={`transition-all duration-200 ${
                      isActive ? "text-sm font-bold" : "text-xs font-normal"
                    }`}
                  >
                    {lv.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          className="p-1 text-(--text-tertiary) hover:text-(--text-primary) shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onSelect(Math.min(lines.length - 1, activeIdx + 1));
          }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
