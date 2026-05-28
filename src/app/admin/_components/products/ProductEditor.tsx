"use client";

import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminModalBackdrop } from "../shared/AdminModalBackdrop";
import { normalizeImageList, uniqueProductImages } from "./ProductDetail";
import { ProductMarkupTab } from "../markups/ProductMarkupTab";
import type { Category } from "@/lib/types";
import type { ProductFormState, ProductWithStatus } from "./types";
import type { MarkupRule } from "../markups/types";

export function ProductEditor({
  product,
  categories,
  saving,
  onClose,
  onSubmit
}: {
  product: ProductWithStatus | null;
  categories: Category[];
  saving: boolean;
  onClose: () => void;
  onSubmit: (form: ProductFormState) => void;
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
    images: initialImages
  }));
  const [tab, setTab] = useState<"info" | "markup">("info");
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedImage = form.images[selectedImageIndex] ?? form.images[0] ?? form.image;

  useEffect(() => {
    void fetch("/api/admin/markups?page=1&pageSize=1")
      .then((r) => r.json())
      .then((d: { rules?: MarkupRule[] }) => setRules(d.rules ?? []));
  }, []);

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

  function addImage() {
    setForm((current) => {
      const images = [...current.images, ""];
      setSelectedImageIndex(images.length - 1);
      return { ...current, images };
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
      const images = [...current.images, data.url as string];
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

  return (
    <AdminModalBackdrop>
      <form className="admin-product-modal" onSubmit={(event) => { event.preventDefault(); if (tab === "info") onSubmit(form); }}>
        <div className="detail-head">
          <h2>{product ? "编辑产品" : "添加产品"}</h2>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>

        {product && (
          <div className="detail-tabs modal-tabs">
            <button type="button" className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>基本信息</button>
            <button type="button" className={tab === "markup" ? "active" : ""} onClick={() => setTab("markup")}>加价管理</button>
          </div>
        )}

        {tab === "info" ? (
          <>
            <div className="product-images-editor">
              <div className="product-images-head">
                <strong>产品图片</strong>
                <div>
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (file) void uploadImage(file);
                    }}
                  />
                  <button type="button" onClick={() => imageFileInputRef.current?.click()} disabled={uploadingImage}>
                    <Plus size={16} /> {uploadingImage ? "上传中..." : "添加图片"}
                  </button>
                  <button type="button" onClick={addImage}>添加路径</button>
                </div>
              </div>
              <div className="product-image-manager">
                <div className="product-image-stage">
                  <img src={selectedImage || form.image} alt={form.name || "产品图片预览"} />
                </div>
                <div className="product-image-controls">
                  <label>{selectedImageIndex === 0 ? "主图路径" : `图片 ${selectedImageIndex + 1} 路径`}
                    <input
                      required={selectedImageIndex === 0}
                      value={selectedImage}
                      onChange={(event) => updateImage(selectedImageIndex, event.target.value)}
                      placeholder="/product-images/example.webp"
                    />
                  </label>
                  <div>
                    <button type="button" disabled={selectedImageIndex === 0} onClick={() => setAsMainImage(selectedImageIndex)}>设为主图</button>
                    <button type="button" disabled={selectedImageIndex === 0} onClick={() => moveImage(selectedImageIndex, -1)}>前移</button>
                    <button type="button" disabled={selectedImageIndex >= form.images.length - 1} onClick={() => moveImage(selectedImageIndex, 1)}>后移</button>
                    <button type="button" disabled={form.images.length === 1} onClick={() => removeImage(selectedImageIndex)}><Trash2 size={16} /> 删除</button>
                  </div>
                </div>
              </div>
              <div className="product-image-strip">
                {form.images.map((image, index) => (
                  <button
                    className={selectedImageIndex === index ? "active" : ""}
                    type="button"
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    <img src={image || form.image} alt={`产品图片 ${index + 1}`} />
                    <span>{index === 0 ? "主图" : index + 1}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="product-form-grid">
              <label>产品名称<input required value={form.name} onChange={(event) => update("name", event.target.value)} /></label>
              <label>英文名称<input required value={form.nameEn} onChange={(event) => update("nameEn", event.target.value)} /></label>
              <label>SKU<input required value={form.sku} onChange={(event) => update("sku", event.target.value)} /></label>
              <label>分类<select value={form.categoryId} onChange={(event) => update("categoryId", event.target.value)}>
                {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select></label>
              <label>价格 USD<input required type="number" step="0.01" value={form.price} onChange={(event) => update("price", event.target.value)} /></label>
              <label>MOQ<input required type="number" value={form.moq} onChange={(event) => update("moq", event.target.value)} /></label>
              <label>库存<input required type="number" value={form.stock} onChange={(event) => update("stock", event.target.value)} /></label>
              <label>状态<select value={form.status} onChange={(event) => update("status", event.target.value as ProductFormState["status"])}>
                <option value="active">上架中</option>
                <option value="inactive">已下架</option>
              </select></label>
              <label>材质<input value={form.material} onChange={(event) => update("material", event.target.value)} /></label>
              <label>尺寸<input value={form.size} onChange={(event) => update("size", event.target.value)} /></label>
              <label>重量 kg<input required type="number" step="0.01" value={form.weightKg} onChange={(event) => update("weightKg", event.target.value)} /></label>
              <label>体积 m3<input required type="number" step="0.00001" value={form.volumeM3} onChange={(event) => update("volumeM3", event.target.value)} /></label>
              <label>供应商<input value={form.supplier} onChange={(event) => update("supplier", event.target.value)} /></label>
              <label>来源链接<input value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} /></label>
            </div>
            <div className="detail-actions">
              <button className="admin-light" type="button" onClick={onClose}>取消</button>
              <button className="admin-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存产品"}</button>
            </div>
          </>
        ) : (
          <>
            <div className="category-modal-body" style={{ flex: 1, overflowY: "auto" }}>
              <ProductMarkupTab productId={product!.id} originalPrice={product!.price} rules={rules} />
            </div>
            <div className="detail-actions">
              <button className="admin-light" type="button" onClick={onClose}>关闭</button>
            </div>
          </>
        )}
      </form>
    </AdminModalBackdrop>
  );
}
