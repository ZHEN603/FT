"use client";

import { Box, Edit3, MessageCircle, Search } from "lucide-react";
import { useState } from "react";
import { convertCurrency, formatCurrencyAmount, type AdminCurrency } from "../shared/currency";
import { countryFlag } from "../shared/utils";
import { QUOTE_STATUS_META } from "./status";
import type { Quote } from "@/lib/types";
import type { ReactNode } from "react";
import type { QuoteWithItems } from "./types";

export const KANBAN_STATUSES = QUOTE_STATUS_META;

export function QuoteKanbanBoard({
  quotes,
  loading,
  query,
  onQueryChange,
  onStatusChange,
  onEdit,
  onChat,
  toolbarSlot,
  displayCurrency,
  rateMap
}: {
  quotes: QuoteWithItems[];
  loading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  onStatusChange: (quote: QuoteWithItems, status: Quote["status"]) => Promise<void>;
  onEdit: (quote: QuoteWithItems) => void;
  onChat: (quote: QuoteWithItems) => void;
  toolbarSlot?: ReactNode;
  displayCurrency: AdminCurrency;
  rateMap: Map<string, number>;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<Quote["status"] | null>(null);

  function handleDragStart(e: React.DragEvent, quote: QuoteWithItems) {
    setDraggingId(quote.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("quoteId", quote.id);
  }

  function handleDragOver(e: React.DragEvent, status: Quote["status"]) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverCol(status);
  }

  function handleDragLeave() {
    setOverCol(null);
  }

  async function handleDrop(e: React.DragEvent, status: Quote["status"]) {
    e.preventDefault();
    setOverCol(null);
    setDraggingId(null);
    const id = e.dataTransfer.getData("quoteId");
    const quote = quotes.find((q) => q.id === id);
    if (quote && quote.status !== status) {
      await onStatusChange(quote, status);
    }
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverCol(null);
  }

  const colQuotes = (status: Quote["status"]) =>
    quotes.filter((q) => q.status === status);

  return (
    <div className="kanban-wrap">
      <div className="kanban-search">
        {toolbarSlot}
        <label><Search size={16} /><input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="搜索客户 / 报价单编号" /></label>
      </div>
      {loading ? (
        <div className="kanban-loading">加载中...</div>
      ) : (
        <div className="kanban-board">
          {KANBAN_STATUSES.map(({ key, label, color }) => {
            const col = colQuotes(key);
            const isOver = overCol === key;
            return (
              <div
                key={key}
                className={`kanban-col${isOver ? " kanban-col-over" : ""}`}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => void handleDrop(e, key)}
              >
                <div className="kanban-col-head" style={{ borderColor: color }}>
                  <span className="kanban-col-title" style={{ color }}>{label}</span>
                  <span className="kanban-col-count" style={{ background: color }}>{col.length}</span>
                </div>
                <div className="kanban-cards">
                  {col.length === 0 && (
                    <div className="kanban-empty">拖拽卡片至此</div>
                  )}
                  {col.map((quote) => (
                    <div
                      key={quote.id}
                      className={`kanban-card${draggingId === quote.id ? " kanban-card-dragging" : ""}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, quote)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="kanban-card-head">
                        <span className="kanban-card-no">{quote.quoteNo}</span>
                        <button className="kanban-card-edit" title="编辑" onClick={() => onEdit(quote)}><Edit3 size={13} /></button>
                      </div>
                      <div className="kanban-card-company">{quote.company}</div>
                      <div className="kanban-card-country">{countryFlag(quote.country)} {quote.country} · {quote.containerType}</div>
                      <div className="kanban-card-meta">
                        <span><Box size={12} /> {quote.productCount} 种产品</span>
                        <span className="kanban-card-amount"><strong>{formatCurrencyAmount(convertCurrency(quote.totalAmount, quote.currency ?? "USD", displayCurrency, rateMap), displayCurrency)}</strong></span>
                      </div>
                      <div className="kanban-card-foot">
                        <button className="kanban-card-chat" onClick={() => onChat(quote)}>
                          <MessageCircle size={13} /> {quote.whatsapp || "联系"}
                        </button>
                        <span className="kanban-card-date">{quote.createdAt?.slice(0, 10)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
