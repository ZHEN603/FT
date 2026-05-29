"use client";

import type { PriceMarkupType } from "@/lib/db";

export function SimpleMarkupControl({
  value,
  type,
  onValueChange,
  onTypeChange,
  label = "加价",
  hint
}: {
  value: string;
  type: PriceMarkupType;
  onValueChange: (value: string) => void;
  onTypeChange: (type: PriceMarkupType) => void;
  label?: string;
  hint?: string;
}) {
  const isPercentage = type === "percentage";

  return (
    <div className="simple-markup-field">
      <div className="simple-markup-head">
        <span>{label}</span>
        {hint && <em>{hint}</em>}
      </div>
      <div className="simple-markup-row">
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={isPercentage ? "输入加价百分比" : "输入固定加价值"}
        />
        <button
          type="button"
          className={isPercentage ? "toggle on" : "toggle"}
          aria-label={isPercentage ? "当前为百分比加价" : "当前为固定数值加价"}
          title={isPercentage ? "百分比加价" : "固定数值加价"}
          onClick={() => onTypeChange(isPercentage ? "fixed" : "percentage")}
        />
        <span className="simple-markup-unit">{isPercentage ? "%" : "数值"}</span>
      </div>
    </div>
  );
}
