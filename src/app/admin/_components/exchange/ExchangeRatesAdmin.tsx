"use client";

import { AlertTriangle, CheckCircle2, Download, Globe2, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { SmallMetric } from "../shared/SmallMetric";
import { downloadAdminExport } from "../shared/utils";
import type { ExchangeRate, ExchangeRateSyncResult } from "@/lib/db";

const POLL_INTERVAL_MS = 10 * 60 * 1000;
const currencyNames: Record<string, string> = {
  CNY: "人民币",
  USD: "美元",
  EUR: "欧元",
  GBP: "英镑",
  JPY: "日元",
  AUD: "澳元",
  CAD: "加元"
};

function formatRate(rate: number) {
  if (rate >= 10) return rate.toFixed(4);
  return rate.toFixed(6);
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return value.slice(0, 16);
}

function defaultManualForm() {
  return { currencyFrom: "CNY", currencyTo: "USD", rate: "" };
}

export function ExchangeRatesAdmin() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState<Omit<ExchangeRateSyncResult, "rates"> | null>(null);
  const [manualForm, setManualForm] = useState(defaultManualForm);
  const sortedRates = useMemo(() => rates.slice().sort((a, b) => a.currencyTo.localeCompare(b.currencyTo)), [rates]);
  const usdRate = rates.find((rate) => rate.currencyTo === "USD");
  const sourceLabel = meta?.fromCache ? "缓存" : "实时接口";
  const statusOk = !meta?.message;

  async function loadRates(force = false) {
    if (force) setRefreshing(true);
    else setLoading(true);
    setMessage("");
    const response = await fetch(`/api/admin/exchange-rates${force ? "?refresh=true" : ""}`, { cache: "no-store" });
    const data = await response.json() as ExchangeRateSyncResult & { message?: string };
    if (!response.ok) {
      setMessage(data.message ?? "汇率加载失败");
    } else {
      setRates(data.rates ?? []);
      setMeta({
        baseCurrency: data.baseCurrency,
        currencies: data.currencies,
        fromCache: data.fromCache,
        refreshed: data.refreshed,
        nextRefreshAt: data.nextRefreshAt,
        lastUpdatedAt: data.lastUpdatedAt,
        message: data.message
      });
      if (data.message) setMessage(data.message);
    }
    setLoading(false);
    setRefreshing(false);
  }

  async function saveManualRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRefreshing(true);
    setMessage("");
    const response = await fetch("/api/admin/exchange-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...manualForm, rate: Number(manualForm.rate) })
    });
    const data = await response.json() as { rate?: ExchangeRate; message?: string };
    if (!response.ok) {
      setMessage(data.message ?? "保存手动汇率失败");
      setRefreshing(false);
      return;
    }
    setManualForm(defaultManualForm());
    setMessage("手动汇率已保存");
    await loadRates(true);
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void loadRates(false), 0);
    const timer = window.setInterval(() => void loadRates(true), POLL_INTERVAL_MS);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  return (
    <>
      <AdminTop title="汇率管理" subtitle="自动同步 CNY 基准汇率，接口失败时使用本地缓存">
        <button className="admin-light" onClick={() => downloadAdminExport("exchange")}>
          <Download size={18} /> 导出数据
        </button>
        <button className="admin-light" onClick={() => void loadRates(true)} disabled={refreshing}>
          <RefreshCw size={18} /> {refreshing ? "同步中" : "立即同步"}
        </button>
      </AdminTop>

      {message && <div className={statusOk ? "admin-message" : "admin-message warning"}>{message}</div>}

      <div className="admin-metrics five">
        <SmallMetric label="数据来源" value={sourceLabel} icon={Globe2} />
        <SmallMetric label="CNY → USD" value={usdRate ? formatRate(usdRate.rate) : "-"} icon={CheckCircle2} green />
        <SmallMetric label="币种数量" value={String(rates.length)} icon={Globe2} />
        <SmallMetric label="上次更新" value={formatTime(meta?.lastUpdatedAt ?? null)} icon={RefreshCw} purple />
        <SmallMetric label="下次轮询" value={formatTime(meta?.nextRefreshAt ?? null)} icon={AlertTriangle} />
      </div>

      <div className="exchange-admin-grid">
        <section className="admin-panel">
          <div className="exchange-panel-head">
            <div>
              <h2>实时汇率</h2>
              <p>接口：Frankfurter，10 分钟轮询一次；失败自动读取缓存。</p>
            </div>
            <span className={statusOk ? "exchange-status ok" : "exchange-status warning"}>
              {statusOk ? "同步正常" : "缓存可用"}
            </span>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table exchange-table">
              <thead>
                <tr><th>基准</th><th>目标币种</th><th>汇率</th><th>来源</th><th>接口日期</th><th>更新时间</th><th>状态</th></tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7}>正在加载汇率...</td></tr>}
                {!loading && sortedRates.length === 0 && <tr><td colSpan={7}>暂无汇率缓存。</td></tr>}
                {sortedRates.map((rate) => (
                  <tr key={rate.id}>
                    <td><strong>{rate.currencyFrom}</strong><span>{currencyNames[rate.currencyFrom] ?? rate.currencyFrom}</span></td>
                    <td><strong>{rate.currencyTo}</strong><span>{currencyNames[rate.currencyTo] ?? rate.currencyTo}</span></td>
                    <td><strong>{formatRate(rate.rate)}</strong><span>1 {rate.currencyFrom} = {formatRate(rate.rate)} {rate.currencyTo}</span></td>
                    <td>{rate.source === "frankfurter" ? "Frankfurter API" : "手动"}</td>
                    <td>{rate.providerDate ?? "-"}</td>
                    <td>{rate.updatedAt}</td>
                    <td><span className={rate.errorMessage ? "status-pill warning" : "status-pill active"}>{rate.errorMessage ? "缓存" : "正常"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="admin-panel exchange-side-panel">
          <h2>手动补录</h2>
          <p>临时维护特殊币种或接口异常时，可手动写入一条 active 汇率记录。</p>
          <form onSubmit={saveManualRate}>
            <label>基准币种<input value={manualForm.currencyFrom} onChange={(event) => setManualForm((current) => ({ ...current, currencyFrom: event.target.value.toUpperCase() }))} maxLength={3} /></label>
            <label>目标币种<input value={manualForm.currencyTo} onChange={(event) => setManualForm((current) => ({ ...current, currencyTo: event.target.value.toUpperCase() }))} maxLength={3} /></label>
            <label>汇率<input type="number" min="0" step="0.000001" value={manualForm.rate} onChange={(event) => setManualForm((current) => ({ ...current, rate: event.target.value }))} placeholder="如 0.147530" required /></label>
            <button className="admin-primary" type="submit" disabled={refreshing}><Save size={16} /> 保存手动汇率</button>
          </form>
          <div className="exchange-cache-note">
            <strong>缓存策略</strong>
            <span>本页打开后会立即读取缓存；超过 10 分钟或点击同步时才请求外部 API。</span>
          </div>
        </aside>
      </div>
    </>
  );
}
