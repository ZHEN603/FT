"use client";

import { ChevronLeft, ChevronRight, Image as ImageIcon, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { FtCategorySelect } from "../shared/FtCategorySelect";
import { FtSelect } from "../shared/FtSelect";
import { SimpleMarkupControl } from "../shared/SimpleMarkupControl";
import { normalizeImageList, uniqueProductImages } from "./ProductDetail";
import type { ProductFormState, ProductSpecFormState, ProductWithStatus } from "./types";
import type { CategoryWithMeta } from "../categories/types";

function specToFormSpec(product: ProductWithStatus | null, index: number): ProductSpecFormState {
  const spec = product?.specs[index];
  return {
    id: spec?.id ?? `sku-${index + 1}`,
    label: spec?.label ?? (index === 0 ? "默认规格" : `SKU ${index + 1}`),
    price: String(spec?.price ?? product?.price ?? 0),
    stock: String(spec?.stock ?? 0),
    image: spec?.image ?? product?.image ?? "",
    skuBody: spec?.skuBody ?? "",
    skuColor: spec?.skuColor ?? "",
    skuName: spec?.skuName ?? "",
    rankPrice: spec?.rankPrice == null ? "" : String(spec.rankPrice),
    priceStatus: spec?.priceStatus ?? "",
    imageMatch: spec?.imageMatch ?? "",
    imageSize: spec?.imageSize ?? "",
    sortOrder: spec?.sortOrder ?? index
  };
}

function initialSpecs(product: ProductWithStatus | null, image: string) {
  if (product?.specs.length) return product.specs.map((_, index) => specToFormSpec(product, index));
  return [{
    id: "sku-1",
    label: "默认规格",
    price: String(product?.price ?? 0.32),
    stock: String(product?.stock ?? 1000),
    image,
    skuBody: "",
    skuColor: "",
    skuName: "",
    rankPrice: "",
    priceStatus: "",
    imageMatch: "",
    imageSize: "",
    sortOrder: 0
  }];
}

export function ProductEditor({
  product,
  categories,
  saving,
  onClose,
  onSubmit,
  onPrev,
  onNext
}: {
  product: ProductWithStatus | null;
  categories: CategoryWithMeta[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: ProductFormState) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const initialImages = product ? uniqueProductImages(product) : ["/product-images/product-1.webp"];
  const [form, setForm] = useState<ProductFormState>(() => ({
    id: product?.id,
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    nameEn: product?.nameEn ?? "",
    categoryId: product?.categoryId ?? categories[0]?.id ?? "wood",
    image: initialImages[0],
    price: String(product?.price ?? 0.32),
    moq: String(product?.moq ?? 200),
    material: product?.material ?? "Lotus wood",
    size: product?.size ?? "45cm x 23cm",
    weightKg: String(product?.weightKg ?? 0.28),
    volumeM3: String(product?.volumeM3 ?? 0.00634),
    supplier: product?.supplier ?? "",
    sourceUrl: product?.sourceUrl ?? "",
    status: product?.status ?? "active",
    stock: String(product?.stock ?? 1000),
    stockWarning: String(product?.stockWarning ?? 1000),
    images: initialImages,
    specs: initialSpecs(product, initialImages[0]),
    markupValue: product?.markupValue == null ? "" : String(product.markupValue),
    markupType: product?.markupType ?? "percentage"
  }));
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedSpecIndex, setSelectedSpecIndex] = useState(0);
  const [activeEditorTab, setActiveEditorTab] = useState<"base" | "skus" | "markup">("base");
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedImage = form.images[selectedImageIndex] ?? form.images[0] ?? form.image;
  const selectedSpec = form.specs[selectedSpecIndex] ?? form.specs[0];

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => {
      if (key === "image") {
        const image = String(value);
        const images = normalizeImageList([image, ...current.images], image);
        return { ...current, image, images };
      }
      return { ...current, [key]: value };
    });
  }

  function updateImage(index: number, value: string) {
    setForm((current) => {
      const images = current.images.map((image, imageIndex) => imageIndex === index ? value : image);
      return { ...current, image: index === 0 ? value : current.image, images };
    });
  }

  function updateSpec(index: number, patch: Partial<ProductSpecFormState>) {
    setForm((current) => ({
      ...current,
      specs: current.specs.map((spec, specIndex) => specIndex === index ? { ...spec, ...patch } : spec)
    }));
  }

  function addSpec() {
    setActiveEditorTab("skus");
    setForm((current) => {
      const nextIndex = current.specs.length;
      const next = {
        id: `sku-${nextIndex + 1}`,
        label: `SKU ${nextIndex + 1}`,
        price: current.price,
        stock: "0",
        image: current.image,
        skuBody: "",
        skuColor: "",
        skuName: "",
        rankPrice: "",
        priceStatus: "后台编辑价格",
        imageMatch: "",
        imageSize: "",
        sortOrder: nextIndex
      };
      setSelectedSpecIndex(nextIndex);
      return { ...current, specs: [...current.specs, next] };
    });
  }

  function selectSpec(index: number) {
    setSelectedSpecIndex(index);
    setActiveEditorTab("skus");
  }

  function removeSpec(index: number) {
    setForm((current) => {
      if (current.specs.length <= 1) return current;
      const specs = current.specs.filter((_, specIndex) => specIndex !== index).map((spec, specIndex) => ({ ...spec, sortOrder: specIndex }));
      setSelectedSpecIndex((currentIndex) => Math.min(currentIndex >= index ? Math.max(currentIndex - 1, 0) : currentIndex, specs.length - 1));
      return { ...current, specs };
    });
  }

  function moveSpec(index: number, direction: -1 | 1) {
    setForm((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.specs.length) return current;
      const specs = [...current.specs];
      [specs[index], specs[targetIndex]] = [specs[targetIndex], specs[index]];
      const reordered = specs.map((spec, specIndex) => ({ ...spec, sortOrder: specIndex }));
      setSelectedSpecIndex(targetIndex);
      return { ...current, specs: reordered };
    });
  }

  async function uploadImage(file: File) {
    setUploadingImage(true);
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/admin/uploads/product-images", { method: "POST", body });
    setUploadingImage(false);
    const data = await response.json() as { url?: string; message?: string };
    if (!response.ok || !data.url) {
      window.alert(data.message ?? "图片上传失败");
      return;
    }
    setForm((current) => {
      const images = normalizeImageList([...current.images, data.url as string], current.image);
      setSelectedImageIndex(images.length - 1);
      return { ...current, images };
    });
  }

  function removeImage(index: number) {
    setForm((current) => {
      const images = current.images.filter((_, imageIndex) => imageIndex !== index);
      const nextImages = images.length ? images : [current.image];
      setSelectedImageIndex((currentIndex) => Math.min(currentIndex >= index ? Math.max(currentIndex - 1, 0) : currentIndex, nextImages.length - 1));
      return { ...current, image: index === 0 ? nextImages[0] : current.image, images: nextImages };
    });
  }

  function setAsMainImage(index: number) {
    setForm((current) => {
      const image = current.images[index];
      if (!image) return current;
      const images = [image, ...current.images.filter((_, imageIndex) => imageIndex !== index)];
      setSelectedImageIndex(0);
      return { ...current, image, images };
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setForm((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.images.length) return current;
      const images = [...current.images];
      [images[index], images[targetIndex]] = [images[targetIndex], images[index]];
      setSelectedImageIndex(targetIndex);
      return { ...current, image: images[0] ?? current.image, images };
    });
  }

  function handleSubmit() {
    const hasMissingBase = [
      form.name,
      form.nameEn,
      form.sku,
      form.categoryId,
      form.image,
      form.price,
      form.moq,
      form.stock,
      form.stockWarning,
      form.weightKg,
      form.volumeM3
    ].some((value) => String(value ?? "").trim() === "");
    if (hasMissingBase) {
      setActiveEditorTab("base");
      window.alert("请先补全基础信息中的必填字段");
      return;
    }
    const invalidSpecIndex = form.specs.findIndex((spec) => !spec.id.trim() || !spec.label.trim() || String(spec.price).trim() === "" || String(spec.stock).trim() === "");
    if (invalidSpecIndex >= 0) {
      setSelectedSpecIndex(invalidSpecIndex);
      setActiveEditorTab("skus");
      window.alert("请先补全子 SKU 的必填字段");
      return;
    }
    onSubmit(form);
  }

  return (
    <AdminModalBackdrop>
      <form className="admin-product-modal" onSubmit={(event) => { event.preventDefault(); handleSubmit(); }}>
        <div className="admin-modal-titlebar">
          <h2>{product ? "编辑产品" : "添加产品"}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {product && (
              <div className="admin-modal-nav">
                <button type="button" disabled={!onPrev} onClick={onPrev} title="上一个产品"><ChevronLeft size={14} /></button>
                <button type="button" disabled={!onNext} onClick={onNext} title="下一个产品"><ChevronRight size={14} /></button>
              </div>
            )}
            <button type="button" className="admin-modal-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="prod-modal-body">
          <div className="prod-img-panel">
            <div className="prod-img-preview">
              {selectedImage
                ? <img src={selectedImage} alt={form.name || "产品图片"} />
                : <span className="prod-img-empty">无图片</span>}
            </div>

            <div className="prod-img-strip">
              {form.images.map((image, index) => (
                <button
                  type="button"
                  key={`${image}-${index}`}
                  className={`prod-img-thumb${selectedImageIndex === index ? " active" : ""}`}
                  onClick={() => setSelectedImageIndex(index)}
                  title={index === 0 ? "主图" : `图片 ${index + 1}`}
                >
                  <img src={image || "/product-images/product-1.webp"} alt="" />
                  {index === 0 && <span>主</span>}
                </button>
              ))}
              <input
                ref={imageFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadImage(file);
                }}
              />
              <button
                type="button"
                className="prod-img-add"
                onClick={() => imageFileInputRef.current?.click()}
                disabled={uploadingImage}
                title={uploadingImage ? "上传中..." : "上传图片"}
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="prod-img-path">
              <input
                required={selectedImageIndex === 0}
                value={selectedImage}
                onChange={(event) => updateImage(selectedImageIndex, event.target.value)}
                placeholder="图片路径 / URL"
              />
              <div className="prod-img-actions">
                <button type="button" disabled={selectedImageIndex === 0} onClick={() => setAsMainImage(selectedImageIndex)} title="设为主图">主图</button>
                <button type="button" disabled={selectedImageIndex === 0} onClick={() => moveImage(selectedImageIndex, -1)} title="前移"><ChevronLeft size={12} /></button>
                <button type="button" disabled={selectedImageIndex >= form.images.length - 1} onClick={() => moveImage(selectedImageIndex, 1)} title="后移"><ChevronRight size={12} /></button>
                <button type="button" className="btn-danger" disabled={form.images.length === 1} onClick={() => removeImage(selectedImageIndex)} title="删除"><Trash2 size={12} /></button>
              </div>
            </div>

            <div className="prod-sku-nav">
              <div className="prod-sku-nav-head">
                <strong>子 SKU</strong>
                <span>{form.specs.length}</span>
              </div>
              <div className="prod-sku-nav-list">
                {form.specs.map((spec, index) => (
                  <button
                    key={`${spec.id}-${index}`}
                    type="button"
                    className={selectedSpecIndex === index ? "active" : ""}
                    onClick={() => selectSpec(index)}
                    title={spec.label || `SKU ${index + 1}`}
                  >
                    <img src={spec.image || form.image || "/product-images/product-1.webp"} alt="" />
                    <span>{spec.label || spec.skuColor || `SKU ${index + 1}`}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="prod-form-panel">
            <div className="prod-editor-tabs" role="tablist" aria-label="产品编辑区">
              <button type="button" className={activeEditorTab === "base" ? "active" : ""} onClick={() => setActiveEditorTab("base")}>基础信息</button>
              <button type="button" className={activeEditorTab === "skus" ? "active" : ""} onClick={() => setActiveEditorTab("skus")}>子 SKU <span>{form.specs.length}</span></button>
              <button type="button" className={activeEditorTab === "markup" ? "active" : ""} onClick={() => setActiveEditorTab("markup")}>加价设置</button>
            </div>

            {activeEditorTab === "base" && (
              <div className="prod-form-grid prod-tab-panel">
                <label>产品名称<input required value={form.name} onChange={(e) => update("name", e.target.value)} /></label>
                <label>英文名称<input required value={form.nameEn} onChange={(e) => update("nameEn", e.target.value)} /></label>
                <label>SKU<input required value={form.sku} onChange={(e) => update("sku", e.target.value)} /></label>
                <label>分类
                  <FtCategorySelect
                    value={form.categoryId}
                    categories={categories}
                    onChange={(id) => update("categoryId", id)}
                  />
                </label>
                <label>价格 CNY<input required type="number" step="0.01" value={form.price} onChange={(e) => update("price", e.target.value)} /></label>
                <label>MOQ<input required type="number" value={form.moq} onChange={(e) => update("moq", e.target.value)} /></label>
                <label>总库存<input required type="number" value={form.stock} onChange={(e) => update("stock", e.target.value)} /></label>
                <label>库存预警<input required type="number" value={form.stockWarning} onChange={(e) => update("stockWarning", e.target.value)} /></label>
                <label>状态
                  <FtSelect
                    value={form.status}
                    onChange={(v) => update("status", v as ProductFormState["status"])}
                    options={[{ value: "active", label: "上架中" }, { value: "inactive", label: "已下架" }]}
                  />
                </label>
                <label>材质<input value={form.material} onChange={(e) => update("material", e.target.value)} /></label>
                <label>尺寸/包装<input value={form.size} onChange={(e) => update("size", e.target.value)} /></label>
                <label>重量 kg<input required type="number" step="0.01" value={form.weightKg} onChange={(e) => update("weightKg", e.target.value)} /></label>
                <label>体积 m³<input required type="number" step="0.00001" value={form.volumeM3} onChange={(e) => update("volumeM3", e.target.value)} /></label>
                <label>供应商<input value={form.supplier} onChange={(e) => update("supplier", e.target.value)} /></label>
                <label className="full-col">来源链接<input value={form.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} /></label>
              </div>
            )}

            {activeEditorTab === "skus" && (
              <div className="prod-tab-panel">
                <div className="form-section-card prod-sku-editor-card">
                <div className="prod-sku-editor-head">
                  <div>
                    <h3>子 SKU 信息</h3>
                    <p>每个 SKU 可独立维护价格、库存和图片，前台规格选择会使用这里的数据。</p>
                  </div>
                  <button type="button" className="admin-light" onClick={addSpec}><Plus size={14} /> 添加 SKU</button>
                </div>
                {selectedSpec && (
                  <>
                    <div className="prod-sku-editor-grid">
                      <label>SKU ID<input required value={selectedSpec.id} onChange={(e) => updateSpec(selectedSpecIndex, { id: e.target.value })} /></label>
                      <label>展示名称<input required value={selectedSpec.label} onChange={(e) => updateSpec(selectedSpecIndex, { label: e.target.value })} /></label>
                      <label>颜色/款式<input value={selectedSpec.skuColor ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { skuColor: e.target.value })} /></label>
                      <label>规格项<input value={selectedSpec.skuBody ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { skuBody: e.target.value })} /></label>
                      <label>SKU 名称<input value={selectedSpec.skuName ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { skuName: e.target.value })} /></label>
                      <label>价格 CNY<input required type="number" step="0.01" value={selectedSpec.price} onChange={(e) => updateSpec(selectedSpecIndex, { price: e.target.value })} /></label>
                      <label>参考价<input type="number" step="0.01" value={selectedSpec.rankPrice ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { rankPrice: e.target.value })} /></label>
                      <label>库存<input required type="number" value={selectedSpec.stock} onChange={(e) => updateSpec(selectedSpecIndex, { stock: e.target.value })} /></label>
                      <label className="full-col">SKU 图片
                        <div className="sku-image-input">
                          <input value={selectedSpec.image ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { image: e.target.value })} placeholder="SKU 图片路径 / URL" />
                          <button type="button" onClick={() => updateSpec(selectedSpecIndex, { image: selectedImage })} title="使用当前图库图片"><ImageIcon size={14} /></button>
                        </div>
                      </label>
                      <label>价格说明<input value={selectedSpec.priceStatus ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { priceStatus: e.target.value })} /></label>
                      <label>图片尺寸<input value={selectedSpec.imageSize ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { imageSize: e.target.value })} /></label>
                      <label className="full-col">图片来源说明<input value={selectedSpec.imageMatch ?? ""} onChange={(e) => updateSpec(selectedSpecIndex, { imageMatch: e.target.value })} /></label>
                    </div>
                    <div className="prod-sku-editor-actions">
                      <button type="button" className="admin-light" disabled={selectedSpecIndex === 0} onClick={() => moveSpec(selectedSpecIndex, -1)}><ChevronLeft size={14} /> 前移</button>
                      <button type="button" className="admin-light" disabled={selectedSpecIndex >= form.specs.length - 1} onClick={() => moveSpec(selectedSpecIndex, 1)}>后移 <ChevronRight size={14} /></button>
                      <button type="button" className="admin-light danger" disabled={form.specs.length <= 1} onClick={() => removeSpec(selectedSpecIndex)}><Trash2 size={14} /> 删除 SKU</button>
                    </div>
                  </>
                )}
                </div>
              </div>
            )}

            {activeEditorTab === "markup" && (
              <div className="prod-tab-panel">
                <div className="form-section-card">
                <h3>加价设置</h3>
                <SimpleMarkupControl
                  value={form.markupValue}
                  type={form.markupType}
                  onValueChange={(value) => update("markupValue", value)}
                  onTypeChange={(value) => update("markupType", value)}
                  label="产品专属加价"
                  hint={product?.markupSource === "product" ? "当前产品优先使用此设置" : "留空时继承分类或全部产品默认加价"}
                />
                {product && (
                  <p className="simple-markup-summary">
                    当前生效：{product.markupSource === "product" ? "产品" : product.markupSource === "category" ? `分类 ${product.markupSourceName ?? ""}` : product.markupSource === "global" ? "全部产品" : "未设置"}
                    {product.effectiveMarkupValue > 0 ? ` · +${product.effectiveMarkupValue}${product.effectiveMarkupType === "percentage" ? "%" : ""}` : ""}
                  </p>
                )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="admin-modal-footer">
          <button className="admin-light" type="button" onClick={onClose}>取消</button>
          <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存产品"}</button>
        </div>
      </form>
    </AdminModalBackdrop>
  );
}
