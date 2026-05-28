"use client";

import {
  Box,
  CheckCircle2,
  Download,
  Edit3,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { AdminTop } from "../shared/AdminTop";
import { PaginationFooter } from "../shared/PaginationFooter";
import { SmallMetric } from "../shared/SmallMetric";
import { useAutoDismissMessage, usePagination } from "../shared/hooks";
import { ProductDetail } from "./ProductDetail";
import { ProductEditor } from "./ProductEditor";
import { normalizeImageList } from "./ProductDetail";
import { categories as fallbackCategories } from "@/lib/mock-data";
import type { Category } from "@/lib/types";
import type { ProductFormState, ProductMetrics, ProductWithStatus } from "./types";

export function ProductListAdmin() {
  const [rows, setRows] = useState<ProductWithStatus[]>([]);
  const [dbCategories, setDbCategories] = useState<Category[]>(fallbackCategories);
  const [metrics, setMetrics] = useState<ProductMetrics>({ total: 0, active: 0, inactive: 0, lowStock: 0, todayNew: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [editing, setEditing] = useState<ProductWithStatus | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useAutoDismissMessage();
  const selected = rows.find((product) => product.id === selectedId) ?? rows[0] ?? null;
  const visibleRows = rows.filter((product) => {
    const keyword = query.trim().toLowerCase();
    const matchQuery = !keyword || `${product.name} ${product.nameEn} ${product.sku} ${product.supplier}`.toLowerCase().includes(keyword);
    const matchCategory = categoryFilter === "all" || product.categoryId === categoryFilter;
    const matchStatus = statusFilter === "all" || product.status === statusFilter;
    const matchStock = stockFilter === "all" || (stockFilter === "low" ? product.stock < 1000 : product.stock >= 1000);
    return matchQuery && matchCategory && matchStatus && matchStock;
  });
  const filteredMetrics = {
    total: visibleRows.length,
    active: visibleRows.filter((product) => product.status === "active").length,
    inactive: visibleRows.filter((product) => product.status === "inactive").length,
    lowStock: visibleRows.filter((product) => product.stock < 1000).length,
    todayNew: 0
  };
  const pagination = usePagination(visibleRows, `${query}|${categoryFilter}|${statusFilter}|${stockFilter}`);
  const currentProductPageIds = pagination.pageItems.map((product) => product.id);
  const allProductsSelected = currentProductPageIds.length > 0 && currentProductPageIds.every((id) => selectedProductIds.has(id));

  async function loadProducts() {
    setLoading(true);
    await fetch("/api/admin/products")
      .then((response) => response.json())
      .then((data: { products: ProductWithStatus[]; categories: Category[]; metrics: ProductMetrics }) => {
        setRows(data.products);
        setDbCategories(data.categories);
        setMetrics(data.metrics);
        setSelectedId((current) => current ?? data.products[0]?.id ?? null);
        setSelectedProductIds(new Set());
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openCreate() {
    setEditing(null);
    setShowEditor(true);
  }

  function openEdit(product: ProductWithStatus) {
    setEditing(product);
    setShowEditor(true);
  }

  async function saveProduct(form: ProductFormState) {
    setSaving(true);
    setMessage("");
    const payload = {
      id: form.id,
      sku: form.sku,
      name: form.name,
      nameEn: form.nameEn,
      categoryId: form.categoryId,
      image: form.image,
      price: Number(form.price),
      moq: Number(form.moq),
      material: form.material,
      size: form.size,
      weightKg: Number(form.weightKg),
      volumeM3: Number(form.volumeM3),
      supplier: form.supplier,
      sourceUrl: form.sourceUrl,
      status: form.status,
      stock: Number(form.stock),
      specs: normalizeImageList(form.images, form.image).map((image, index) => ({
        id: `s${index + 1}`,
        label: index === 0 ? "默认规格" : `图片 ${index + 1}`,
        price: Number(form.price),
        stock: index === 0 ? Number(form.stock) : 0,
        image
      }))
    };
    const response = await fetch("/api/admin/products", {
      method: form.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json() as { message?: string };
      setMessage(data.message ?? "保存失败");
      return;
    }
    const data = await response.json() as { product: ProductWithStatus };
    setShowEditor(false);
    setEditing(null);
    setSelectedId(data.product.id);
    setMessage("产品已保存");
    await loadProducts();
  }

  async function toggleStatus(product: ProductWithStatus) {
    await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, status: product.status === "active" ? "inactive" : "active" })
    });
    setMessage(product.status === "active" ? "产品已下架" : "产品已上架");
    await loadProducts();
  }

  async function removeProduct(product: ProductWithStatus) {
    if (!window.confirm(`确认删除 ${product.name}？`)) return;
    await fetch(`/api/admin/products?id=${encodeURIComponent(product.id)}`, { method: "DELETE" });
    setMessage("产品已删除");
    setSelectedId(null);
    await loadProducts();
  }

  function toggleSelectProduct(id: string) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllProducts() {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (allProductsSelected) currentProductPageIds.forEach((id) => next.delete(id));
      else currentProductPageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function bulkUpdateProductStatus(status: ProductWithStatus["status"]) {
    const selectedProducts = rows.filter((product) => selectedProductIds.has(product.id));
    if (selectedProducts.length === 0) return;
    await Promise.all(selectedProducts.map((product) => fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, status })
    })));
    setMessage(status === "active" ? "已批量上架产品" : "已批量下架产品");
    await loadProducts();
  }

  async function bulkRemoveProducts() {
    const ids = Array.from(selectedProductIds);
    if (ids.length === 0 || !window.confirm(`确认删除选中的 ${ids.length} 个产品？`)) return;
    await Promise.all(ids.map((id) => fetch(`/api/admin/products?id=${encodeURIComponent(id)}`, { method: "DELETE" })));
    setSelectedId(null);
    setMessage("已批量删除产品");
    await loadProducts();
  }

  function resetFilters() {
    setQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStockFilter("all");
  }

  return (
    <>
      <AdminTop title="产品列表" subtitle="管理所有产品信息、库存、价格和展示状态">
        <button className="admin-light"><Download size={18} /> 导出数据</button>
        <button className="admin-primary" onClick={openCreate}><Plus size={18} /> 添加产品</button>
      </AdminTop>
      {message && <div className="admin-message">{message}</div>}
      <div className="admin-metrics five">
        <SmallMetric label="当前结果" value={String(filteredMetrics.total)} icon={Package} />
        <SmallMetric label="上架中" value={String(filteredMetrics.active)} icon={CheckCircle2} green />
        <SmallMetric label="已下架" value={String(filteredMetrics.inactive)} icon={Box} />
        <SmallMetric label="库存预警" value={String(filteredMetrics.lowStock)} icon={ShieldAlert} red />
        <SmallMetric label="全部产品" value={String(metrics.total)} icon={Plus} purple />
      </div>
      <div className="product-admin-grid">
        <section className="admin-panel product-table-panel">
          <div className="admin-filters">
            <label><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索产品名称 / SKU / 关键词..." /></label>
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="all">所有分类</option>
              {dbCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">上架状态</option>
              <option value="active">上架中</option>
              <option value="inactive">已下架</option>
            </select>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)}>
              <option value="all">库存状态</option>
              <option value="ok">库存充足</option>
              <option value="low">库存预警</option>
            </select>
            <button onClick={() => void loadProducts()}><RefreshCw size={16} /> 刷新</button>
            <button onClick={resetFilters}>重置</button>
          </div>
          <div className="bulk-bar">
            <span>已选 <strong>{selectedProductIds.size}</strong> 个</span>
            <button disabled={selectedProductIds.size === 0} onClick={() => void bulkUpdateProductStatus("active")}>批量上架</button>
            <button disabled={selectedProductIds.size === 0} onClick={() => void bulkUpdateProductStatus("inactive")}>批量下架</button>
            <button className="danger-action" disabled={selectedProductIds.size === 0} onClick={() => void bulkRemoveProducts()}>批量删除</button>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead><tr><th className="sticky-select-col"><input type="checkbox" checked={allProductsSelected} onChange={toggleSelectAllProducts} /></th><th>产品信息</th><th>SKU</th><th>分类</th><th>价格 (CNY)</th><th>库存</th><th className="sticky-status-col">状态</th><th className="sticky-actions-col">操作</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8}>正在从数据库加载产品...</td></tr>}
                {!loading && visibleRows.length === 0 && <tr><td colSpan={8}>暂无产品数据。</td></tr>}
                {pagination.pageItems.map((product) => (
                  <tr key={product.id} className={selected?.id === product.id ? "selected" : ""} onClick={() => setSelectedId(product.id)}>
                    <td className="sticky-select-col"><input type="checkbox" checked={selectedProductIds.has(product.id)} onClick={(event) => event.stopPropagation()} onChange={() => toggleSelectProduct(product.id)} /></td>
                    <td className="product-cell"><img src={product.image} alt="" /><strong>{product.name}</strong><span>{product.size}</span></td>
                    <td>{product.sku}</td>
                    <td>{dbCategories.find((entry) => entry.id === product.categoryId)?.name}</td>
                    <td><strong>¥ {(product.price * 31).toFixed(2)}</strong><span>MOQ: {product.moq}</span></td>
                    <td><strong>{product.stock.toLocaleString()}</strong><em>{product.stock < 1000 ? "预警" : "充足"}</em></td>
                    <td className="sticky-status-col">
                      <button
                        className={product.status === "active" ? "toggle on" : "toggle"}
                        aria-label={product.status === "active" ? "点击下架" : "点击上架"}
                        onClick={(event) => { event.stopPropagation(); void toggleStatus(product); }}
                      />
                    </td>
                    <td className="row-actions sticky-actions-col">
                      <button title="编辑" aria-label="编辑产品" onClick={(event) => { event.stopPropagation(); openEdit(product); }}><Edit3 size={16} /></button>
                      <button title="删除" aria-label="删除产品" className="danger-action" onClick={(event) => { event.stopPropagation(); void removeProduct(product); }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter
            total={visibleRows.length}
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </section>
        {selected && <ProductDetail product={selected} categories={dbCategories} onEdit={openEdit} onToggle={toggleStatus} onDelete={removeProduct} />}
      </div>
      {showEditor && (
        <ProductEditor
          product={editing}
          categories={dbCategories}
          saving={saving}
          onClose={() => setShowEditor(false)}
          onSubmit={saveProduct}
        />
      )}
    </>
  );
}
