import { randomUUID } from "node:crypto";
import { formatDbDateTime, getPool, initDb } from "./init";
import type { ExchangeRate, ExchangeRateSyncResult } from "./types";

const DEFAULT_BASE_CURRENCY = "CNY";
export const DEFAULT_EXCHANGE_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD"];
const FRANKFURTER_ENDPOINT = "https://api.frankfurter.dev/v2/rates";
const CACHE_TTL_MS = 10 * 60 * 1000;

type ExchangeRateRow = {
  id: string;
  currencyFrom: string;
  currencyTo: string;
  rate: string;
  source: string;
  status: "active" | "inactive";
  effectiveAt: string;
  providerDate: string | null;
  updatedAt: string;
  errorMessage: string;
};

type FrankfurterRate = {
  date: string;
  base: string;
  quote: string;
  rate: number;
};

function mapRate(row: ExchangeRateRow): ExchangeRate {
  return {
    id: row.id,
    currencyFrom: row.currencyFrom,
    currencyTo: row.currencyTo,
    rate: Number(row.rate),
    source: row.source,
    status: row.status,
    effectiveAt: formatDbDateTime(row.effectiveAt),
    providerDate: row.providerDate,
    updatedAt: formatDbDateTime(row.updatedAt),
    errorMessage: row.errorMessage
  };
}

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z]/g, "");
}

function normalizeCurrencyList(currencies?: string[]) {
  const normalized = (currencies?.length ? currencies : DEFAULT_EXCHANGE_CURRENCIES)
    .map(normalizeCurrency)
    .filter((currency) => currency && currency !== DEFAULT_BASE_CURRENCY);
  return Array.from(new Set(normalized));
}

async function listCachedExchangeRates(baseCurrency = DEFAULT_BASE_CURRENCY, currencies = DEFAULT_EXCHANGE_CURRENCIES) {
  const result = await getPool().query<ExchangeRateRow>(
    `SELECT DISTINCT ON (currency_to)
       id,
       currency_from AS "currencyFrom",
       currency_to AS "currencyTo",
       rate,
       source,
       status,
       effective_at AS "effectiveAt",
       provider_date AS "providerDate",
       updated_at AS "updatedAt",
       error_message AS "errorMessage"
     FROM exchange_rates
     WHERE status = 'active'
       AND currency_from = $1
       AND currency_to = ANY($2::text[])
     ORDER BY currency_to ASC, updated_at DESC`,
    [baseCurrency, currencies]
  );
  return result.rows.map(mapRate);
}

async function newestExchangeRateUpdate(baseCurrency = DEFAULT_BASE_CURRENCY, currencies = DEFAULT_EXCHANGE_CURRENCIES) {
  const result = await getPool().query<{ updatedAt: string | null }>(
    `SELECT MAX(updated_at) AS "updatedAt"
     FROM exchange_rates
     WHERE status = 'active'
       AND currency_from = $1
       AND currency_to = ANY($2::text[])`,
    [baseCurrency, currencies]
  );
  return result.rows[0]?.updatedAt ?? null;
}

function nextRefreshAt(updatedAt: string | null) {
  if (!updatedAt) return null;
  return new Date(new Date(updatedAt).getTime() + CACHE_TTL_MS).toISOString();
}

async function fetchFrankfurterRates(baseCurrency: string, currencies: string[]) {
  const url = new URL(FRANKFURTER_ENDPOINT);
  url.searchParams.set("base", baseCurrency);
  url.searchParams.set("quotes", currencies.join(","));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Frankfurter returned ${response.status}`);
    }
    const data = await response.json() as FrankfurterRate[];
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Frankfurter returned no rates");
    }
    return data.filter((item) => item.base === baseCurrency && currencies.includes(item.quote) && Number(item.rate) > 0);
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertRates(baseCurrency: string, rates: FrankfurterRate[]) {
  for (const item of rates) {
    await getPool().query(
      `INSERT INTO exchange_rates (
         id, currency_from, currency_to, rate, source, status,
         effective_at, provider_date, updated_at, error_message
       )
       VALUES ($1,$2,$3,$4,'frankfurter','active',now(),$5,now(),'')
       ON CONFLICT (id) DO UPDATE SET
         rate = EXCLUDED.rate,
         source = EXCLUDED.source,
         status = 'active',
         effective_at = EXCLUDED.effective_at,
         provider_date = EXCLUDED.provider_date,
         updated_at = EXCLUDED.updated_at,
         error_message = ''`,
      [`rate-${baseCurrency.toLowerCase()}-${item.quote.toLowerCase()}`, baseCurrency, item.quote, item.rate, item.date]
    );
    await getPool().query(
      `INSERT INTO exchange_rates (
         id, currency_from, currency_to, rate, source, status,
         effective_at, provider_date, updated_at, error_message
       )
       VALUES ($1,$2,$3,$4,'frankfurter','active',now(),$5,now(),'')
       ON CONFLICT (id) DO UPDATE SET
         rate = EXCLUDED.rate,
         source = EXCLUDED.source,
         status = 'active',
         effective_at = EXCLUDED.effective_at,
         provider_date = EXCLUDED.provider_date,
         updated_at = EXCLUDED.updated_at,
         error_message = ''`,
      [`rate-${item.quote.toLowerCase()}-${baseCurrency.toLowerCase()}`, item.quote, baseCurrency, Number((1 / item.rate).toFixed(8)), item.date]
    );
  }
}

async function markExchangeRateError(message: string, baseCurrency: string, currencies: string[]) {
  await getPool().query(
    `UPDATE exchange_rates
     SET error_message = $1
     WHERE currency_from = $2
       AND currency_to = ANY($3::text[])`,
    [message.slice(0, 500), baseCurrency, currencies]
  );
}

export async function getExchangeRates(options: { force?: boolean; currencies?: string[] } = {}): Promise<ExchangeRateSyncResult> {
  await initDb();
  const baseCurrency = DEFAULT_BASE_CURRENCY;
  const currencies = normalizeCurrencyList(options.currencies);
  const lastUpdatedRaw = await newestExchangeRateUpdate(baseCurrency, currencies);
  const isFresh = Boolean(lastUpdatedRaw) && Date.now() - new Date(lastUpdatedRaw!).getTime() < CACHE_TTL_MS;

  if (!options.force && isFresh) {
    const rates = await listCachedExchangeRates(baseCurrency, currencies);
    return {
      rates,
      baseCurrency,
      currencies,
      fromCache: true,
      refreshed: false,
      nextRefreshAt: nextRefreshAt(lastUpdatedRaw),
      lastUpdatedAt: lastUpdatedRaw ? formatDbDateTime(lastUpdatedRaw) : null
    };
  }

  try {
    const liveRates = await fetchFrankfurterRates(baseCurrency, currencies);
    await upsertRates(baseCurrency, liveRates);
    const rates = await listCachedExchangeRates(baseCurrency, currencies);
    const lastUpdated = await newestExchangeRateUpdate(baseCurrency, currencies);
    return {
      rates,
      baseCurrency,
      currencies,
      fromCache: false,
      refreshed: true,
      nextRefreshAt: nextRefreshAt(lastUpdated),
      lastUpdatedAt: lastUpdated ? formatDbDateTime(lastUpdated) : null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "汇率接口请求失败";
    await markExchangeRateError(message, baseCurrency, currencies);
    const rates = await listCachedExchangeRates(baseCurrency, currencies);
    return {
      rates,
      baseCurrency,
      currencies,
      fromCache: true,
      refreshed: false,
      nextRefreshAt: nextRefreshAt(lastUpdatedRaw),
      lastUpdatedAt: lastUpdatedRaw ? formatDbDateTime(lastUpdatedRaw) : null,
      message: rates.length > 0 ? `实时汇率拉取失败，已使用缓存：${message}` : message
    };
  }
}

export async function createManualExchangeRate(input: { currencyFrom: string; currencyTo: string; rate: number }) {
  await initDb();
  const currencyFrom = normalizeCurrency(input.currencyFrom);
  const currencyTo = normalizeCurrency(input.currencyTo);
  const rate = Number(input.rate);
  if (!currencyFrom || !currencyTo || currencyFrom === currencyTo || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("汇率参数不正确");
  }
  const id = `rate-manual-${currencyFrom.toLowerCase()}-${currencyTo.toLowerCase()}-${randomUUID()}`;
  const result = await getPool().query<ExchangeRateRow>(
    `INSERT INTO exchange_rates (
       id, currency_from, currency_to, rate, source, status,
       effective_at, provider_date, updated_at, error_message
     )
     VALUES ($1,$2,$3,$4,'manual','active',now(),CURRENT_DATE,now(),'')
     RETURNING
       id,
       currency_from AS "currencyFrom",
       currency_to AS "currencyTo",
       rate,
       source,
       status,
       effective_at AS "effectiveAt",
       provider_date AS "providerDate",
       updated_at AS "updatedAt",
       error_message AS "errorMessage"`,
    [id, currencyFrom, currencyTo, rate]
  );
  return mapRate(result.rows[0]);
}
