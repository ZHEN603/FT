"use client";

import { initialQuotes } from "./mock-data";
import type { Quote } from "./types";

const QUOTES_KEY = "ft-mvp-quotes";

export function loadQuotes(): Quote[] {
  if (typeof window === "undefined") return initialQuotes;
  const raw = window.localStorage.getItem(QUOTES_KEY);
  if (!raw) {
    window.localStorage.setItem(QUOTES_KEY, JSON.stringify(initialQuotes));
    return initialQuotes;
  }
  try {
    return JSON.parse(raw) as Quote[];
  } catch {
    return initialQuotes;
  }
}

export function saveQuote(quote: Quote) {
  const quotes = loadQuotes();
  window.localStorage.setItem(QUOTES_KEY, JSON.stringify([quote, ...quotes]));
}

export function replaceQuotes(quotes: Quote[]) {
  window.localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
}
