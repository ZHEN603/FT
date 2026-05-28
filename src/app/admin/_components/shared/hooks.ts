"use client";

import { useEffect, useState } from "react";

export function usePagination<T>(items: T[], resetKey: string, initialPageSize = 10) {
  const [state, setState] = useState({ resetKey, page: 1, pageSize: initialPageSize });
  const pageSize = state.pageSize;
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const requestedPage = state.resetKey === resetKey ? state.page : 1;
  const safePage = Math.min(requestedPage, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    page: safePage,
    pageSize,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    setPage: (nextPage: number) => setState((current) => ({
      resetKey,
      page: Math.min(Math.max(1, nextPage), totalPages),
      pageSize: current.pageSize
    })),
    setPageSize: (nextPageSize: number) => setState({ resetKey, page: 1, pageSize: nextPageSize })
  };
}

export function useAutoDismissMessage(duration = 3000) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), duration);
    return () => window.clearTimeout(timer);
  }, [duration, message, setMessage]);

  return [message, setMessage] as const;
}
