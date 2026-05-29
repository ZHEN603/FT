"use client";

import {
  Box,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users
} from "lucide-react";
import { ChevronDown } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { appendDateRangeParams, defaultAdminDateRange, toDateInputValue } from "../shared/utils";
import type { Quote } from "@/lib/types";

type DashboardQuoteMetrics = { total: number; pending: number; sent: number; closed: number; amount: number };

export function Dashboard() {
  const [{ startDate: defaultStartDate, endDate: defaultEndDate }] = useState(defaultAdminDateRange);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteMetrics, setQuoteMetrics] = useState<DashboardQuoteMetrics>({ total: 0, pending: 0, sent: 0, closed: 0, amount: 0 });

  const loadDashboard = useCallback(async function loadDashboard() {
    const params = appendDateRangeParams(new URLSearchParams(), startDate, endDate);
    const response = await fetch(`/api/admin/quotes?${params.toString()}`);
    if (!response.ok) return;
    const data = await response.json() as { quotes: Quote[]; metrics: DashboardQuoteMetrics };
    setQuotes(data.quotes ?? []);
    setQuoteMetrics(data.metrics ?? { total: 0, pending: 0, sent: 0, closed: 0, amount: 0 });
  }, [endDate, startDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDashboard(), 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  function selectToday() {
    const today = toDateInputValue(new Date());
    setStartDate(today);
    setEndDate(today);
  }

  return (
    <>
      <AdminTop title="仪表盘" subtitle="聚合数据看全局，助力外贸业务高效增长">
        <label className="date-range-control">
          <CalendarDays size={16} />
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <span>~</span>
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </label>
        <button className="admin-light" onClick={selectToday}>今天 <ChevronDown size={16} /></button>
        <button className="admin-primary" onClick={() => void loadDashboard()}><RefreshCw size={18} /> 刷新数据</button>
      </AdminTop>
      <div className="admin-metrics six">
        <Metric icon={Box} title="产品上架数量SKU" value="1,286" caption="已上架SKU总数" trend="+12.3%" />
        <Metric icon={Users} title="网站访客数" value="3,842" caption="累计访问人数" trend="+15.6%" />
        <Metric icon={ClipboardList} title="产品流量数" value="12,680" caption="产品页访问量" trend="+22.7%" />
        <Metric icon={FileText} title="本月询盘" value={String(quoteMetrics.total)} caption="当前时间范围内报价单" trend="+8.4%" />
        <Metric icon={Clock} title="待处理报价单" value={String(quoteMetrics.pending)} caption="报价单数量" trend="-5.1%" danger />
        <Metric icon={Users} title="供应商数量" value="57" caption="合作供应商数" trend="+3.6%" />
      </div>
      <div className="dashboard-grid">
        <section className="admin-panel wide">
          <h2>近30天资源采集 / 筛选趋势</h2>
          <div className="line-chart">
            <svg viewBox="0 0 640 210" role="img" aria-label="趋势图">
              <path d="M20 170 C70 165,70 45,120 72 S180 155,220 100 S270 85,300 58 S350 145,400 82 S460 80,500 43 S570 42,620 63" />
              <path className="green" d="M20 188 C80 185,82 110,126 128 S190 178,230 132 S290 120,320 100 S390 154,430 118 S500 95,540 70 S580 110,620 98" />
            </svg>
          </div>
        </section>
        <section className="admin-panel">
          <h2>热门产品分类占比</h2>
          <div className="donut-row">
            <div className="donut">3,842<span>已筛选产品</span></div>
            <div className="legend">
              {["木质衣架 32%", "塑料衣架 28%", "金属衣架 18%", "植绒衣架 12%", "裤架/裙架 10%"].map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
        </section>
        <section className="admin-panel">
          <h2>待办事项</h2>
          <Todo label="待审核产品" value="18" />
          <Todo label="待处理询盘" value="25" />
          <Todo label="待生成报价单" value="42" />
          <Todo label="待跟进客户" value="31" />
        </section>
        <section className="admin-panel wide">
          <h2>最近询盘</h2>
          <SimpleQuoteTable quotes={quotes.slice(0, 5)} />
        </section>
        <section className="admin-panel">
          <h2>国家 / 地区分布</h2>
          {["美国 28%", "英国 18%", "阿联酋 14%", "澳大利亚 11%", "加拿大 8%"].map((item, index) => (
            <div className="country-bar" key={item}><span>{index + 1}. {item}</span><i style={{ width: `${32 - index * 5}%` }} /></div>
          ))}
        </section>
        <section className="admin-panel">
          <h2>最近跟进记录</h2>
          {["Global Retail Inc.", "StyleHub Ltd.", "Desert Line Trading", "Coastal Imports Pty Ltd"].map((name) => (
            <div className="timeline-item" key={name}><strong>{name}</strong><span>客户计划下周内部评估</span></div>
          ))}
        </section>
      </div>
    </>
  );
}

function Metric({ icon: Icon, title, value, caption, trend, danger = false }: { icon: React.ElementType; title: string; value: string; caption: string; trend: string; danger?: boolean }) {
  return (
    <div className="admin-metric">
      <div className={danger ? "metric-icon orange" : "metric-icon"}><Icon size={28} /></div>
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{caption}</p>
      <em className={danger ? "down" : ""}>{danger ? <TrendingDown size={15} /> : <TrendingUp size={15} />} {trend}</em>
    </div>
  );
}

function Todo({ label, value }: { label: string; value: string }) {
  return <div className="todo-row"><span>{label}</span><strong>{value}</strong></div>;
}

function SimpleQuoteTable({ quotes }: { quotes: Quote[] }) {
  return (
    <table className="simple-table">
      <thead><tr><th><input type="checkbox" /></th><th>客户名称</th><th>国家/地区</th><th>需求产品</th><th>状态</th><th>时间</th></tr></thead>
      <tbody>
        {quotes.map((quote) => (
          <tr key={quote.id}><td><input type="checkbox" /></td><td>{quote.company}</td><td>🇺🇸 {quote.country}</td><td>木质衣架</td><td><span>{quote.status}</span></td><td>{quote.createdAt}</td></tr>
        ))}
      </tbody>
    </table>
  );
}
