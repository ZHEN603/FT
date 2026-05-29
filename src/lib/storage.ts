"use client";

import type { Quote } from "./types";

const QUOTES_KEY = "ft-mvp-quotes";

export function loadQuotes(): Quote[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(QUOTES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Quote[];
  } catch {
    return [];
  }
}

export function saveQuote(quote: Quote) {
  const quotes = loadQuotes();
  window.localStorage.setItem(QUOTES_KEY, JSON.stringify([quote, ...quotes]));
}

export function replaceQuotes(quotes: Quote[]) {
  window.localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}
