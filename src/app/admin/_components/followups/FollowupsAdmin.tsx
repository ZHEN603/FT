"use client";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Edit3,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { FtSelect } from "../shared/FtSelect";
import { PaginationFooter } from "../shared/PaginationFooter";
import { SmallMetric } from "../shared/SmallMetric";
import { appendDateRangeParams, countryFlag, defaultAdminDateRange, downloadAdminExport, toDateTimeLocal } from "../shared/utils";
import { useAutoDismissMessage, usePagination } from "../shared/hooks";
import { FollowupDetail } from "./FollowupDetail";
import { FollowupEditorModal, emptyFollowup, followupStatuses, followupTypeClass, followupTypes } from "./FollowupEditorModal";
import type { CustomerWithStats } from "../customers/types";
import type { FollowupFormState, FollowupMetrics, FollowupQuoteOption, FollowupRecord, FollowupStatus } from "./types";

export function FollowupsAdmin({ onOpenConversation }: { onOpenConversation: (target?: { whatsapp?: string; quoteId?: string }) => void }) {
  const [followups, setFollowups] = useState<FollowupRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [quotes, setQuotes] = useState<FollowupQuoteOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [{ startDate: defaultStartDate, endDate: defaultEndDate }] = useState(defaultAdminDateRange);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [editing, setEditing] = useState<FollowupRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedFollowupIds, setSelectedFollowupIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useAutoDismissMessage();
  const owners = Array.from(new Set(followups.map((item) => item.owner))).filter(Boolean);
  const selected = followups.find((item) => item.id === selectedId) ?? followups[0] ?? null;
  const visibleFollowups = followups.filter((item) => {
    const keyword = query.trim().toLowerCase();
    const searchable = `${item.company} ${item.contactName} ${item.whatsapp} ${item.quoteNo ?? ""} ${item.content}`.toLowerCase();
    const matchQuery = !keyword || searchable.includes(keyword);
    const matchType = typeFilter === "all" || item.type === typeFilter;
    const matchStatus = statusFilter === "all" || item.status === statusFilter;
    const matchOwner = ownerFilter === "all" || item.owner === ownerFilter;
    return matchQuery && matchType && matchStatus && matchOwner;
  });
  const filteredMetrics: FollowupMetrics = {
    total: visibleFollowups.length,
    today: visibleFollowups.filter((item) => item.createdAt.slice(0, 10) === endDate).length,
    pendingCustomers: new Set(visibleFollowups.filter((item) => item.status === "跟进中").map((item) => item.customerId)).size,
    week: visibleFollowups.filter((item) => {
      if (!item.nextFollowUpAt) return false;
      const due = item.nextFollowUpAt.slice(0, 10);
      return due >= startDate && due <= "2026-05-31";
    }).length,
    closed: visibleFollowups.filter((item) => item.status === "已成交").length
  };
  const pagination = usePagination(visibleFollowups, `${query}|${typeFilter}|${statusFilter}|${ownerFilter}|${startDate}|${endDate}`);
  const currentFollowupPageIds = pagination.pageItems.map((followup) => followup.id);
  const allFollowupsSelected = currentFollowupPageIds.length > 0 && currentFollowupPageIds.every((id) => selectedFollowupIds.has(id));

  const loadFollowups = useCallback(async function loadFollowups() {
    setLoading(true);
    const params = appendDateRangeParams(new URLSearchParams(), startDate, endDate);
    await fetch(`/api/admin/followups?${params.toString()}`)
      .then((response) => response.json())
      .then((data: { followups: FollowupRecord[]; customers: CustomerWithStats[]; quotes: FollowupQuoteOption[]; metrics: FollowupMetrics }) => {
        setFollowups(data.followups);
        setCustomers(data.customers);
        setQuotes(data.quotes);
        setSelectedId((current) => current ?? data.followups[0]?.id ?? null);
        setSelectedFollowupIds(new Set());
      })
      .finally(() => setLoading(false));
  }, [endDate, startDate]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFollowups();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFollowups]);

  async function saveFollowup(form: FollowupFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/followups", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quoteId: form.quoteId || null,
        nextFollowUpAt: form.nextFollowUpAt || null
      })
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { followup: FollowupRecord };
    setEditing(null);
    setSelectedId(data.followup.id);
    setMessage("跟进记录已保存");
    await loadFollowups();
    return true;
  }

  async function removeFollowup(followup: FollowupRecord) {
    if (!window.confirm(`确认删除 ${followup.company} 的这条跟进记录？`)) return;
    const response = await fetch(`/api/admin/followups?id=${encodeURIComponent(followup.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("跟进记录已删除");
    await loadFollowups();
  }

  async function markClosed(followup: FollowupRecord) {
    await saveFollowup({
      id: followup.id,
      customerId: followup.customerId,
      quoteId: followup.quoteId ?? "",
      type: followup.type,
      status: "已成交",
      content: followup.content,
      owner: followup.owner,
      nextFollowUpAt: toDateTimeLocal(followup.nextFollowUpAt)
    });
  }

  function toggleSelectFollowup(id: string) {
    setSelectedFollowupIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFollowups() {
    setSelectedFollowupIds((current) => {
      const next = new Set(current);
      if (allFollowupsSelected) currentFollowupPageIds.forEach((id) => next.delete(id));
      else currentFollowupPageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkUpdateFollowupStatus(status: FollowupStatus) {
    const ids = Array.from(selectedFollowupIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => fetch("/api/admin/followups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })));
    setMessage("已批量更新跟进状态");
    await loadFollowups();
  }

  async function bulkRemoveFollowups() {
    const ids = Array.from(selectedFollowupIds);
    if (ids.length === 0 || !window.confirm(`确认删除选中的 ${ids.length} 条跟进记录？`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/admin/followups?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    setSelectedId(null);
    setMessage("已批量删除跟进记录");
    await loadFollowups();
  }

  function resetFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setOwnerFilter("all");
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  }

  return (
    <>
      <AdminTop title="跟进记录" subtitle="管理客户跟进记录，记录沟通历史，把握跟进进度，提高成交率">
        <label className="date-range-control"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /><span>~</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <button className="admin-light" onClick={resetFilters}><RefreshCw size={16} /> 筛选</button>
        <button className="admin-primary" onClick={() => setEditing(emptyFollowup(customers[0]?.id ?? ""))}><Plus size={18} /> 新建跟进记录</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="跟进记录总数" value={filteredMetrics.total.toLocaleString()} icon={ClipboardList} />
        <SmallMetric label="今日跟进记录" value={String(filteredMetrics.today)} icon={CalendarDays} />
        <SmallMetric label="待跟进客户" value={String(filteredMetrics.pendingCustomers)} icon={Clock} />
        <SmallMetric label="本周需跟进" value={String(filteredMetrics.week)} icon={TrendingUp} purple />
        <SmallMetric label="已成交客户" value={String(filteredMetrics.closed)} icon={CheckCircle2} green />
      </div>
      <div className="followup-admin-grid">
        <section className="admin-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户名称、联系人、WhatsApp..." /></label>
            <FtSelect value={typeFilter} options={[{ value: "all", label: "跟进类型" }, ...followupTypes.map((type) => ({ value: type, label: type }))]} onChange={setTypeFilter} />
            <FtSelect value={statusFilter} options={[{ value: "all", label: "跟进状态" }, ...followupStatuses.map((status) => ({ value: status, label: status }))]} onChange={setStatusFilter} />
            <FtSelect value={ownerFilter} options={[{ value: "all", label: "所有负责人" }, ...owners.map((owner) => ({ value: owner, label: owner }))]} onChange={setOwnerFilter} />
            <button onClick={resetFilters}><RefreshCw size={16} /> 重置</button>
            <button onClick={() => downloadAdminExport("followups")}><Download size={16} /> 导出</button>
          </div>
          <div className="bulk-bar">
            <span>已选 <strong>{selectedFollowupIds.size}</strong> 条</span>
            <FtSelect
              className="bulk-status-select"
              disabled={selectedFollowupIds.size === 0}
              value=""
              options={[{ value: "", label: "批量状态" }, ...followupStatuses.map((status) => ({ value: status, label: status }))]}
              onChange={(value) => { if (value) void bulkUpdateFollowupStatus(value as FollowupStatus); }}
            />
            <button className="danger-action" disabled={selectedFollowupIds.size === 0} onClick={() => void bulkRemoveFollowups()}>批量删除</button>
          </div>
          <div className="admin-table-scroll">
          <table className="admin-table followup-table">
            <thead><tr><th className="sticky-select-col"><input type="checkbox" checked={allFollowupsSelected} onChange={toggleSelectAllFollowups} /></th><th>客户信息</th><th>跟进内容</th><th>跟进类型</th><th>下次跟进时间</th><th>跟进人</th><th>跟进时间</th><th className="sticky-status-col">跟进状态</th><th className="sticky-actions-col">操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={9}>正在从数据库加载跟进记录...</td></tr>}
              {!loading && visibleFollowups.length === 0 && <tr><td colSpan={9}>暂无跟进记录。</td></tr>}
              {pagination.pageItems.map((followup) => (
                <tr key={followup.id} className={selected?.id === followup.id ? "selected" : ""} onClick={() => setSelectedId(followup.id)}>
                  <td className="sticky-select-col"><input type="checkbox" checked={selectedFollowupIds.has(followup.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelectFollowup(followup.id)} /></td>
                  <td>
                    <div className="followup-customer-cell">
                      <span className="country-avatar">{countryFlag(followup.country)}</span>
                      <div>
                        <strong>{followup.company}</strong>
                        <span>{followup.contactName}</span>
                        <button
                          className="quote-contact-button followup-contact-button"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenConversation({ whatsapp: followup.whatsapp, quoteId: followup.quoteId ?? undefined });
                          }}
                        >
                          <MessageCircle size={15} /> {followup.whatsapp || "未留 WhatsApp"}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td><strong>{followup.content}</strong><span>报价单：{followup.quoteNo ?? "-"}</span></td>
                  <td><span className={`followup-type-pill ${followupTypeClass(followup.type)}`}>{followup.type}</span></td>
                  <td>{followup.nextFollowUpAt ?? "-"}</td>
                  <td>{followup.owner}</td>
                  <td>{followup.createdAt}</td>
                  <td className="sticky-status-col"><span className={`status-pill ${followup.status === "已成交" ? "active" : ""}`}>{followup.status}</span></td>
                  <td className="row-actions sticky-actions-col">
                    <button title="编辑" aria-label="编辑跟进记录" onClick={(event) => { event.stopPropagation(); setEditing(followup); }}><Edit3 size={16} /></button>
                    <button title="删除" aria-label="删除跟进记录" className="danger-action" onClick={(event) => { event.stopPropagation(); void removeFollowup(followup); }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <PaginationFooter
            total={visibleFollowups.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && (
          <FollowupDetail
            followup={selected}
            onEdit={setEditing}
            onClose={markClosed}
            onCreate={() => setEditing(emptyFollowup(selected.customerId, selected.quoteId ?? ""))}
            onOpenConversation={onOpenConversation}
          />
        )}
      </div>
      {editing && <FollowupEditorModal followup={editing} customers={customers} quotes={quotes} saving={saving} onClose={() => setEditing(null)} onSubmit={saveFollowup} />}
    </>
  );
}
