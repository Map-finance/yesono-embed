"use client";

import React from "react";
import { ChevronDown, Loader2 } from "lucide-react";

export type ContextStatus = "idle" | "loading" | "done";

interface MarketContextProps {
  /** 当前状态：idle(未生成) / loading(加载中) / done(已完成) */
  contextStatus: ContextStatus;
  /** 是否展开内容面板 */
  isExpanded: boolean;
  /** 切换展开状态 */
  onExpandToggle: () => void;
  /** 点击生成按钮 */
  onGenerateClick: () => void;
  /** 显示的上下文文本内容 */
  displayedText: string;
  /** 市场问题标题（收起时显示） */
  questionText: string;
}

/**
 * MarketContext - 市场上下文组件
 * 可折叠的面板，用于展示 AI 生成的市场分析内容
 */
const MarketContext: React.FC<MarketContextProps> = ({
  contextStatus,
  isExpanded,
  onExpandToggle,
  onGenerateClick,
  displayedText,
  questionText,
}) => {
  const handleHeaderClick = () => {
    if (contextStatus === "idle") {
      onGenerateClick();
    } else {
      onExpandToggle();
    }
  };

  return (
    <div className="mt-8 mb-12">
      <div
        className={`rounded-xl border border-slate-800 overflow-hidden transition-all duration-500 ease-out origin-top ${
          contextStatus === "idle"
            ? "bg-transparent hover:bg-slate-900/60"
            : "bg-slate-900/20"
        }`}
        style={{
          transform: contextStatus === "idle" ? "scale(1)" : "scale(1)",
        }}
      >
        {/* 头部区域 */}
        <div
          className={`flex items-center justify-between p-5 cursor-pointer transition-colors duration-300 ${
            contextStatus !== "idle" ? "hover:bg-slate-800/40" : ""
          }`}
          onClick={handleHeaderClick}
        >
          {/* 标题区域：使用相对定位实现平滑切换 */}
          <div className="relative h-6 overflow-hidden flex-1 select-none">
            <div
              className="flex flex-col transition-all duration-500 ease-in-out"
              style={{
                transform: `translateY(${
                  contextStatus !== "idle" && isExpanded ? "-24px" : "0px"
                })`,
              }}
            >
              <span className="h-6 flex items-center text-[15px] font-bold text-white leading-none">
                Market Context
              </span>
              <span
                className={`h-6 flex items-center text-[15px] font-bold text-slate-500 truncate pr-4 leading-none transition-opacity duration-300 ${
                  contextStatus === "idle" ? "opacity-0" : "opacity-100"
                }`}
              >
                {questionText}
              </span>
            </div>
          </div>

          {/* 右侧操作区域 */}
          <div className="flex items-center gap-3 shrink-0">
            {contextStatus === "loading" && (
              <Loader2 className="w-4 h-4 text-[#3b82f6] animate-spin" />
            )}

            {/* idle 状态显示 Generate 按钮，否则显示展开/收起图标 */}
            <div
              className={`transition-all duration-500 ease-out ${
                contextStatus === "idle"
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-75 absolute pointer-events-none"
              }`}
            >
              <span className="text-[14px] font-bold text-[#3b82f6] hover:text-[#60a5fa] transition-colors">
                Generate
              </span>
            </div>

            <div
              className={`text-slate-500 transition-all duration-500 ease-out ${
                contextStatus !== "idle"
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-75 absolute pointer-events-none"
              }`}
            >
              <div
                className="transition-transform duration-300"
                style={{
                  transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <ChevronDown className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* 折叠面板内容：使用 grid 实现平滑高度过渡 */}
        <div
          className="grid transition-all duration-500 ease-out"
          style={{
            gridTemplateRows:
              contextStatus !== "idle" && isExpanded ? "1fr" : "0fr",
          }}
        >
          <div className="overflow-hidden">
            <div className="px-5 pb-5 pt-2 border-t border-slate-800/40">
              <div className="text-[15px] text-slate-300 leading-relaxed font-medium min-h-[80px]">
                {contextStatus === "loading" ? (
                  <div className="flex items-center gap-2 text-slate-600 italic">
                    <span className="animate-pulse">
                      Analyzing market context...
                    </span>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{displayedText}</div>
                )}
              </div>

              {/* 右下角免责声明 */}
              <div className="mt-6 flex justify-end">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                  Results are experimental.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketContext;

