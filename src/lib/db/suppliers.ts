import { randomUUID } from "node:crypto";
import { getPool, initDb, formatDbDateTime, normalizeDate } from "./init";
import type { Supplier, SupplierInput, SupplierQuotePreview } from "./types";

// ─── Helper mappers ───────────────────────────────────────────────────────────

export function mapSupplierRow(row: Record<string, unknown>, productsForSupplier: Array<Record<string, unknown>>, quotesForSupplier: SupplierQuotePreview[]): Supplier {
  const quoteCount = productsForSupplier.reduce((sum, product) => sum + Number(product.quoteCount ?? 0), 0);
  const cooperationDates: Date[] = [];
  productsForSupplier.forEach((product) => {
    if (!product.lastCooperationAt) return;
    const date = new Date(String(product.lastCooperationAt));
    if (!Number.isNaN(date.getTime())) {
      cooperationDates.push(date);
    }
  });
  const lastCooperationAt = cooperationDates.sort((a, b) => b.getTime() - a.getTime())[0];
  return {
    id: String(row.id),
    name: String(row.name),
    image: String(row.image),
    businessModel: row.businessModel as import("./types").SupplierBusinessModel,
    region: String(row.region),
    city: String(row.city),
    address: String(row.address),
    shopType: row.shopType as import("./types").SupplierShopType,
    isVerified: Boolean(row.isVerified),
    isCollected: Boolean(row.isCollected),
    shopName: String(row.shopName),
    shopUrl: String(row.shopUrl),
    mainProducts: String(row.mainProducts),
    foundedAt: row.foundedAt ? String(row.foundedAt).slice(0, 10) : "",
    employeeCount: String(row.employeeCount),
    companySize: String(row.companySize),
    annualRevenue: String(row.annualRevenue),
    description: String(row.description),
    responseRate: Number(row.responseRate),
    responseMinutes: Number(row.responseMinutes),
    shipmentDays: Number(row.shipmentDays),
    qualityScore: Number(row.qualityScore),
    productCount: productsForSupplier.length,
    quoteCount,
    inquiryCount: Math.max(quoteCount, productsForSupplier.length * 8),
    cooperationCount: Number(row.cooperationCount),
    lastCooperationAt: lastCooperationAt ? formatDbDateTime(lastCooperationAt.toISOString()).slice(0, 10) : null,
    status: row.status as import("./types").SupplierStatus,
    relatedProducts: productsForSupplier.slice(0, 8).map((product) => ({
      id: String(product.id),
      name: String(product.name),
      sku: String(product.sku),
      image: String(product.image),
      price: Number(product.price)
    })),
    recentQuotes: quotesForSupplier.slice(0, 3),
    createdAt: row.createdAt ? formatDbDateTime(String(row.createdAt)) : ""
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function listSuppliersFromDb(): Promise<Supplier[]> {
  await initDb();
  const supplierResult = await getPool().query(`
    SELECT
      id,
      name,
      image,
      business_model AS "businessModel",
      region,
      city,
      address,
      shop_type AS "shopType",
      is_verified AS "isVerified",
      is_collected AS "isCollected",
      shop_name AS "shopName",
      shop_url AS "shopUrl",
      main_products AS "mainProducts",
      founded_at AS "foundedAt",
      employee_count AS "employeeCount",
      company_size AS "companySize",
      annual_revenue AS "annualRevenue",
      description,
      response_rate AS "responseRate",
      response_minutes AS "responseMinutes",
      shipment_days AS "shipmentDays",
      quality_score AS "qualityScore",
      cooperation_count AS "cooperationCount",
      status,
      created_at AS "createdAt"
    FROM suppliers
    ORDER BY created_at ASC, name ASC
  `);
  const productResult = await getPool().query(`
    SELECT
      p.id,
      p.name,
      p.sku,
      p.image,
      p.price,
      p.supplier,
      COUNT(DISTINCT qi.quote_id) AS "quoteCount",
      MAX(q.created_at) AS "lastCooperationAt"
    FROM products p
    LEFT JOIN quote_items qi ON qi.product_id = p.id
    LEFT JOIN quotes q ON q.id = qi.quote_id
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id ASC
  `);
  const quoteResult = await getPool().query(`
    SELECT DISTINCT ON (p.supplier, q.id)
      p.supplier,
      q.id,
      q.quote_no AS "quoteNo",
      q.product_amount + q.shipping_fee + q.local_fee + q.document_fee + q.customs_fee + q.insurance_fee AS "totalAmount",
      q.created_at AS "createdAt"
    FROM quotes q
    JOIN quote_items qi ON qi.quote_id = q.id
    JOIN products p ON p.id = qi.product_id
    ORDER BY p.supplier, q.id, q.created_at DESC
  `);
  const productsBySupplier = new Map<string, Array<Record<string, unknown>>>();
  const quotesBySupplier = new Map<string, SupplierQuotePreview[]>();
  productResult.rows.forEach((row) => {
    const key = String(row.supplier);
    productsBySupplier.set(key, [...(productsBySupplier.get(key) ?? []), row]);
  });
  quoteResult.rows.forEach((row) => {
    const key = String(row.supplier);
    quotesBySupplier.set(key, [...(quotesBySupplier.get(key) ?? []), {
      id: String(row.id),
      quoteNo: String(row.quoteNo),
      totalAmount: Number(row.totalAmount),
      createdAt: formatDbDateTime(String(row.createdAt))
    }]);
  });
  return supplierResult.rows.map((row) => mapSupplierRow(row, productsBySupplier.get(String(row.name)) ?? [], quotesBySupplier.get(String(row.name)) ?? []));
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  await initDb();
  const id = input.id ?? `sup-${randomUUID()}`;
  await getPool().query(
    `INSERT INTO suppliers (
      id, name, image, business_model, region, city, address, shop_type, is_verified, is_collected,
      shop_name, shop_url, main_products, founded_at, employee_count, company_size, annual_revenue,
      description, response_rate, response_minutes, shipment_days, quality_score, cooperation_count, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
    [
      id,
      input.name,
      input.image ?? "/product-images/product-11.webp",
      input.businessModel ?? "生产厂家",
      input.region ?? "",
      input.city ?? "",
      input.address ?? "",
      input.shopType ?? "1688已采集",
      input.isVerified ?? true,
      input.isCollected ?? true,
      input.shopName ?? input.name,
      input.shopUrl ?? "",
      input.mainProducts ?? "",
      normalizeDate(input.foundedAt),
      input.employeeCount ?? "51-100人",
      input.companySize ?? "中型企业",
      input.annualRevenue ?? "500万 - 1000万",
      input.description ?? "",
      input.responseRate ?? 30,
      input.responseMinutes ?? 15,
      input.shipmentDays ?? 2,
      input.qualityScore ?? 4.8,
      input.cooperationCount ?? 0,
      input.status ?? "active"
    ]
  );
  const supplier = (await listSuppliersFromDb()).find((entry) => entry.id === id);
  if (!supplier) throw new Error("Supplier creation failed");
  return supplier;
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<Supplier | null> {
  await initDb();
  const current = (await listSuppliersFromDb()).find((entry) => entry.id === id);
  if (!current) return null;
  const next = { ...current, ...input };
  await getPool().query(
    `UPDATE suppliers SET
      name = $2,
      image = $3,
      business_model = $4,
      region = $5,
      city = $6,
      address = $7,
      shop_type = $8,
      is_verified = $9,
      is_collected = $10,
      shop_name = $11,
      shop_url = $12,
      main_products = $13,
      founded_at = $14,
      employee_count = $15,
      company_size = $16,
      annual_revenue = $17,
      description = $18,
      response_rate = $19,
      response_minutes = $20,
      shipment_days = $21,
      quality_score = $22,
      cooperation_count = $23,
      status = $24,
      updated_at = now()
     WHERE id = $1`,
    [
      id,
      next.name,
      next.image,
      next.businessModel,
      next.region,
      next.city,
      next.address,
      next.shopType,
      next.isVerified,
      next.isCollected,
      next.shopName,
      next.shopUrl,
      next.mainProducts,
      normalizeDate(next.foundedAt),
      next.employeeCount,
      next.companySize,
      next.annualRevenue,
      next.description,
      next.responseRate,
      next.responseMinutes,
      next.shipmentDays,
      next.qualityScore,
      next.cooperationCount,
      next.status
    ]
  );
  if (input.name && input.name !== current.name) {
    await getPool().query("UPDATE products SET supplier = $2, updated_at = now() WHERE supplier = $1", [current.name, input.name]);
  }
  return (await listSuppliersFromDb()).find((entry) => entry.id === id) ?? null;
}

export async function deleteSupplier(id: string) {
  await initDb();
  const current = (await listSuppliersFromDb()).find((entry) => entry.id === id);
  if (!current) return { ok: false, reason: "供应商不存在" };
  if (current.productCount > 0) {
    return { ok: false, reason: "该供应商已关联产品，不能删除" };
  }
  const result = await getPool().query("DELETE FROM suppliers WHERE id = $1", [id]);
  return { ok: (result.rowCount ?? 0) > 0 };
}

export async function seedSuppliers() {
  const existing = await getPool().query<{ count: string }>("SELECT COUNT(*) AS count FROM suppliers");
  if (Number(existing.rows[0].count) > 0) return;
  const rows: SupplierInput[] = [
    {
      id: "sup-yw-premium",
      name: "义乌市优品衣架有限公司",
      image: "/product-images/product-11.webp",
      businessModel: "生产厂家",
      region: "浙江",
      city: "金华 义乌市",
      address: "浙江省义乌市北苑街道春晖路123号",
      shopType: "实力商家",
      shopName: "优品衣架源头工厂",
      shopUrl: "https://shop.1688.com/sup-yw-premium.html",
      mainProducts: "木质衣架、裤架、植绒衣架",
      foundedAt: "2018-03-15",
      employeeCount: "51-100人",
      companySize: "中型企业",
      annualRevenue: "500万 - 1000万",
      description: "专业生产各类衣架，拥有先进生产设备和完整质量管理体系。",
      responseRate: 32,
      responseMinutes: 15,
      shipmentDays: 2,
      qualityScore: 4.8,
      cooperationCount: 128
    },
    {
      id: "sup-linyi-xincheng",
      name: "临沂鑫诚衣架工厂",
      image: "/product-images/product-12.webp",
      businessModel: "源头工厂",
      region: "山东",
      city: "临沂",
      address: "山东省临沂市兰山区工业园",
      shopType: "1688已采集",
      shopName: "鑫诚衣架工厂店",
      shopUrl: "https://shop.1688.com/sup-linyi-xincheng.html",
      mainProducts: "塑料衣架、防滑衣架、儿童衣架",
      foundedAt: "2016-07-20",
      employeeCount: "101-200人",
      companySize: "中型企业",
      annualRevenue: "1000万 - 3000万",
      description: "主营塑料衣架和防滑系列，支持大货定制和多色生产。",
      responseRate: 28,
      responseMinutes: 20,
      shipmentDays: 3,
      qualityScore: 4.7,
      cooperationCount: 96
    },
    {
      id: "sup-ningbo-youyi",
      name: "宁波优衣家居用品有限公司",
      image: "/product-images/product-6.webp",
      businessModel: "贸易公司",
      region: "浙江",
      city: "宁波",
      address: "浙江省宁波市鄞州区商务中心",
      shopType: "1688已采集",
      shopName: "优衣家居用品店",
      shopUrl: "https://shop.1688.com/sup-ningbo-youyi.html",
      mainProducts: "植绒衣架、家居收纳、衣架配件",
      foundedAt: "2019-05-12",
      employeeCount: "20-50人",
      companySize: "小型企业",
      annualRevenue: "300万 - 500万",
      description: "长期供应植绒衣架和配套家居产品，适合混批订单。",
      responseRate: 30,
      responseMinutes: 18,
      shipmentDays: 4,
      qualityScore: 4.6,
      cooperationCount: 72
    },
    {
      id: "sup-shenzhen-siji",
      name: "深圳四季家居有限公司",
      image: "/product-images/product-8.webp",
      businessModel: "生产厂家",
      region: "广东",
      city: "深圳",
      address: "广东省深圳市龙岗区坂田街道",
      shopType: "普通店铺",
      shopName: "四季家居1688店",
      shopUrl: "https://shop.1688.com/sup-shenzhen-siji.html",
      mainProducts: "金属衣架、裤架、晾晒架",
      foundedAt: "2020-09-01",
      employeeCount: "51-100人",
      companySize: "中型企业",
      annualRevenue: "500万 - 1000万",
      description: "金属衣架和晾晒产品供应商，可配合跨境包装要求。",
      responseRate: 26,
      responseMinutes: 22,
      shipmentDays: 5,
      qualityScore: 4.5,
      cooperationCount: 58
    },
    {
      id: "sup-hongda",
      name: "宏达衣架制造厂",
      image: "/product-images/product-10.webp",
      businessModel: "源头工厂",
      region: "浙江",
      city: "杭州",
      address: "浙江省杭州市萧山区工业园",
      shopType: "1688已采集",
      shopName: "宏达衣架制造厂",
      shopUrl: "https://shop.1688.com/sup-hongda.html",
      mainProducts: "实木衣架、酒店衣架、西装衣架",
      foundedAt: "2015-11-08",
      employeeCount: "51-100人",
      companySize: "中型企业",
      annualRevenue: "800万 - 1500万",
      description: "木质衣架老厂，擅长酒店和品牌定制订单。",
      responseRate: 25,
      responseMinutes: 25,
      shipmentDays: 4,
      qualityScore: 4.7,
      cooperationCount: 88
    }
  ];
  for (const row of rows) {
    await createSupplier(row);
  }
}
