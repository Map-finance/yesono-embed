"use client";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";

interface ProbabilityGaugeProps {
  value: number;
  cornerRadius?: number;
  thickness?: number;
  color?: string;
}

export default function ProbabilityGauge({
  value,
  cornerRadius = 0,
  thickness = 30,
  color = "#d24b4b"
}: ProbabilityGaugeProps) {
  const data = [
    {
      name: "chance",
      value,
      fill: color,
    },
  ];

  const innerRadius = 60;
  const outerRadius = innerRadius + thickness;

  return (
    <div className="relative flex items-center justify-center">
      {/* 中心文字 */}
      <div
      className="absolute text-center top-1/2">
        <div style={{ fontSize: 28, fontWeight: 700 }}>
          {value}%
        </div>
        <div
          className="absolute text-xs text-(--text-secondary) font-semibold"
          style={{
            letterSpacing: 1,
          }}
        >
          CHANCE
        </div>
      </div>

      <RadialBarChart
        width={220}
        height={110}
        cx="50%"
        cy="90%"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={180}
        endAngle={0}
        data={data}
        className="outline-hidden"
      >
        {/* 隐藏刻度 */}
        <PolarAngleAxis
          type="number"
          domain={[0, 100]}
          tick={false}
        />

        {/* 灰色背景轨道 */}
        <RadialBar
          dataKey="value"
          cornerRadius={cornerRadius}
          background={{
            fill: "#445565",
          }}
        />
      </RadialBarChart>
    </div>
  );
}