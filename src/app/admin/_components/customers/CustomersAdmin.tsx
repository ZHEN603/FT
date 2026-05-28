"use client";

import {
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Users
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { PaginationFooter } from "../shared/PaginationFooter";
import { SmallMetric } from "../shared/SmallMetric";
import { countryFlag } from "../shared/utils";
import { useAutoDismissMessage, usePagination } from "../shared/hooks";
import { CustomerDetail } from "./CustomerDetail";
import { CustomerEditorModal, emptyCustomer } from "./CustomerEditorModal";
import { usd } from "@/components/shared";
import type { CustomerFormState, CustomerMetrics, CustomerStatus, CustomerWithStats } from "./types";

export function CustomersAdmin({ onOpenConversation }: { onOpenConversation: (target?: { whatsapp?: string; quoteId?: string }) => void }) {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [metrics, setMetrics] = useState<CustomerMetrics>({ total: 0, active: 0, potential: 0, completed: 0, amount: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState<CustomerWithStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useAutoDismissMessage();
  const selected = customers.find((customer) => customer.id === selectedId) ?? customers[0] ?? null;
  const countries = Array.from(new Set(customers.map((customer) => customer.country)));
  const visibleCustomers = customers.filter((customer) => {
    const keyword = query.trim().toLowerCase();
    const matchQuery = !keyword || `${customer.company} ${customer.contactName} ${customer.whatsapp} ${customer.email}`.toLowerCase().includes(keyword);
    const matchCountry = countryFilter === "all" || customer.country === countryFilter;
    const matchGroup = groupFilter === "all" || customer.group === groupFilter;
    const matchStatus = statusFilter === "all" || customer.status === statusFilter;
    return matchQuery && matchCountry && matchGroup && matchStatus;
  });
  const filteredMetrics = {
    total: visibleCustomers.length,
    active: visibleCustomers.filter((customer) => customer.status === "活跃").length,
    potential: visibleCustomers.filter((customer) => customer.status === "潜在" || customer.group === "潜在客户").length,
    completed: visibleCustomers.filter((customer) => customer.completedQuoteCount > 0).length,
    amount: visibleCustomers.reduce((sum, customer) => sum + customer.totalAmount, 0)
  };
  const pagination = usePagination(visibleCustomers, `${query}|${countryFilter}|${groupFilter}|${statusFilter}`);
  const currentCustomerPageIds = pagination.pageItems.map((customer) => customer.id);
  const allCustomersSelected = currentCustomerPageIds.length > 0 && currentCustomerPageIds.every((id) => selectedCustomerIds.has(id));

  async function loadCustomers() {
    setLoading(true);
    await fetch("/api/admin/customers")
      .then((response) => response.json())
      .then((data: { customers: CustomerWithStats[]; metrics: CustomerMetrics }) => {
        setCustomers(data.customers);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.customers[0]?.id ?? null);
        setSelectedCustomerIds(new Set());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCustomers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveCustomer(form: CustomerFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/customers", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { customer: CustomerWithStats };
    setEditing(null);
    setSelectedId(data.customer.id);
    setMessage("客户已保存");
    await loadCustomers();
    return true;
  }

  async function removeCustomer(customer: CustomerWithStats) {
    if (!window.confirm(`确认删除客户 ${customer.company}？历史报价单会保留。`)) return;
    const response = await fetch(`/api/admin/customers?id=${encodeURIComponent(customer.id)}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("客户已删除");
    await loadCustomers();
  }

  function toggleSelectCustomer(id: string) {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllCustomers() {
    setSelectedCustomerIds((current) => {
      const next = new Set(current);
      if (allCustomersSelected) currentCustomerPageIds.forEach((id) => next.delete(id));
      else currentCustomerPageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkUpdateCustomerStatus(status: CustomerStatus) {
    const ids = Array.from(selectedCustomerIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => fetch("/api/admin/customers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })));
    setMessage("已批量更新客户状态");
    await loadCustomers();
  }

  async function bulkRemoveCustomers() {
    const ids = Array.from(selectedCustomerIds);
    if (ids.length === 0 || !window.confirm(`确认删除选中的 ${ids.length} 个客户？历史报价单会保留。`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/admin/customers?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    setSelectedId(null);
    setMessage("已批量删除客户");
    await loadCustomers();
  }

  function resetFilters() {
    setQuery("");
    setCountryFilter("all");
    setGroupFilter("all");
    setStatusFilter("all");
  }

  return (
    <>
      <AdminTop title="客户管理" subtitle="沉淀客户资料、询盘历史与跟进状态">
        <label className="top-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户名称、联系人、WhatsApp..." /></label>
        <button className="admin-light"><Download size={18} /> 导入客户</button>
        <button className="admin-primary" onClick={() => setEditing(emptyCustomer())}><Plus size={18} /> 新增客户</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="客户总数" value={String(filteredMetrics.total)} icon={Users} />
        <SmallMetric label="活跃客户" value={String(filteredMetrics.active)} icon={Users} green />
        <SmallMetric label="潜在客户" value={String(filteredMetrics.potential)} icon={Star} />
        <SmallMetric label="成交客户" value={String(filteredMetrics.completed)} icon={CheckCircle2} purple />
        <SmallMetric label="客户总价值" value={usd.format(filteredMetrics.amount || metrics.amount)} icon={ClipboardList} green />
      </div>
      <div className="customer-admin-grid">
        <section className="admin-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索客户名称、联系人、WhatsApp..." /></label>
            <select value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)}><option value="all">国家/地区</option>{countries.map((country) => <option key={country}>{country}</option>)}</select>
            <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="all">客户分组</option><option>重要客户</option><option>普通客户</option><option>潜在客户</option></select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">客户状态</option><option>活跃</option><option>跟进中</option><option>潜在</option><option>失效</option></select>
            <button onClick={resetFilters}><RefreshCw size={16} /> 重置</button>
            <button><Download size={16} /> 导出</button>
          </div>
          <div className="bulk-bar">
            <span>已选 <strong>{selectedCustomerIds.size}</strong> 个</span>
            <select disabled={selectedCustomerIds.size === 0} onChange={(event) => { if (event.target.value) void bulkUpdateCustomerStatus(event.target.value as CustomerStatus); event.currentTarget.value = ""; }} defaultValue="">
              <option value="">批量状态</option>
              <option>活跃</option><option>跟进中</option><option>潜在</option><option>失效</option>
            </select>
            <button className="danger-action" disabled={selectedCustomerIds.size === 0} onClick={() => void bulkRemoveCustomers()}>批量删除</button>
          </div>
          <div className="admin-table-scroll">
          <table className="admin-table customer-table">
            <thead><tr><th className="sticky-select-col"><input type="checkbox" checked={allCustomersSelected} onChange={toggleSelectAllCustomers} /></th><th>客户名称</th><th>国家/地区</th><th>联系人</th><th>WhatsApp</th><th>邮箱</th><th>客户分组</th><th>累计报价单</th><th>成交金额</th><th>最后跟进时间</th><th className="sticky-status-col">客户状态</th><th className="sticky-actions-col">操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={12}>正在从数据库加载客户...</td></tr>}
              {!loading && visibleCustomers.length === 0 && <tr><td colSpan={12}>暂无客户数据。</td></tr>}
              {pagination.pageItems.map((customer) => (
                <tr key={customer.id} className={selected?.id === customer.id ? "selected" : ""} onClick={() => setSelectedId(customer.id)}>
                  <td className="sticky-select-col"><input type="checkbox" checked={selectedCustomerIds.has(customer.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelectCustomer(customer.id)} /></td>
                  <td><strong>{customer.company}</strong></td>
                  <td>{countryFlag(customer.country)} {customer.country}</td>
                  <td>{customer.contactName}</td>
                  <td>
                    <button
                      className="quote-contact-button"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenConversation({ whatsapp: customer.whatsapp });
                      }}
                    >
                      <MessageCircle size={15} /> {customer.whatsapp || "未留 WhatsApp"}
                    </button>
                  </td>
                  <td>{customer.email}</td>
                  <td><span className="level-pill">{customer.group}</span></td>
                  <td>{customer.quoteCount}</td>
                  <td>{usd.format(customer.totalAmount)}</td>
                  <td>{customer.lastFollowUpAt.slice(0, 10)}</td>
                  <td className="sticky-status-col"><span className={customer.status === "活跃" ? "status-pill active" : "status-pill"}>{customer.status}</span></td>
                  <td className="row-actions sticky-actions-col">
                    <button title="编辑" aria-label="编辑客户" onClick={(event) => { event.stopPropagation(); setEditing(customer); }}><Edit3 size={16} /></button>
                    <button title="删除" aria-label="删除客户" className="danger-action" onClick={(event) => { event.stopPropagation(); void removeCustomer(customer); }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <PaginationFooter
            total={visibleCustomers.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <CustomerDetail customer={selected} onEdit={setEditing} onOpenConversation={onOpenConversation} />}
      </div>
      {editing && <CustomerEditorModal customer={editing} saving={saving} onClose={() => setEditing(null)} onSubmit={saveCustomer} />}
    </>
  );
}
