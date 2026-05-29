"use client";

import {
  Box,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  Package,
  Plus,
  Search,
  Trash2,
  Users,
  X
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { FtSelect } from "../shared/FtSelect";
import { PaginationFooter } from "../shared/PaginationFooter";
import { SmallMetric } from "../shared/SmallMetric";
import { useAutoDismissMessage, usePagination } from "../shared/hooks";
import { downloadAdminExport } from "../shared/utils";
import { SupplierDetail, SupplierProductMini } from "./SupplierDetail";
import { SupplierEditorModal, emptySupplier, supplierBusinessModels, supplierShopTypes } from "./SupplierEditorModal";
import type { Supplier, SupplierFormState, SupplierMetrics, SupplierStatus } from "./types";

export function SuppliersAdmin() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [metrics, setMetrics] = useState<SupplierMetrics>({ relatedSuppliers: 0, relatedProducts: 0, collectedShops: 0, strongSuppliers: 0, sourceFactories: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("木质衣架");
  const [businessFilter, setBusinessFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [shopFilter, setShopFilter] = useState("all");
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useAutoDismissMessage();
  const regions = Array.from(new Set(suppliers.map((supplier) => supplier.region))).filter(Boolean);
  const selected = suppliers.find((supplier) => supplier.id === selectedId) ?? suppliers[0] ?? null;
  const visibleSuppliers = suppliers.filter((supplier) => {
    const keyword = query.trim().toLowerCase();
    const products = supplier.relatedProducts.map((product) => `${product.name} ${product.sku}`).join(" ");
    const matchQuery = !keyword || `${supplier.name} ${supplier.mainProducts} ${supplier.shopName} ${products}`.toLowerCase().includes(keyword);
    const matchBusiness = businessFilter === "all" || supplier.businessModel === businessFilter;
    const matchRegion = regionFilter === "all" || supplier.region === regionFilter;
    const matchShop = shopFilter === "all" || supplier.shopType === shopFilter;
    return matchQuery && matchBusiness && matchRegion && matchShop;
  });
  const filteredMetrics: SupplierMetrics = {
    relatedSuppliers: visibleSuppliers.length,
    relatedProducts: visibleSuppliers.reduce((sum, supplier) => sum + supplier.productCount, 0),
    collectedShops: visibleSuppliers.filter((supplier) => supplier.isCollected).length,
    strongSuppliers: visibleSuppliers.filter((supplier) => supplier.shopType === "实力商家").length,
    sourceFactories: visibleSuppliers.filter((supplier) => supplier.businessModel === "源头工厂").length
  };
  const pagination = usePagination(visibleSuppliers, `${query}|${businessFilter}|${regionFilter}|${shopFilter}`);
  const currentSupplierPageIds = pagination.pageItems.map((supplier) => supplier.id);
  const allSuppliersSelected = currentSupplierPageIds.length > 0 && currentSupplierPageIds.every((id) => selectedSupplierIds.has(id));

  async function loadSuppliers() {
    setLoading(true);
    await fetch("/api/admin/suppliers")
      .then((response) => response.json())
      .then((data: { suppliers: Supplier[]; metrics: SupplierMetrics }) => {
        setSuppliers(data.suppliers);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.suppliers[0]?.id ?? null);
        setSelectedSupplierIds(new Set());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSuppliers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveSupplier(form: SupplierFormState) {
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/admin/suppliers", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        responseRate: Number(form.responseRate),
        responseMinutes: Number(form.responseMinutes),
        shipmentDays: Number(form.shipmentDays),
        qualityScore: Number(form.qualityScore),
        cooperationCount: Number(form.cooperationCount)
      })
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return false;
    }
    const data = await response.json() as { supplier: Supplier };
    setEditing(null);
    setSelectedId(data.supplier.id);
    setMessage("供应商已保存");
    await loadSuppliers();
    return true;
  }

  async function removeSupplier(supplier: Supplier) {
    if (!window.confirm(`确认删除供应商 ${supplier.name}？已关联产品的供应商不能删除。`)) return;
    const response = await fetch(`/api/admin/suppliers?id=${encodeURIComponent(supplier.id)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({})) as { message?: string };
    if (!response.ok) {
      setMessage(data.message ?? "删除失败");
      return;
    }
    setSelectedId(null);
    setMessage("供应商已删除");
    await loadSuppliers();
  }

  function toggleSelectSupplier(id: string) {
    setSelectedSupplierIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllSuppliers() {
    setSelectedSupplierIds((current) => {
      const next = new Set(current);
      if (allSuppliersSelected) currentSupplierPageIds.forEach((id) => next.delete(id));
      else currentSupplierPageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkUpdateSupplierStatus(status: SupplierStatus) {
    const ids = Array.from(selectedSupplierIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => fetch("/api/admin/suppliers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status })
    })));
    setMessage(status === "active" ? "已批量启用供应商" : "已批量停用供应商");
    await loadSuppliers();
  }

  async function bulkRemoveSuppliers() {
    const ids = Array.from(selectedSupplierIds);
    if (ids.length === 0 || !window.confirm(`确认删除选中的 ${ids.length} 个供应商？已关联产品的供应商不能删除。`)) return;
    const responses = await Promise.all(ids.map((id) => fetch(`/api/admin/suppliers?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    const failed = responses.filter((response) => !response.ok).length;
    setSelectedId(null);
    setMessage(failed ? `已删除 ${ids.length - failed} 个供应商，${failed} 个删除失败` : "已批量删除供应商");
    await loadSuppliers();
  }

  function resetFilters() {
    setQuery("");
    setBusinessFilter("all");
    setRegionFilter("all");
    setShopFilter("all");
  }

  return (
    <>
      <AdminTop title="供应商管理" subtitle="管理1688供应商信息，搜索产品快速找到优质供应商">
        <button className="admin-light" onClick={() => downloadAdminExport("suppliers")}><Download size={18} /> 导出结果</button>
        <button className="admin-primary" onClick={() => setEditing(emptySupplier())}><Plus size={18} /> 新增供应商</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <section className="admin-panel supplier-search-panel">
        <div className="supplier-search-grid">
          <label>产品搜索<div><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="产品名称、SKU、关键词..." />{query && <button type="button" onClick={() => setQuery("")}><X size={14} /></button>}</div></label>
          <label>经营模式<FtSelect value={businessFilter} options={[{ value: "all", label: "全部" }, ...supplierBusinessModels.map((item) => ({ value: item, label: item }))]} onChange={setBusinessFilter} /></label>
          <label>所在地区<FtSelect value={regionFilter} options={[{ value: "all", label: "全部" }, ...regions.map((region) => ({ value: region, label: region }))]} onChange={setRegionFilter} /></label>
          <label>1688店铺类型<FtSelect value={shopFilter} options={[{ value: "all", label: "全部" }, ...supplierShopTypes.map((item) => ({ value: item, label: item }))]} onChange={setShopFilter} /></label>
          <button className="admin-primary">搜索</button>
          <button className="admin-light" onClick={resetFilters}>重置</button>
        </div>
        <p>搜索提示：支持产品名称、SKU、关键词搜索，例如：木质衣架、衣架、hanger</p>
      </section>
      <div className="admin-metrics five">
        <SmallMetric label="相关供应商" value={`${filteredMetrics.relatedSuppliers || metrics.relatedSuppliers} 家`} icon={Users} />
        <SmallMetric label="相关产品" value={`${filteredMetrics.relatedProducts || metrics.relatedProducts} 款`} icon={Box} />
        <SmallMetric label="1688店铺数" value={`${filteredMetrics.collectedShops || metrics.collectedShops} 家`} icon={ClipboardList} />
        <SmallMetric label="实力商家" value={`${filteredMetrics.strongSuppliers || metrics.strongSuppliers} 家`} icon={CheckCircle2} green />
        <SmallMetric label="源头工厂" value={`${filteredMetrics.sourceFactories || metrics.sourceFactories} 家`} icon={Package} purple />
      </div>
      <div className="supplier-admin-grid">
        <section className="admin-panel supplier-list-panel">
          <div className="bulk-bar">
            <span>已选 <strong>{selectedSupplierIds.size}</strong> 个</span>
            <button disabled={selectedSupplierIds.size === 0} onClick={() => void bulkUpdateSupplierStatus("active")}>批量启用</button>
            <button disabled={selectedSupplierIds.size === 0} onClick={() => void bulkUpdateSupplierStatus("inactive")}>批量停用</button>
            <button className="danger-action" disabled={selectedSupplierIds.size === 0} onClick={() => void bulkRemoveSuppliers()}>批量删除</button>
          </div>
          <div className="admin-table-scroll">
          <table className="admin-table supplier-table">
            <thead><tr><th className="sticky-select-col"><input type="checkbox" checked={allSuppliersSelected} onChange={toggleSelectAllSuppliers} /></th><th>供应商信息</th><th>主营产品</th><th>产品信息</th><th>1688店铺信息</th><th>服务数据</th><th className="sticky-actions-col">操作</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7}>正在从数据库加载供应商...</td></tr>}
              {!loading && visibleSuppliers.length === 0 && <tr><td colSpan={7}>暂无供应商数据。</td></tr>}
              {pagination.pageItems.map((supplier) => (
                <tr key={supplier.id} className={selected?.id === supplier.id ? "selected" : ""} onClick={() => setSelectedId(supplier.id)}>
                  <td className="sticky-select-col"><input type="checkbox" checked={selectedSupplierIds.has(supplier.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelectSupplier(supplier.id)} /></td>
                  <td>
                    <div className="supplier-info-cell">
                      <Image src={supplier.image} alt={supplier.name} width={58} height={58} />
                      <div>
                        <strong>{supplier.name}</strong>
                        <span className="supplier-badges"><em>{supplier.shopType}</em>{supplier.isCollected && <em className="green">1688已采集</em>}</span>
                        <span>{supplier.businessModel} | {supplier.region} {supplier.city}</span>
                        <span>主营：{supplier.mainProducts}</span>
                      </div>
                    </div>
                  </td>
                  <td>{supplier.mainProducts}</td>
                  <td><SupplierProductMini products={supplier.relatedProducts} productCount={supplier.productCount} /></td>
                  <td><strong>{supplier.shopName}</strong><span>回头率 {supplier.responseRate}%</span><span>{supplier.isVerified ? "已认证" : "未认证"}</span></td>
                  <td><span>回头率</span><strong>{supplier.responseRate}%</strong><span>响应速度</span><strong>{supplier.responseMinutes} 分钟</strong></td>
                  <td className="row-actions sticky-actions-col">
                    <button title="编辑" aria-label="编辑供应商" onClick={(event) => { event.stopPropagation(); setEditing(supplier); }}><Edit3 size={16} /></button>
                    <button title="删除" aria-label="删除供应商" className="danger-action" onClick={(event) => { event.stopPropagation(); void removeSupplier(supplier); }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <PaginationFooter
            total={visibleSuppliers.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <SupplierDetail supplier={selected} onEdit={setEditing} />}
      </div>
      {editing && <SupplierEditorModal supplier={editing} saving={saving} onClose={() => setEditing(null)} onSubmit={saveSupplier} />}
    </>
  );
}
