import type { Category, ImportBatch, Product, Quote } from "./types";

export const categories: Category[] = [
  { id: "wood", name: "木衣架", nameEn: "Wooden Hangers", icon: "hanger", count: 128 },
  { id: "plastic", name: "塑料衣架", nameEn: "Plastic Hangers", icon: "shirt", count: 96 },
  { id: "metal", name: "金属衣架", nameEn: "Metal Hangers", icon: "sparkles", count: 76 },
  { id: "velvet", name: "植绒衣架", nameEn: "Velvet Hangers", icon: "layers", count: 64 },
  { id: "pants", name: "裤架 / 裙架", nameEn: "Pants Hangers", icon: "grip", count: 41 },
  { id: "accessory", name: "衣架配件", nameEn: "Accessories", icon: "boxes", count: 35 }
];

const images = Array.from({ length: 10 }, (_, index) => `/product-images/product-${index + 1}.webp`);

export const products: Product[] = [
  {
    id: "p1",
    sku: "WH-001",
    name: "实木衣架",
    nameEn: "Solid Wood Hanger",
    categoryId: "wood",
    image: images[0],
    price: 0.32,
    moq: 200,
    material: "Lotus wood",
    size: "45cm x 23cm",
    weightKg: 0.28,
    volumeM3: 0.00634,
    supplier: "义乌市优品衣架有限公司",
    sourceUrl: "https://detail.1688.com/offer/7324623.html",
    specs: [
      { id: "s1", label: "45cm with 304 hook - 4MM", price: 1.37, stock: 805278, image: images[0] },
      { id: "s2", label: "42cm with 304 hook - 3MM", price: 0.86, stock: 642497, image: images[1] },
      { id: "s3", label: "32cm kids hanger - 2.5MM", price: 0.65, stock: 985262, image: images[2] }
    ]
  },
  {
    id: "p2",
    sku: "PH-2001",
    name: "防滑塑料衣架",
    nameEn: "Anti-slip Plastic Hanger",
    categoryId: "plastic",
    image: images[3],
    price: 0.18,
    moq: 500,
    material: "PP plastic",
    size: "42cm",
    weightKg: 0.11,
    volumeM3: 0.00473,
    supplier: "临沂鑫诚衣架工厂",
    sourceUrl: "https://detail.1688.com/offer/7324624.html",
    specs: [
      { id: "s1", label: "Black - 42cm", price: 0.18, stock: 92000, image: images[3] },
      { id: "s2", label: "White - 42cm", price: 0.19, stock: 81000, image: images[4] }
    ]
  },
  {
    id: "p3",
    sku: "VH-3001",
    name: "植绒衣架",
    nameEn: "Velvet Hanger",
    categoryId: "velvet",
    image: images[5],
    price: 0.25,
    moq: 300,
    material: "Velvet + ABS",
    size: "40cm",
    weightKg: 0.18,
    volumeM3: 0.00544,
    supplier: "宁波优衣家居用品有限公司",
    sourceUrl: "https://detail.1688.com/offer/7324625.html",
    specs: [
      { id: "s1", label: "Beige - 40cm", price: 0.25, stock: 141000, image: images[5] },
      { id: "s2", label: "Black - 40cm", price: 0.26, stock: 132000, image: images[6] }
    ]
  },
  {
    id: "p4",
    sku: "MH-4001",
    name: "金属衣架",
    nameEn: "Metal Wire Hanger",
    categoryId: "metal",
    image: images[7],
    price: 0.22,
    moq: 200,
    material: "Stainless steel",
    size: "45cm",
    weightKg: 0.22,
    volumeM3: 0.00483,
    supplier: "深圳四季家居有限公司",
    sourceUrl: "https://detail.1688.com/offer/7324626.html",
    specs: [
      { id: "s1", label: "Silver - 45cm", price: 0.22, stock: 65000, image: images[7] },
      { id: "s2", label: "Gold - 42cm", price: 0.35, stock: 37000, image: images[8] }
    ]
  },
  {
    id: "p5",
    sku: "PH-5001",
    name: "裤架 / 裙架",
    nameEn: "Pants & Skirt Hanger",
    categoryId: "pants",
    image: images[9],
    price: 0.28,
    moq: 300,
    material: "Wood + metal clips",
    size: "34cm",
    weightKg: 0.24,
    volumeM3: 0.00245,
    supplier: "宏达衣架制造厂",
    sourceUrl: "https://detail.1688.com/offer/7324627.html",
    specs: [
      { id: "s1", label: "Natural wood with clips", price: 0.28, stock: 72000, image: images[9] }
    ]
  }
];

export const initialQuotes: Quote[] = [
  {
    id: "QT-20260524-001",
    customerName: "Lucas Brown",
    company: "Global Retail Inc.",
    country: "United States",
    port: "Los Angeles",
    whatsapp: "+1 310 555 0188",
    email: "lucas@globalretail.com",
    containerType: "40GP",
    productCount: 8,
    totalProducts: 11300,
    productAmount: 6850,
    shippingFee: 2784.72,
    totalAmount: 9634.72,
    status: "新询价",
    createdAt: "2026-05-24 10:32"
  }
];

export const importBatches: ImportBatch[] = [
  {
    id: "IMP-20260525-001",
    source: "1688",
    packageName: "misc/export",
    status: "已生成草稿",
    categories: 5,
    rawItems: 2110,
    selectedItems: 1375,
    deduped: 735,
    createdAt: "2026-05-25 14:12"
  }
];
