"use client";

import { useEffect, useMemo, useState } from "react";
import type { ExchangeRate } from "@/lib/db";
import { FtSelect } from "./FtSelect";

export const ADMIN_CURRENCIES = ["CNY", "USD", "EUR", "GBP", "JPY", "AUD", "CAD"] as const;
export type AdminCurrency = typeof ADMIN_CURRENCIES[number];

export const currencySymbols: Record<AdminCurrency, string> = {
  CNY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$"
};

export function formatCurrencyAmount(value: number, currency: string) {
  const safeCurrency = ADMIN_CURRENCIES.includes(currency as AdminCurrency) ? currency : "USD";
  return new Intl.NumberFormat(safeCurrency === "CNY" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: safeCurrency,
    maximumFractionDigits: safeCurrency === "JPY" ? 0 : 2
  }).format(Number(value || 0));
}

export function convertCurrency(value: number, fromCurrency: string, toCurrency: string, rateMap: Map<string, number>) {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();
  const amount = Number(value || 0);
  if (from === to) return amount;
  const fromToCny = from === "CNY" ? 1 : rateMap.get(`${from}:CNY`);
  const cnyToTarget = to === "CNY" ? 1 : rateMap.get(`CNY:${to}`);
  if (!fromToCny || !cnyToTarget) return amount;
  return Number((amount * fromToCny * cnyToTarget).toFixed(4));
}

function buildRateMap(rates: ExchangeRate[]) {
  const map = new Map<string, number>();
  map.set("CNY:CNY", 1);
  rates.forEach((rate) => {
    map.set(`${rate.currencyFrom}:${rate.currencyTo}`, rate.rate);
    if (rate.rate > 0) map.set(`${rate.currencyTo}:${rate.currencyFrom}`, Number((1 / rate.rate).toFixed(8)));
  });
  return map;
}

export function useAdminCurrency(defaultCurrency: AdminCurrency = "USD") {
  const [currency, setCurrency] = useState<AdminCurrency>(defaultCurrency);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(true);
  const [rateMessage, setRateMessage] = useState("");
  const rateMap = useMemo(() => buildRateMap(rates), [rates]);

  async function loadRates() {
    setLoadingRates(true);
    const response = await fetch("/api/admin/exchange-rates", { cache: "no-store" });
    const data = await response.json().catch(() => ({})) as { rates?: ExchangeRate[]; message?: string };
    if (response.ok) {
      setRates(data.rates ?? []);
      setRateMessage(data.message ?? "");
    } else {
      setRateMessage(data.message ?? "汇率加载失败，当前显示原币种金额");
    }
    setLoadingRates(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRates(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return {
    currency,
    setCurrency,
    rates,
    rateMap,
    loadingRates,
    rateMessage,
    refreshRates: loadRates,
    convert: (value: number, fromCurrency: string, toCurrency = currency) => convertCurrency(value, fromCurrency, toCurrency, rateMap),
    format: (value: number, fromCurrency = "CNY", toCurrency = currency) => formatCurrencyAmount(convertCurrency(value, fromCurrency, toCurrency, rateMap), toCurrency)
  };
}

export function CurrencySelect({ value, onChange, disabled = false }: { value: AdminCurrency; onChange: (value: AdminCurrency) => void; disabled?: boolean }) {
  return (
    <label className="currency-switcher">
      <span>币种</span>
      <FtSelect
        value={value}
        options={ADMIN_CURRENCIES.map((currency) => ({ value: currency, label: `${currencySymbols[currency]} ${currency}` }))}
        onChange={(currency) => onChange(currency as AdminCurrency)}
        disabled={disabled}
      />
    </label>
  );
}
