"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { FtSelect } from "../shared/FtSelect";
import type { Supplier, SupplierBusinessModel, SupplierFormState, SupplierShopType, SupplierStatus } from "./types";

export const supplierBusinessModels: SupplierBusinessModel[] = ["生产厂家", "贸易公司", "源头工厂"];
export const supplierShopTypes: SupplierShopType[] = ["实力商家", "1688已采集", "普通店铺"];

export function emptySupplier(): Supplier {
  return {
    id: "",
    name: "",
    image: "/product-images/product-11.webp",
    businessModel: "生产厂家",
    region: "浙江",
    city: "义乌",
    address: "",
    shopType: "1688已采集",
    isVerified: true,
    isCollected: true,
    shopName: "",
    shopUrl: "",
    mainProducts: "木质衣架、裤架、植绒衣架",
    foundedAt: "",
    employeeCount: "51-100人",
    companySize: "中型企业",
    annualRevenue: "500万 - 1000万",
    description: "",
    responseRate: 30,
    responseMinutes: 15,
    shipmentDays: 2,
    qualityScore: 4.8,
    productCount: 0,
    quoteCount: 0,
    inquiryCount: 0,
    cooperationCount: 0,
    lastCooperationAt: null,
    status: "active",
    relatedProducts: [],
    recentQuotes: [],
    createdAt: ""
  };
}

export function supplierToForm(supplier: Supplier): SupplierFormState {
  return {
    id: supplier.id,
    name: supplier.name,
    image: supplier.image,
    businessModel: supplier.businessModel,
    region: supplier.region,
    city: supplier.city,
    address: supplier.address,
    shopType: supplier.shopType,
    isVerified: supplier.isVerified,
    isCollected: supplier.isCollected,
    shopName: supplier.shopName,
    shopUrl: supplier.shopUrl,
    mainProducts: supplier.mainProducts,
    foundedAt: supplier.foundedAt,
    employeeCount: supplier.employeeCount,
    companySize: supplier.companySize,
    annualRevenue: supplier.annualRevenue,
    description: supplier.description,
    responseRate: String(supplier.responseRate),
    responseMinutes: String(supplier.responseMinutes),
    shipmentDays: String(supplier.shipmentDays),
    qualityScore: String(supplier.qualityScore),
    cooperationCount: String(supplier.cooperationCount),
    status: supplier.status
  };
}

export function SupplierEditorModal({
  supplier,
  saving,
  onClose,
  onSubmit
}: {
  supplier: Supplier;
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: SupplierFormState) => Promise<boolean> | boolean | void;
}) {
  const [form, setForm] = useState<SupplierFormState>(() => supplierToForm(supplier));

  function update<K extends keyof SupplierFormState>(key: K, value: SupplierFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <AdminModalBackdrop>
      <form className="admin-quote-modal quote-detail-modal supplier-modal" onSubmit={(event) => { event.preventDefault(); void onSubmit(form); }}>
        <div className="quote-modal-head">
          <div>
            <h2>{supplier.id ? "编辑供应商" : "新增供应商"}</h2>
            <p>{form.name || "供应商资料"}</p>
          </div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="quote-modal-body">
          <section className="quote-modal-card full">
            <h3>1. 基本信息</h3>
            <div className="quote-info-grid">
              <label>供应商名称<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
              <label>图片地址<input value={form.image} onChange={(event) => update("image", event.target.value)} /></label>
              <label>经营模式<FtSelect value={form.businessModel} options={supplierBusinessModels.map((item) => ({ value: item, label: item }))} onChange={(value) => update("businessModel", value as SupplierBusinessModel)} /></label>
              <label>店铺类型<FtSelect value={form.shopType} options={supplierShopTypes.map((item) => ({ value: item, label: item }))} onChange={(value) => update("shopType", value as SupplierShopType)} /></label>
              <label>省份<input value={form.region} onChange={(event) => update("region", event.target.value)} /></label>
              <label>城市<input value={form.city} onChange={(event) => update("city", event.target.value)} /></label>
              <label>详细地址<input value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
              <label>主营产品<input value={form.mainProducts} onChange={(event) => update("mainProducts", event.target.value)} /></label>
            </div>
          </section>
          <section className="quote-modal-card full">
            <h3>2. 店铺与服务</h3>
            <div className="quote-fee-grid supplier-fee-grid">
              <label>1688店铺<input value={form.shopName} onChange={(event) => update("shopName", event.target.value)} /></label>
              <label>店铺链接<input value={form.shopUrl} onChange={(event) => update("shopUrl", event.target.value)} /></label>
              <label>成立时间<input type="date" value={form.foundedAt} onChange={(event) => update("foundedAt", event.target.value)} /></label>
              <label>员工人数<input value={form.employeeCount} onChange={(event) => update("employeeCount", event.target.value)} /></label>
              <label>公司规模<input value={form.companySize} onChange={(event) => update("companySize", event.target.value)} /></label>
              <label>年交易额<input value={form.annualRevenue} onChange={(event) => update("annualRevenue", event.target.value)} /></label>
              <label>回头率<input type="number" step="0.1" value={form.responseRate} onChange={(event) => update("responseRate", event.target.value)} /></label>
              <label>响应分钟<input type="number" value={form.responseMinutes} onChange={(event) => update("responseMinutes", event.target.value)} /></label>
              <label>发货天数<input type="number" value={form.shipmentDays} onChange={(event) => update("shipmentDays", event.target.value)} /></label>
              <label>质量评分<input type="number" step="0.1" value={form.qualityScore} onChange={(event) => update("qualityScore", event.target.value)} /></label>
              <label>合作次数<input type="number" value={form.cooperationCount} onChange={(event) => update("cooperationCount", event.target.value)} /></label>
              <label>状态<FtSelect value={form.status} options={[{ value: "active", label: "启用" }, { value: "inactive", label: "停用" }]} onChange={(value) => update("status", value as SupplierStatus)} /></label>
            </div>
          </section>
          <section className="quote-modal-card full">
            <h3>3. 公司简介</h3>
            <textarea className="followup-modal-textarea" value={form.description} onChange={(event) => update("description", event.target.value)} />
            <div className="supplier-checks">
              <label><input type="checkbox" checked={form.isVerified} onChange={(event) => update("isVerified", event.target.checked)} /> 已认证</label>
              <label><input type="checkbox" checked={form.isCollected} onChange={(event) => update("isCollected", event.target.checked)} /> 1688已采集</label>
            </div>
          </section>
        </div>
        <div className="quote-modal-actions">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存供应商"}</button>
        </div>
      </form>
    </AdminModalBackdrop>
  );
}
