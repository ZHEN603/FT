export type Category = {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  count: number;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  nameEn: string;
  categoryId: string;
  image: string;
  price: number;
  moq: number;
  material: string;
  size: string;
  weightKg: number;
  volumeM3: number;
  supplier: string;
  sourceUrl: string;
  detailAttrs?: ProductDetailAttr[];
  packaging?: ProductPackaging | null;
  specs: ProductSpec[];
};

export type ProductDetailAttr = {
  name: string;
  value: string;
};

export type ProductPackaging = {
  headers: string[];
  rows: string[][];
};

export type ProductSpec = {
  id: string;
  label: string;
  price: number;
  stock: number;
  image?: string;
  skuBody?: string;
  skuColor?: string;
  skuName?: string;
  rankPrice?: number | null;
  priceStatus?: string;
  imageMatch?: string;
  imageSize?: string;
  sortOrder?: number;
};

export type QuoteItem = {
  productId: string;
  specId: string;
  quantity: number;
};

export type Quote = {
  id: string;
  customerName: string;
  company: string;
  country: string;
  port: string;
  whatsapp: string;
  email: string;
  containerType: string;
  productCount: number;
  totalProducts: number;
  productAmount: number;
  shippingFee: number;
  totalAmount: number;
  status: "新询价" | "跟进中" | "已报价" | "已成交" | "已关闭";
  createdAt: string;
};

export type ImportBatch = {
  id: string;
  source: string;
  packageName: string;
  status: string;
  categories: number;
  rawItems: number;
  selectedItems: number;
  deduped: number;
  createdAt: string;
};

export type AdminUser = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "sales" | "operator";
};
