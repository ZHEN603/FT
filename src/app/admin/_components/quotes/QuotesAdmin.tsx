"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Edit3,
  FileText,
  GripVertical,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { PaginationFooter } from "../shared/PaginationFooter";
import { SmallMetric } from "../shared/SmallMetric";
import { countryFlag, formatDateTime } from "../shared/utils";
import { useAutoDismissMessage, usePagination } from "../shared/hooks";
import { QuoteDetail } from "./QuoteDetail";
import { QuoteEditorModal } from "./QuoteEditorModal";
import { QuoteKanbanBoard } from "./QuoteKanbanBoard";
import { usd } from "@/components/shared";
import type { Quote } from "@/lib/types";
import type { QuoteMetrics, QuoteWithItems } from "./types";

export function QuotesAdmin({ onOpenConversation }: { onOpenConversation: (target?: { whatsapp?: string; quoteId?: string }) => void }) {
  const [quotes, setQuotes] = useState<QuoteWithItems[]>([]);
  const [metrics, setMetrics] = useState<QuoteMetrics>({ total: 0, pending: 0, sent: 0, closed: 0, amount: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [containerFilter, setContainerFilter] = useState("all");
  const [editing, setEditing] = useState<QuoteWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [message, setMessage] = useAutoDismissMessage();
  const selected = quotes.find((quote) => quote.id === selectedId) ?? quotes[0] ?? null;
  const visibleQuotes = quotes.filter((quote) => {
    const keyword = query.trim().toLowerCase();
    const matchQuery = !keyword || `${quote.quoteNo} ${quote.company} ${quote.customerName} ${quote.whatsapp}`.toLowerCase().includes(keyword);
    const matchCountry = countryFilter === "all" || quote.country === countryFilter;
    const matchStatus = statusFilter === "all" || quote.status === statusFilter;
    const matchContainer = containerFilter === "all" || quote.containerType === containerFilter;
    return matchQuery && matchCountry && matchStatus && matchContainer;
  });
  const filteredMetrics = {
    total: visibleQuotes.length,
    pending: visibleQuotes.filter((quote) => quote.status === "新询价" || quote.status === "跟进中").length,
    sent: visibleQuotes.filter((quote) => quote.status === "已报价").length,
    closed: visibleQuotes.filter((quote) => quote.status === "已成交").length,
    amount: visibleQuotes.reduce((sum, quote) => sum + quote.totalAmount, 0)
  };
  const pagination = usePagination(visibleQuotes, `${query}|${countryFilter}|${statusFilter}|${containerFilter}`);
  const currentQuotePageIds = pagination.pageItems.map((quote) => quote.id);
  const allQuotesSelected = currentQuotePageIds.length > 0 && currentQuotePageIds.every((id) => selectedQuoteIds.has(id));
  const countries = Array.from(new Set(quotes.map((quote) => quote.country)));
  const containers = Array.from(new Set(quotes.map((quote) => quote.containerType)));

  async function loadQuotesFromApi() {
    setLoading(true);
    await fetch("/api/admin/quotes")
      .then((response) => response.json())
      .then((data: { quotes: QuoteWithItems[]; metrics: QuoteMetrics }) => {
        setQuotes(data.quotes);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.quotes[0]?.id ?? null);
        setSelectedQuoteIds(new Set());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQuotesFromApi();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function updateQuoteStatus(quote: QuoteWithItems, status: Quote["status"]) {
    const response = await fetch("/api/admin/quotes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...quote, status })
    });
    if (!response.ok) {
      setMessage("状态更新失败");
      return;
    }
    setMessage("报价单状态已更新");
    await loadQuotesFromApi();
  }

  async function saveQuote(form: import("./types").QuoteFormState) {
    if (!editing) return false;
    setSaving(true);
    const payload = {
      ...editing,
      quoteNo: form.quoteNo,
      company: form.company,
      customerName: form.customerName,
      contactName: form.contactName,
      country: form.country,
      port: form.destinationPort,
      destinationPort: form.destinationPort,
      whatsapp: form.whatsapp,
      email: form.email,
      containerType: form.containerType,
      status: form.status,
      productAmount: Number(form.productAmount),
      shippingFee: Number(form.shippingFee),
      localFee: Number(form.localFee),
      documentFee: Number(form.documentFee),
      customsFee: Number(form.customsFee),
      insuranceFee: Number(form.insuranceFee),
      loadedVolumeM3: Number(form.loadedVolumeM3),
      maxVolumeM3: Number(form.maxVolumeM3),
      currentWeightKg: Number(form.currentWeightKg),
      maxWeightKg: Number(form.maxWeightKg),
      createdAt: form.createdAt,
      items: form.items.map((item) => ({
        ...item,
        quantity: Math.max(1, Number(item.quantity || 1)),
        unitPrice: Number(item.unitPrice || 0),
        amount: Math.max(1, Number(item.quantity || 1)) * Number(item.unitPrice || 0)
      }))
    };
    const isNew = !quotes.some((quote) => quote.id === editing.id);
    const response = await fetch("/api/admin/quotes", {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    setEditing(null);
    setMessage("报价单已保存");
    await loadQuotesFromApi();
    return true;
  }

  async function removeQuote(quote: QuoteWithItems) {
    if (!window.confirm(`确认删除 ${quote.quoteNo}？`)) return;
    const response = await fetch(`/api/admin/quotes?id=${encodeURIComponent(quote.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("报价单已删除");
    await loadQuotesFromApi();
  }

  function toggleSelectQuote(id: string) {
    setSelectedQuoteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllQuotes() {
    setSelectedQuoteIds((current) => {
      const next = new Set(current);
      if (allQuotesSelected) currentQuotePageIds.forEach((id) => next.delete(id));
      else currentQuotePageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkUpdateQuoteStatus(status: Quote["status"]) {
    const selectedQuotes = quotes.filter((quote) => selectedQuoteIds.has(quote.id));
    if (selectedQuotes.length === 0) return;
    await Promise.all(selectedQuotes.map((quote) => fetch("/api/admin/quotes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...quote, status })
    })));
    setMessage("已批量更新报价单状态");
    await loadQuotesFromApi();
  }

  async function bulkRemoveQuotes() {
    const ids = Array.from(selectedQuoteIds);
    if (ids.length === 0 || !window.confirm(`确认删除选中的 ${ids.length} 份报价单？`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/admin/quotes?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    setSelectedId(null);
    setMessage("已批量删除报价单");
    await loadQuotesFromApi();
  }

  function openCreateQuote() {
    const now = new Date();
    const quoteNo = `QT-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${String(quotes.length + 1).padStart(3, "0")}`;
    setEditing({
      id: quoteNo,
      quoteNo,
      customerName: "",
      contactName: "",
      company: "",
      country: "美国",
      port: "洛杉矶港",
      destinationPort: "洛杉矶港",
      whatsapp: "",
      email: "",
      containerType: "40GP",
      productCount: 0,
      totalProducts: 0,
      productAmount: 0,
      shippingFee: 0,
      localFee: 0,
      documentFee: 0,
      customsFee: 0,
      insuranceFee: 0,
      totalAmount: 0,
      loadedVolumeM3: 0,
      maxVolumeM3: 67.63,
      currentWeightKg: 0,
      maxWeightKg: 26800,
      status: "新询价",
      createdAt: formatDateTime(now.toISOString()),
      items: []
    });
  }

  function resetFilters() {
    setQuery("");
    setCountryFilter("all");
    setStatusFilter("all");
    setContainerFilter("all");
  }

  const viewModeControl = (
    <div className="quote-view-tabs" aria-label="报价单视图切换">
      <button type="button" className={`qvt-btn${viewMode === "list" ? " qvt-active" : ""}`} onClick={() => setViewMode("list")}>
        <ClipboardList size={15} /> 列表
      </button>
      <button type="button" className={`qvt-btn${viewMode === "kanban" ? " qvt-active" : ""}`} onClick={() => setViewMode("kanban")}>
        <GripVertical size={15} /> 看板
      </button>
    </div>
  );

  return (
    <>
      <AdminTop title="报价单管理" subtitle="统一管理客户报价单，支持查看详情、生成PDF、WhatsApp发送与成交跟进">
        <button className="admin-light">2026-05-01 ~ 2026-05-24 <CalendarDays size={18} /></button>
        <button className="admin-light" onClick={() => void loadQuotesFromApi()}><RefreshCw size={18} /> 刷新</button>
        <button className="admin-primary" onClick={openCreateQuote}><Plus size={18} /> 新建报价单</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="报价单总数" value={String(filteredMetrics.total)} icon={FileText} />
        <SmallMetric label="待处理报价单" value={String(filteredMetrics.pending)} icon={Clock} />
        <SmallMetric label="已发送报价单" value={String(filteredMetrics.sent)} icon={Send} green />
        <SmallMetric label="已成交报价单" value={String(filteredMetrics.closed)} icon={CheckCircle2} purple />
        <SmallMetric label="报价总金额" value={usd.format(filteredMetrics.amount || metrics.amount)} icon={ClipboardList} green />
      </div>

      {viewMode === "kanban" ? (
        <QuoteKanbanBoard
          quotes={visibleQuotes}
          loading={loading}
          query={query}
          onQueryChange={setQuery}
          onStatusChange={updateQuoteStatus}
          onEdit={setEditing}
          onChat={(quote) => onOpenConversation({ whatsapp: quote.whatsapp, quoteId: quote.id })}
          toolbarSlot={viewModeControl}
        />
      ) : (
        <div className="quote-admin-grid">
          <section className="admin-panel">
            <div className="admin-filters">
              <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户 / 报价单编号 / WhatsApp" /></label>
              {viewModeControl}
              <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="all">国家/地区</option>{countries.map((country) => <option key={country} value={country}>{country}</option>)}</select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">报价状态</option><option>新询价</option><option>跟进中</option><option>已报价</option><option>已成交</option><option>已关闭</option></select>
              <button onClick={resetFilters}>时间筛选 <ChevronDown size={16} /></button>
              <select value={containerFilter} onChange={(event) => setContainerFilter(event.target.value)}><option value="all">集装箱类型</option>{containers.map((container) => <option key={container} value={container}>{container}</option>)}</select>
              <button>导出报价单</button>
            </div>
            <div className="bulk-bar">
              <span>已选 <strong>{selectedQuoteIds.size}</strong> 份</span>
              <select disabled={selectedQuoteIds.size === 0} onChange={(event) => { if (event.target.value) void bulkUpdateQuoteStatus(event.target.value as Quote["status"]); event.currentTarget.value = ""; }} defaultValue="">
                <option value="">批量状态</option>
                <option>新询价</option><option>跟进中</option><option>已报价</option><option>已成交</option><option>已关闭</option>
              </select>
              <button className="danger-action" disabled={selectedQuoteIds.size === 0} onClick={() => void bulkRemoveQuotes()}>批量删除</button>
            </div>
            <div className="admin-table-scroll">
            <table className="admin-table quote-table">
              <thead><tr><th className="sticky-select-col"><input type="checkbox" checked={allQuotesSelected} onChange={toggleSelectAllQuotes} /></th><th>报价单编号</th><th>客户名称</th><th>国家/地区</th><th>联系方式</th><th>产品数量</th><th>集装箱类型</th><th>产品金额</th><th>海运费用</th><th>报价总额</th><th>提交时间</th><th className="sticky-status-col">状态</th><th className="sticky-actions-col">操作</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={13}>正在从数据库加载报价单...</td></tr>}
                {!loading && visibleQuotes.length === 0 && <tr><td colSpan={13}>暂无报价单。</td></tr>}
                {pagination.pageItems.map((quote) => (
                  <tr key={quote.id} className={selected?.id === quote.id ? "selected" : ""} onClick={() => setSelectedId(quote.id)}>
                    <td className="sticky-select-col"><input type="checkbox" checked={selectedQuoteIds.has(quote.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelectQuote(quote.id)} /></td>
                    <td>{quote.quoteNo}</td>
                    <td>{quote.company}</td>
                    <td>{countryFlag(quote.country)} {quote.country}</td>
                    <td>
                      <button
                        className="quote-contact-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenConversation({ whatsapp: quote.whatsapp, quoteId: quote.id });
                        }}
                      >
                        <MessageCircle size={15} /> {quote.whatsapp || "未留 WhatsApp"}
                      </button>
                    </td>
                    <td>{quote.productCount} 种产品</td>
                    <td>{quote.containerType}</td>
                    <td>{usd.format(quote.productAmount)}</td>
                    <td>{usd.format(quote.shippingFee)}</td>
                    <td><strong>{usd.format(quote.totalAmount)}</strong></td>
                    <td>{quote.createdAt}</td>
                    <td className="sticky-status-col">
                      <select value={quote.status} onClick={(event) => event.stopPropagation()} onChange={(event) => void updateQuoteStatus(quote, event.target.value as Quote["status"])}>
                        <option>新询价</option><option>跟进中</option><option>已报价</option><option>已成交</option><option>已关闭</option>
                      </select>
                    </td>
                    <td className="row-actions sticky-actions-col">
                      <button title="编辑" aria-label="编辑报价单" onClick={(event) => { event.stopPropagation(); setEditing(quote); }}><Edit3 size={16} /></button>
                      <button title="删除" aria-label="删除报价单" className="danger-action" onClick={(event) => { event.stopPropagation(); void removeQuote(quote); }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <PaginationFooter
              total={visibleQuotes.length}
              page={pagination.page}
              pageSize={pagination.pageSize}
              totalPages={pagination.totalPages}
              onPageChange={pagination.setPage}
              onPageSizeChange={pagination.setPageSize}
            />
          </section>
          {selected && <QuoteDetail quote={selected} onChanged={loadQuotesFromApi} onMessage={setMessage} />}
        </div>
      )}
      {editing && <QuoteEditorModal quote={editing} saving={saving} onClose={() => setEditing(null)} onSubmit={saveQuote} />}
    </>
  );
}
