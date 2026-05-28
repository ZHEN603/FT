"use client";

import React from "react";

export function SmallMetric({ label, value, icon: Icon, green = false, red = false, purple = false }: { label: string; value: string; icon: React.ElementType; green?: boolean; red?: boolean; purple?: boolean }) {
  return <div className="small-metric"><div><span>{label}</span><strong>{value}</strong></div><Icon className={green ? "green" : red ? "red" : purple ? "purple" : ""} size={34} /></div>;
}
