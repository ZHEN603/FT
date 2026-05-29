"use client";

import {
  ChevronDown,
  ChevronLeft,
  Download,
  Edit2,
  FileText,
  MessageCircle,
  MessagesSquare,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  UserCheck,
  X
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import type { SupportedCurrency } from "@/lib/db";
import { inferRegionFromPhone } from "@/lib/phone-region";
import type { ProductWithStatus } from "../_components/products/types";
import type { QuoteFormState, QuoteWithItems } from "../_components/quotes/types";
import { QuoteEditorModal } from "../_components/quotes/QuoteEditorModal";
import { QuoteProductPicker, type QuoteProductDraft } from "../_components/quotes/QuoteProductPicker";
import { QUOTE_STATUS_OPTIONS } from "../_components/quotes/status";
import { FtSelect } from "../_components/shared/FtSelect";
import { downloadAdminExport } from "../_components/shared/utils";

/* ── Types ─────────────────────────────────────────────────────── */
type Msg = {
  id: string;
  conversationId: string;
  senderType: "customer" | "admin" | "system";
  sourceText: string;
  translatedText: string;
  direction: "inbound" | "outbound" | "system";
  deliveryStatus?: string | null;
  deliveryError?: string | null;
  createdAt: string;
};

type AdminConversation = {
  id: string;
  customerId: string | null;
  isCustomer: boolean;
  quoteId: string | null;
  channel: "whatsapp" | "site";
  status: "open" | "closed";
  lastMessageAt: string | null;
  customerName: string;
  company: string;
  whatsapp: string;
  email: string;
  country: string;
  destinationPort: string;
  customerNo: string;
  customerGroup: string;
  quoteNo: string | null;
  quoteStatus: string | null;
  messages: Msg[];
};

type CreateQuoteForm = {
  destinationPort: string;
  containerType: string;
  currency: SupportedCurrency;
  items: QuoteProductDraft[];
};

type QuoteItem = {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  image?: string | null;
  nameEn?: string | null;
};

type QuoteDetail = {
  id: string;
  quoteNo: string;
  status: string;
  totalAmount: number;
  destinationPort: string;
  contactName: string;
  company: string;
  customerName: string;
  country: string;
  whatsapp: string;
  email: string;
  containerType: string;
  productAmount: number;
  shippingFee: number;
  localFee: number;
  documentFee: number;
  customsFee: number;
  insuranceFee: number;
  loadedVolumeM3: number;
  maxVolumeM3: number;
  currentWeightKg: number;
  maxWeightKg: number;
  currency: string;
  createdAt: string;
  items: QuoteItem[];
};

type QuoteSnapshot = {
  id: string;
  quoteId: string;
  version: number;
  reason: string;
  triggeredBy: string;
  totalAmount: number;
  items: QuoteItem[];
  quote?: QuoteDetail | null;
  createdAt: string;
};

type ProductCatalogDocument = {
  id: string;
  title: string;
  filePath: string;
  productCount: number;
};

/* One entry per unique customer/contact */
type MergedCustomer = {
  key: string;
  customerId: string | null;
  isCustomer: boolean;
  customerName: string;
  company: string;
  whatsapp: string;
  email: string;
  country: string;
  destinationPort: string;
  customerNo: string;
  customerGroup: string;
  primaryConvId: string;
  activeConvId?: string;
  quoteNos: string[];
  quoteStatuses: Record<string, string>;
  latestMessage: Msg | null;
  lastMessageAt: string | null;
};

type ConversationTarget = {
  whatsapp: string;
  quoteId: string;
};

const usdFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const cnyFmt = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });

const QUOTE_STATUS_COLORS: Record<string, string> = {
  "新询价": "blue",
  "跟进中": "orange",
  "已报价": "purple",
  "已成交": "green",
  "已关闭": "gray",
};

function quoteStatusColor(status: string | null | undefined): string {
  return QUOTE_STATUS_COLORS[status ?? ""] ?? "gray";
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function getConversationTarget(): ConversationTarget {
  if (typeof window === "undefined") return { whatsapp: "", quoteId: "" };
  const params = new URLSearchParams(window.location.search);
  return {
    whatsapp: params.get("whatsapp") ?? "",
    quoteId: params.get("quoteId") ?? "",
  };
}

function findTargetKey(merged: MergedCustomer[], conversations: AdminConversation[], target: ConversationTarget) {
  const targetPhone = normalizePhone(target.whatsapp);
  const byQuote = target.quoteId
    ? conversations.find((conversation) => conversation.quoteId === target.quoteId)
    : null;
  if (byQuote) {
    return merged.find((customer) => customer.customerId === byQuote.customerId)?.key ?? null;
  }
  if (!targetPhone) return null;
  return merged.find((customer) => normalizePhone(customer.whatsapp) === targetPhone)?.key ?? null;
}

function findTargetConversationId(conversations: AdminConversation[], target: ConversationTarget) {
  const targetPhone = normalizePhone(target.whatsapp);
  if (target.quoteId) {
    const byQuote = conversations.find((conversation) => conversation.quoteId === target.quoteId);
    if (byQuote) return byQuote.id;
  }
  if (!targetPhone) return null;
  return conversations.find((conversation) => normalizePhone(conversation.whatsapp) === targetPhone)?.id ?? null;
}

const SNAPSHOT_REASON_LABELS: Record<string, string> = {
  price_edit: "单价修改",
  items_changed: "产品变更",
  sent_to_customer: "发送给客户",
  restored: "版本回溯",
  manual: "手动保存",
};

/* ── Dedup: phone → email → customerId ────────────────────────── */
function mergeByIdentity(convs: AdminConversation[], activeConvId?: string | null): MergedCustomer[] {
  const map = new Map<string, MergedCustomer>();
  for (const conv of convs) {
    const phone = conv.whatsapp.replace(/\D/g, "");
    const email = conv.email.trim().toLowerCase();
    const key = phone || email || conv.customerId || conv.id;
    if (map.has(key)) {
      const mc = map.get(key)!;
      if (conv.quoteNo && !mc.quoteNos.includes(conv.quoteNo)) {
        mc.quoteNos.push(conv.quoteNo);
        if (conv.quoteStatus) mc.quoteStatuses[conv.quoteNo] = conv.quoteStatus;
      }
      if (conv.customerId && !mc.customerId) {
        mc.customerId = conv.customerId;
      }
      if (conv.isCustomer && !mc.isCustomer) {
        mc.isCustomer = true;
      }
      if (activeConvId && conv.id === activeConvId) {
        mc.activeConvId = conv.id;
        mc.primaryConvId = conv.id;
      }
    } else {
      const quoteStatuses: Record<string, string> = {};
      if (conv.quoteNo && conv.quoteStatus) quoteStatuses[conv.quoteNo] = conv.quoteStatus;
      map.set(key, {
        key,
        customerId: conv.customerId,
        isCustomer: conv.isCustomer,
        customerName: conv.customerName,
        company: conv.company,
        whatsapp: conv.whatsapp,
        email: conv.email,
        country: conv.country,
        destinationPort: conv.destinationPort,
        customerNo: conv.customerNo,
        customerGroup: conv.customerGroup,
        primaryConvId: conv.id,
        activeConvId: activeConvId === conv.id ? conv.id : undefined,
        quoteNos: conv.quoteNo ? [conv.quoteNo] : [],
        quoteStatuses,
        latestMessage: conv.messages.at(-1) ?? null,
        lastMessageAt: conv.lastMessageAt,
      });
    }
  }
  return [...map.values()];
}

function buildWaMessage(quote: QuoteDetail, validDays = 30): string {
  const lines: string[] = [
    `*报价单 ${quote.quoteNo}*`,
    `客户：${quote.company || quote.contactName}`,
    `目的港：${quote.destinationPort}`,
    ``,
    `*产品明细：*`,
  ];
  quote.items.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.name || item.sku}  x${item.quantity}  ${usdFmt.format(item.unitPrice)}/件`);
  });
  lines.push(``, `*总计：${usdFmt.format(quote.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))}*`);
  const expire = new Date(Date.now() + validDays * 86400000).toISOString().slice(0, 10);
  lines.push(`有效期至：${expire}`);
  return lines.join("\n");
}

/* ── Auth gate ─────────────────────────────────────────────────── */
export default function ConversationsPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void fetch("/api/auth/me").then((r) => {
      if (r.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent("/admin/conversations")}`;
      } else { setReady(true); }
    }).catch(() => { window.location.href = "/admin/login?redirect=%2Fadmin%2Fconversations"; });
  }, []);
  if (!ready) return (
    <div className="conv-auth-loading">
      <MessagesSquare size={32} strokeWidth={1.2} /><span>验证登录状态...</span>
    </div>
  );
  return <ConversationsApp />;
}

/* ── Main app ───────────────────────────────────────────────────── */
function ConversationsApp() {
  const [conversations, setConversations] = useState<AdminConversation[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [readKeys, setReadKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  /* Right-panel quote state */
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [quoteDetail, setQuoteDetail] = useState<QuoteDetail | null>(null);
  const [customerQuotes, setCustomerQuotes] = useState<QuoteDetail[]>([]);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [panelTab, setPanelTab] = useState<"current" | "history">("current");
  const [snapshots, setSnapshots] = useState<QuoteSnapshot[]>([]);
  const [loadingSnaps, setLoadingSnaps] = useState(false);

  /* Inline price edit */
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [localItems, setLocalItems] = useState<QuoteItem[]>([]);

  /* WA send */
  const [waMessage, setWaMessage] = useState("");
  const [sendingWa, setSendingWa] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [sendingDealReceipt, setSendingDealReceipt] = useState(false);
  const [updatingQuoteStatus, setUpdatingQuoteStatus] = useState(false);

  /* Convert / create-quote */
  const [converting, setConverting] = useState(false);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [createQuoteForm, setCreateQuoteForm] = useState<CreateQuoteForm>({ destinationPort: "", containerType: "20GP", currency: "USD", items: [] });
  const [createQuotePreviewItems, setCreateQuotePreviewItems] = useState<QuoteItem[]>([]);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [panelMsg, setPanelMsg] = useState("");
  const [panelMsgType, setPanelMsgType] = useState<"success" | "error">("success");

  /* Product catalog PDF */
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<ProductWithStatus[]>([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(new Set());
  const [loadingCatalogProducts, setLoadingCatalogProducts] = useState(false);
  const [generatingCatalog, setGeneratingCatalog] = useState(false);
  const [sendingCatalog, setSendingCatalog] = useState(false);
  const [generatedCatalogDoc, setGeneratedCatalogDoc] = useState<ProductCatalogDocument | null>(null);
  const [catalogMessage, setCatalogMessage] = useState("");

  /* Quote selector dropdown */
  const [quoteSelectorOpen, setQuoteSelectorOpen] = useState(false);
  const quoteSelectorRef = useRef<HTMLDivElement>(null);

  /* Quote editor modal */
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [savingQuoteModal, setSavingQuoteModal] = useState(false);
  const [snapForModal, setSnapForModal] = useState<QuoteSnapshot | null>(null);
  const [restoreDraftQuote, setRestoreDraftQuote] = useState<QuoteDetail | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const mergedList = mergeByIdentity(conversations, activeConversationId);
  const activeMerged = mergedList.find((mc) => mc.key === activeKey) ?? null;
  const active = activeMerged
    ? conversations.find((c) => c.id === (activeMerged.activeConvId ?? activeMerged.primaryConvId)) ?? null
    : null;

  const filteredMerged = mergedList.filter((mc) =>
    !search ||
    mc.company.toLowerCase().includes(search.toLowerCase()) ||
    mc.customerName.toLowerCase().includes(search.toLowerCase()) ||
    mc.whatsapp.includes(search)
  );

  /* ── Load conversations ── */
  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/conversations");
      if (!res.ok) return;
      const data = await res.json() as { conversations: AdminConversation[] };
      const list = data.conversations ?? [];
      const merged = mergeByIdentity(list);
      const target = getConversationTarget();
      const targetKey = findTargetKey(merged, list, target);
      const targetConversationId = findTargetConversationId(list, target);
      setConversations(list);
      setActiveKey((prev) => targetKey ?? prev ?? merged[0]?.key ?? null);
      setActiveConversationId((prev) => targetConversationId ?? (prev && list.some((conversation) => conversation.id === prev) ? prev : null));
      setReadKeys((prev) => {
        if (targetKey) return prev.has(targetKey) ? prev : new Set([...prev, targetKey]);
        if (prev.size === 0 && merged[0]) return new Set([merged[0].key]);
        return prev;
      });
    } finally { setLoading(false); }
  }

  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [active?.messages.length]);

  /* ── Pre-fill create-quote form when active conversation changes ── */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (activeMerged) {
        const inferred = inferRegionFromPhone(activeMerged.whatsapp);
        setCreateQuoteForm((prev) => ({
          ...prev,
          destinationPort: activeMerged.destinationPort || "",
          currency: inferred?.currency ?? prev.currency,
          items: []
        }));
        setCreateQuotePreviewItems([]);
      }
      setShowCreateQuote(false);
      setShowCatalogModal(false);
      setSelectedCatalogIds(new Set());
      setGeneratedCatalogDoc(null);
      setCatalogMessage("");
      setPanelMsg("");
      setPanelMsgType("success");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMerged]);

  useEffect(() => {
    if (!showCatalogModal || catalogProducts.length > 0 || loadingCatalogProducts) return;
    let activeRequest = true;
    const timer = window.setTimeout(() => {
      setLoadingCatalogProducts(true);
      fetch("/api/admin/products")
        .then((response) => response.ok ? response.json() : null)
        .then((data: { products?: ProductWithStatus[] } | null) => {
          if (!activeRequest) return;
          setCatalogProducts((data?.products ?? []).filter((product) => product.status === "active"));
        })
        .finally(() => {
          if (activeRequest) setLoadingCatalogProducts(false);
        });
    }, 0);
    return () => {
      activeRequest = false;
      window.clearTimeout(timer);
    };
  }, [showCatalogModal, catalogProducts.length, loadingCatalogProducts]);

  /* ── Load quotes for customer ── */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!activeMerged?.customerId) {
        setCustomerQuotes([]);
        setQuoteDetail(null);
        return;
      }
      setLoadingQuote(true);
      void fetch(`/api/admin/quotes?customerId=${encodeURIComponent(activeMerged.customerId)}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: { quotes?: QuoteDetail[] } | null) => {
          const list = d?.quotes ?? [];
          const targetQuoteId = getConversationTarget().quoteId;
          setCustomerQuotes(list);
          const targetQuote = targetQuoteId ? list.find((q) => q.id === targetQuoteId) ?? null : null;
          const first = targetQuote ?? list[0] ?? null;
          setSelectedQuoteId((prev) => {
            const still = prev && list.some((q) => q.id === prev);
            return targetQuote?.id ?? (still ? prev : (first?.id ?? null));
          });
          setQuoteDetail(first);
          setLocalItems(first?.items ?? []);
          setWaMessage(first ? buildWaMessage(first) : "");
        })
        .finally(() => setLoadingQuote(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMerged?.customerId]);

  /* ── When selectedQuoteId changes, sync quoteDetail ── */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const q = customerQuotes.find((quote) => quote.id === selectedQuoteId) ?? null;
      setQuoteDetail(q);
      setLocalItems(q?.items ?? []);
      setWaMessage(q ? buildWaMessage(q) : "");
      setPanelTab("current");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [customerQuotes, selectedQuoteId]);

  /* ── Load snapshots ── */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!selectedQuoteId || panelTab !== "history") return;
      setLoadingSnaps(true);
      void fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/snapshots`)
        .then((r) => r.ok ? r.json() : null)
        .then((d: { snapshots?: QuoteSnapshot[] } | null) => setSnapshots(d?.snapshots ?? []))
        .finally(() => setLoadingSnaps(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedQuoteId, panelTab]);

  /* ── Inline price save ── */
  async function savePrice(itemId: string) {
    if (!selectedQuoteId) return;
    const price = parseFloat(editingPrice);
    if (isNaN(price) || price < 0) { setEditingItemId(null); return; }
    setLocalItems((prev) => prev.map((i) => i.id === itemId ? { ...i, unitPrice: price, amount: price * i.quantity } : i));
    setEditingItemId(null);
    await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/items/${encodeURIComponent(itemId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitPrice: price })
    });
    const res = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}`);
    if (res.ok) {
      const d = await res.json() as { quote?: QuoteDetail };
      if (d.quote) {
        const updated = d.quote;
        setQuoteDetail(updated);
        setLocalItems(updated.items);
        setCustomerQuotes((prev) => prev.map((q) => q.id === updated.id ? updated : q));
        setWaMessage(buildWaMessage(updated));
      }
    }
  }

  /* ── Restore snapshot ── */
  function snapshotToQuote(snapshot: QuoteSnapshot): QuoteDetail | null {
    if (!quoteDetail) return snapshot.quote ?? null;
    return {
      ...quoteDetail,
      ...(snapshot.quote ?? {}),
      id: quoteDetail.id,
      quoteNo: quoteDetail.quoteNo,
      items: snapshot.quote?.items ?? snapshot.items,
      productAmount: snapshot.quote?.productAmount ?? snapshot.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      totalAmount: snapshot.quote?.totalAmount ?? snapshot.totalAmount
    };
  }

  function openRestoreDraft(form: QuoteFormState) {
    if (!quoteDetail) return;
    const items = form.items.map((item) => ({
      ...item,
      amount: Number(item.unitPrice || 0) * Number(item.quantity || 0)
    }));
    const productAmount = Number(form.productAmount || items.reduce((sum, item) => sum + item.amount, 0));
    const shippingFee = Number(form.shippingFee || 0);
    const localFee = Number(form.localFee || 0);
    const documentFee = Number(form.documentFee || 0);
    const customsFee = Number(form.customsFee || 0);
    const insuranceFee = Number(form.insuranceFee || 0);
    setRestoreDraftQuote({
      ...quoteDetail,
      ...form,
      id: quoteDetail.id,
      quoteNo: quoteDetail.quoteNo,
      customerName: form.customerName,
      contactName: form.contactName,
      destinationPort: form.destinationPort,
      productAmount,
      shippingFee,
      localFee,
      documentFee,
      customsFee,
      insuranceFee,
      loadedVolumeM3: Number(form.loadedVolumeM3 || 0),
      maxVolumeM3: Number(form.maxVolumeM3 || 0),
      currentWeightKg: Number(form.currentWeightKg || 0),
      maxWeightKg: Number(form.maxWeightKg || 0),
      totalAmount: productAmount + shippingFee + localFee + documentFee + customsFee + insuranceFee,
      items
    });
    setSnapForModal(null);
  }

  /* ── Save quote from editor modal ── */
  async function saveQuoteModal(form: QuoteFormState): Promise<boolean> {
    setSavingQuoteModal(true);
    try {
      if (restoreDraftQuote && selectedQuoteId) {
        await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/snapshots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "restored", triggeredBy: "admin" })
        });
      }
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(form.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productAmount: Number(form.productAmount),
          shippingFee: Number(form.shippingFee),
          localFee: Number(form.localFee),
          documentFee: Number(form.documentFee),
          customsFee: Number(form.customsFee),
          insuranceFee: Number(form.insuranceFee),
          loadedVolumeM3: Number(form.loadedVolumeM3),
          maxVolumeM3: Number(form.maxVolumeM3),
          currentWeightKg: Number(form.currentWeightKg),
          maxWeightKg: Number(form.maxWeightKg),
        })
      });
      if (!res.ok) return false;
      const d = await res.json() as { quote?: QuoteDetail };
      if (d.quote) {
        setQuoteDetail(d.quote);
        setLocalItems(d.quote.items);
        setCustomerQuotes((prev) => prev.map((q) => q.id === d.quote!.id ? d.quote! : q));
        setWaMessage(buildWaMessage(d.quote));
      }
      setShowQuoteModal(false);
      setRestoreDraftQuote(null);
      return true;
    } finally {
      setSavingQuoteModal(false);
    }
  }

  /* ── Send text message ── */
  async function send() {
    if (!active || !message.trim() || sending) return;
    const text = message.trim();
    setMessage("");
    setSending(true);
    try {
      await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, senderId: "admin-001" })
      });
      await load();
    } finally { setSending(false); }
  }

  /* ── Send WA quote message ── */
  async function sendWa() {
    if (!active || !waMessage.trim() || sendingWa || quoteDetail?.status === "已成交") return;
    setSendingWa(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      if (selectedQuoteId) {
        await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/snapshots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "sent_to_customer" })
        });
        const res = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "已报价" })
        });
        if (res.ok) {
          const d = await res.json() as { quote?: QuoteDetail };
          if (d.quote) {
            setQuoteDetail(d.quote);
            setCustomerQuotes((prev) => prev.map((q) => q.id === d.quote!.id ? d.quote! : q));
          }
        }
      }
      await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: waMessage, senderId: "admin-001" })
      });
      setPanelMsg("报价内容已发送至 WhatsApp");
      await load();
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "发送报价失败");
    } finally { setSendingWa(false); }
  }

  /* ── Generate PDF ── */
  async function generatePdf(type: "quote_pdf" | "deal_receipt" = "quote_pdf") {
    if (!selectedQuoteId || generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      if (!res.ok) return null;
      const d = await res.json() as { document?: { id: string; filePath: string; title: string } };
      if (d.document) {
        window.open(`/api/storefront/documents/${d.document.id}`, "_blank");
        return d.document;
      }
      return null;
    } finally { setGeneratingPdf(false); }
  }

  /* ── Send with PDF ── */
  async function sendWithPdf() {
    if (!active || !selectedQuoteId || sendingWa || generatingPdf || sendingDealReceipt) return;
    const isDeal = quoteDetail?.status === "已成交";
    setSendingWa(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      const document = await generatePdf(isDeal ? "deal_receipt" : "quote_pdf");
      if (!document) {
        setPanelMsgType("error");
        setPanelMsg(isDeal ? "生成成交单 PDF 失败" : "生成报价单 PDF 失败");
        return;
      }
      await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "sent_to_customer" })
      });
      await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id, mode: isDeal ? "deal" : "quote" })
      });
      const pdfMsg = isDeal
        ? `[成交单PDF已发送]\n${quoteDetail?.quoteNo ?? ""}`
        : (waMessage.trim() || `[报价单PDF已发送]\n${quoteDetail?.quoteNo ?? ""}`);
      await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: pdfMsg, senderId: "admin-001" })
      });
      const qRes = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}`);
      if (qRes.ok) {
        const d = await qRes.json() as { quote?: QuoteDetail };
        if (d.quote) {
          setQuoteDetail(d.quote);
          setCustomerQuotes((prev) => prev.map((q) => q.id === d.quote!.id ? d.quote! : q));
        }
      }
      setPanelMsg(isDeal ? "成交单 PDF 已生成并发送" : "报价单 PDF 已生成并发送");
      await load();
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "生成并发送 PDF 失败");
    } finally { setSendingWa(false); }
  }

  async function sendDealMessage() {
    if (!selectedQuoteId || sendingDealReceipt) return;
    setSendingDealReceipt(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "deal" })
      });
      const data = await res.json().catch(() => ({})) as {
        record?: { status: string; accessUrl: string | null; error?: string | null };
        message?: string;
      };
      if (!res.ok || !data.record) {
        setPanelMsgType("error");
        setPanelMsg(data.message ?? "发送成交单失败");
        return;
      }
      const qRes = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}`);
      if (qRes.ok) {
        const d = await qRes.json() as { quote?: QuoteDetail };
        if (d.quote) applyQuoteUpdate(d.quote);
      }
      const fallback = data.record.accessUrl ?? data.record.error ?? "";
      setPanelMsg(data.record.status === "sent" ? "成交单已通过 WhatsApp 发送" : `成交单发送记录已生成${fallback ? `：${fallback}` : ""}`);
      await load();
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "发送成交单失败");
    } finally {
      setSendingDealReceipt(false);
    }
  }

  /* ── Close quote selector on outside click ── */
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (quoteSelectorRef.current && !quoteSelectorRef.current.contains(e.target as Node)) {
        setQuoteSelectorOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function selectCustomer(key: string, conversationId?: string | null) {
    setActiveKey(key);
    setActiveConversationId(conversationId ?? null);
    setReadKeys((prev) => prev.has(key) ? prev : new Set([...prev, key]));
    setPanelTab("current");
    setEditingItemId(null);
    setPanelMsg("");
  }

  /* ── Convert contact to customer ── */
  async function convertToCustomer() {
    if (!active || converting || !isPreQuoteContact) return;
    setConverting(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/convert`, { method: "POST" });
      if (res.ok) {
        setPanelMsgType("success");
        setPanelMsg("已成功转为客户");
        await load();
      } else {
        const d = await res.json() as { message?: string };
        setPanelMsgType("error");
        setPanelMsg(d.message ?? "转换失败");
      }
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "转换失败");
    } finally { setConverting(false); }
  }

  /* ── Create new quote for this conversation ── */
  async function submitCreateQuote() {
    if (!active || creatingQuote) return;
    setCreatingQuote(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createQuoteForm)
      });
      const d = await res.json().catch(() => ({})) as { quote?: QuoteDetail; message?: string };
      if (res.ok) {
        if (!d.quote) {
          setPanelMsgType("error");
          setPanelMsg("报价单已创建但返回数据为空，请刷新后查看");
          await load();
          return;
        }
        setShowCreateQuote(false);
        setCreateQuoteForm((prev) => ({ ...prev, items: [] }));
        setCreateQuotePreviewItems([]);
        setPanelMsgType("success");
        setPanelMsg(`报价单 ${d.quote?.quoteNo ?? ""} 已创建`);
        setCustomerQuotes((prev) => [d.quote!, ...prev.filter((quote) => quote.id !== d.quote!.id)]);
        setSelectedQuoteId(d.quote.id);
        setQuoteDetail(d.quote);
        setLocalItems(d.quote.items ?? []);
        setWaMessage(buildWaMessage(d.quote));
        setPanelTab("current");
        await load();
      } else {
        setPanelMsgType("error");
        setPanelMsg(d.message ?? "创建失败");
      }
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "创建失败");
    } finally { setCreatingQuote(false); }
  }

  function addCreateQuoteItem(draft: QuoteProductDraft, preview: QuoteItem) {
    setCreateQuoteForm((current) => ({ ...current, items: [...current.items, draft] }));
    setCreateQuotePreviewItems((current) => [...current, preview]);
  }

  function removeCreateQuoteItem(index: number) {
    setCreateQuoteForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }));
    setCreateQuotePreviewItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function openCatalogModal() {
    setShowCatalogModal(true);
    setGeneratedCatalogDoc(null);
    setCatalogMessage(`您好，产品目录已生成。请查看目录并回复需要报价的产品和数量。`);
  }

  function toggleCatalogProduct(productId: string) {
    setSelectedCatalogIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
    setGeneratedCatalogDoc(null);
  }

  function toggleCatalogCheckbox(event: React.ChangeEvent<HTMLInputElement>, productId: string) {
    event.stopPropagation();
    toggleCatalogProduct(productId);
  }

  function selectVisibleCatalogProducts(products: ProductWithStatus[]) {
    setSelectedCatalogIds((current) => {
      const next = new Set(current);
      products.forEach((product) => next.add(product.id));
      return next;
    });
    setGeneratedCatalogDoc(null);
  }

  async function generateCatalogPdf() {
    if (!active || generatingCatalog || selectedCatalogIds.size === 0) return;
    setGeneratingCatalog(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      const items = Array.from(selectedCatalogIds).map((productId) => {
        const product = catalogProducts.find((entry) => entry.id === productId);
        return { productId, specId: product?.specs[0]?.id ?? null };
      });
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/catalog-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items })
      });
      const data = await res.json().catch(() => ({})) as { document?: ProductCatalogDocument; message?: string };
      if (!res.ok || !data.document) {
        setPanelMsgType("error");
        setPanelMsg(data.message ?? "生成产品目录失败");
        return;
      }
      setGeneratedCatalogDoc(data.document);
      setPanelMsgType("success");
      setPanelMsg("产品目录已生成，可以查看或发送给客户");
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "生成产品目录失败");
    } finally {
      setGeneratingCatalog(false);
    }
  }

  async function sendCatalogPdf() {
    if (!active || !generatedCatalogDoc || sendingCatalog) return;
    setSendingCatalog(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/catalog-document/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: generatedCatalogDoc.id, message: catalogMessage, senderId: "admin-001" })
      });
      const data = await res.json().catch(() => ({})) as { message?: string; record?: { status?: string; error?: string | null } };
      if (!res.ok) {
        setPanelMsgType("error");
        setPanelMsg(data.message ?? "发送产品目录失败");
        return;
      }
      setPanelMsgType(data.record?.status === "failed" ? "error" : "success");
      setPanelMsg(data.record?.status === "sent" ? "产品目录已通过 WhatsApp 发送" : "产品目录已生成，WhatsApp 发送待处理");
      setShowCatalogModal(false);
      await load();
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "发送产品目录失败");
    } finally {
      setSendingCatalog(false);
    }
  }

  const waUrl = active
    ? `https://wa.me/${active.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("您好，我是报价团队。")}`
    : "#";

  const localTotal = localItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const quoteLookupPending = Boolean(activeMerged?.customerId) && loadingQuote;
  const hasAssociatedQuote = !quoteLookupPending && Boolean(active?.quoteId || activeMerged?.quoteNos.length || customerQuotes.length);
  const isPreQuoteContact = Boolean(active) && !active?.isCustomer && !quoteLookupPending && !hasAssociatedQuote;
  const canGenerateProductCatalog = active ? (!active.isCustomer || active.channel === "site") : false;
  const activeDisplayName = active ? (active.company || active.customerName || active.whatsapp || "未命名联系人") : "";
  const activeContactName = active?.customerName && active.customerName !== activeDisplayName ? active.customerName : "";
  const activeQuoteCount = customerQuotes.length || activeMerged?.quoteNos.length || (active?.quoteNo ? 1 : 0);
  const visibleCatalogProducts = catalogProducts.filter((product) => {
    const keyword = catalogSearch.trim().toLowerCase();
    if (!keyword) return true;
    return `${product.name} ${product.nameEn} ${product.sku} ${product.material}`.toLowerCase().includes(keyword);
  }).slice(0, 80);

  function applyQuoteUpdate(next: QuoteDetail) {
    setQuoteDetail(next);
    setLocalItems(next.items);
    setCustomerQuotes((prev) => prev.map((q) => q.id === next.id ? next : q));
    setWaMessage(buildWaMessage(next));
  }

  async function updateQuoteStatus(status: string) {
    if (!selectedQuoteId || !quoteDetail || updatingQuoteStatus || status === quoteDetail.status) return;
    setUpdatingQuoteStatus(true);
    setPanelMsg("");
    setPanelMsgType("success");
    try {
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({})) as { quote?: QuoteDetail; message?: string };
      if (!res.ok || !data.quote) {
        setPanelMsgType("error");
        setPanelMsg(data.message ?? "状态更新失败");
        return;
      }
      applyQuoteUpdate(data.quote);
      setPanelMsg(`报价单 ${data.quote.quoteNo} 状态已更新为 ${data.quote.status}`);
      await load();
    } catch (error) {
      setPanelMsgType("error");
      setPanelMsg(error instanceof Error ? error.message : "状态更新失败");
    } finally {
      setUpdatingQuoteStatus(false);
    }
  }

  return (
    <>
    <div className="conv-standalone">
      {/* ── Top bar ── */}
      <header className="conv-standalone-head">
        <div className="conv-standalone-title">
          <a className="conv-back-link" href="/admin" title="返回后台">
            <ChevronLeft size={18} />
            返回后台
          </a>
          <div className="conv-standalone-heading">
            <span><MessagesSquare size={18} /> 沟通中心</span>
            <p>集中处理客户消息、WhatsApp 沟通与报价单协作</p>
          </div>
          <span className="conv-standalone-count">{mergedList.length} 个客户</span>
        </div>
        <div className="conv-head-actions">
          <button className="conv-refresh-btn" onClick={() => downloadAdminExport("conversations")} title="导出沟通中心数据">
            <Download size={15} />
            导出
          </button>
          <button className="conv-refresh-btn" onClick={() => void load()} title="刷新">
            <RefreshCw size={15} className={loading ? "conv-spin" : ""} />
            刷新
          </button>
        </div>
      </header>

      <div className="conv-body">
        {/* ── Left: session list ── */}
        <aside className="conv-list">
          <div className="conv-search">
            <Search size={14} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索客户 / WhatsApp" />
          </div>
          <div className="conv-items">
            {loading && <div className="conv-empty-tip">正在加载...</div>}
            {!loading && !filteredMerged.length && <div className="conv-empty-tip">暂无会话</div>}
            {filteredMerged.map((mc) => {
              const isActive = mc.key === activeKey;
              const isUnread = !readKeys.has(mc.key);
              const displayName = mc.company || mc.customerName;
              const maxVisible = 3;
              const visibleQuotes = mc.quoteNos.slice(0, maxVisible);
              const overflow = mc.quoteNos.length - maxVisible;
              return (
                <button
                  key={mc.key}
                  className={`conv-item${isActive ? " active" : ""}${isUnread ? " unread" : ""}`}
                  onClick={() => selectCustomer(mc.key, mc.primaryConvId)}
                >
                  <span className={`conv-avatar${mc.isCustomer ? "" : " contact"}`}>{displayName.slice(0, 1)}</span>
                  <div className="conv-item-body">
                    <div className="conv-item-row1">
                      <span className="conv-item-name">{displayName}</span>
                      <time className="conv-item-time">{mc.lastMessageAt?.slice(0, 10) ?? ""}</time>
                    </div>
                    {mc.quoteNos.length > 0 && (
                      <div className="conv-item-quotes">
                        {visibleQuotes.map((q) => (
                          <span key={q} className={`conv-quote-tag status-${quoteStatusColor(mc.quoteStatuses[q])}`}>
                            {q}
                          </span>
                        ))}
                        {overflow > 0 && <span className="conv-quote-overflow">+{overflow}</span>}
                      </div>
                    )}
                    <div className="conv-item-preview">
                      {mc.latestMessage?.translatedText ?? mc.whatsapp}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Center: chat ── */}
        <main className="conv-chat">
          {active ? (
            <>
              <header className="conv-chat-header">
                <div className="conv-chat-title">
                  <strong>{active.company || active.customerName}</strong>
                  <span>{active.whatsapp}{active.quoteNo ? ` · ${active.quoteNo}` : ""}</span>
                </div>
                <div className="conv-chat-actions">
                  <span className={`conv-status-tag ${active.status}`}>{active.status === "open" ? "进行中" : "已关闭"}</span>
                  <a className="conv-wa-link" href={waUrl} target="_blank" rel="noreferrer">
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                </div>
              </header>
              <div className="conv-messages">
                {active.messages.length === 0 && <div className="conv-no-messages">暂无消息记录</div>}
                {active.messages.map((msg) => {
                  const primaryText = msg.direction === "outbound" ? msg.sourceText : msg.translatedText;
                  const secondaryLabel = msg.direction === "outbound" ? "发给客户" : "原文";
                  const secondaryText = msg.direction === "outbound" ? msg.translatedText : msg.sourceText;
                  return (
                    <div key={msg.id} className={`conv-msg ${msg.direction}`}>
                      <div className="conv-msg-bubble">
                        <p>{primaryText}</p>
                        {secondaryText !== primaryText && (
                          <small className="conv-msg-source">{secondaryLabel}：{secondaryText}</small>
                        )}
                      </div>
                      <div className="conv-msg-meta">
                        <span>{msg.createdAt}</span>
                        {msg.direction === "outbound" && msg.deliveryStatus && (
                          <span className={`conv-delivery ${msg.deliveryStatus}`}>
                            {msg.deliveryStatus}{msg.deliveryError ? ` · ${msg.deliveryError}` : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <footer className="conv-input">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                  rows={2}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                />
                <button className="conv-send-btn" onClick={() => void send()} disabled={!message.trim() || sending}>
                  <Send size={16} />{sending ? "发送中" : "发送"}
                </button>
              </footer>
            </>
          ) : (
            <div className="conv-chat-empty">
              <MessagesSquare size={52} strokeWidth={1} /><p>从左侧选择一个会话</p>
            </div>
          )}
        </main>

        {/* ── Right: panel ── */}
        <aside className="conv-panel">
          {active ? (
            <div className="conv-panel-stack">
              <section className="conv-contact-summary">
                <div className="conv-contact-main">
                  <span className={`conv-contact-avatar${isPreQuoteContact ? " pre" : ""}`}>
                    {activeDisplayName.slice(0, 1) || "?"}
                  </span>
                  <div className="conv-contact-title">
                    <div className="conv-contact-name-line">
                      <strong>{activeDisplayName}</strong>
                      <span className={`conv-contact-stage${isPreQuoteContact ? " pre" : ""}`}>
                        {isPreQuoteContact ? "询盘前" : "正式客户"}
                      </span>
                    </div>
                    {activeContactName && <span>{activeContactName}</span>}
                  </div>
                </div>

                {panelMsg && <div className={`conv-panel-msg ${panelMsgType}`}>{panelMsg}</div>}

                <div className="conv-contact-facts">
                  <div className="conv-contact-fact">
                    <span>WhatsApp</span>
                    <a href={waUrl} target="_blank" rel="noreferrer">{active.whatsapp || "—"}</a>
                  </div>
                  {active.email && (
                    <div className="conv-contact-fact">
                      <span>邮箱</span>
                      <a href={`mailto:${active.email}`}>{active.email}</a>
                    </div>
                  )}
                  {active.customerNo && (
                    <div className="conv-contact-fact"><span>编号</span><strong>{active.customerNo}</strong></div>
                  )}
                  {active.country && <div className="conv-contact-fact"><span>国家</span><strong>{active.country}</strong></div>}
                  {active.destinationPort && <div className="conv-contact-fact"><span>目的港</span><strong>{active.destinationPort}</strong></div>}
                  {active.customerGroup && <div className="conv-contact-fact"><span>分组</span><strong>{active.customerGroup}</strong></div>}
                </div>

                {isPreQuoteContact && (
                  <button
                    type="button"
                    className="conv-convert-btn conv-convert-wide"
                    disabled={converting}
                    onClick={() => void convertToCustomer()}
                    title="将此联系人正式登记为客户"
                  >
                    <UserCheck size={13} />
                    {converting ? "转换中..." : "一键转客户"}
                  </button>
                )}
              </section>

              <section className="conv-side-section conv-side-actions-section">
                <div className="conv-side-section-head">
                  <span>快捷操作</span>
                  {activeQuoteCount > 0 && <em>{activeQuoteCount} 张报价单</em>}
                </div>
                <div className="conv-side-action-grid">
                  <button
                    type="button"
                    className="conv-side-action primary"
                    onClick={() => setShowCreateQuote((v) => !v)}
                    title="为此会话生成新报价单（若尚未成为客户则自动转化）"
                  >
                    <Plus size={14} />
                    <span>
                      <strong>生成新报价单</strong>
                      <small>{showCreateQuote ? "收起表单" : "添加产品并创建"}</small>
                    </span>
                  </button>
                  {canGenerateProductCatalog && (
                    <button
                      type="button"
                      className="conv-side-action success"
                      onClick={openCatalogModal}
                      title="为联系我们阶段的联系人生成产品目录"
                    >
                      <FileText size={14} />
                      <span>
                        <strong>生成产品目录</strong>
                        <small>多选产品并发送 PDF</small>
                      </span>
                    </button>
                  )}
                  {quoteDetail && (
                    <button
                      type="button"
                      className="conv-side-action"
                      onClick={() => setShowQuoteModal(true)}
                      title="查看并编辑完整报价单"
                    >
                      <Edit2 size={14} />
                      <span>
                        <strong>详情/编辑</strong>
                        <small>{quoteDetail.quoteNo}</small>
                      </span>
                    </button>
                  )}
                  {activeMerged?.customerId && (
                    <a
                      href={`/admin?section=quotes&customerId=${encodeURIComponent(activeMerged.customerId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="conv-side-action"
                    >
                      <ReceiptText size={14} />
                      <span>
                        <strong>筛选全部</strong>
                        <small>打开报价单管理</small>
                      </span>
                    </a>
                  )}
                </div>
              </section>

              {showCreateQuote && (
                <div className="conv-create-quote-form">
                  <div className="conv-side-section-head">
                    <span>新建报价单</span>
                    {!active.isCustomer && <em>创建后自动转客户</em>}
                  </div>
                  <div className="conv-cqf-row">
                    <label>目的港
                      <input
                        value={createQuoteForm.destinationPort}
                        onChange={(e) => setCreateQuoteForm((p) => ({ ...p, destinationPort: e.target.value }))}
                        placeholder="如 Hamburg"
                      />
                    </label>
                    <label>集装箱
                      <FtSelect
                        value={createQuoteForm.containerType}
                        options={[
                          { value: "20GP", label: "20GP" },
                          { value: "40GP", label: "40GP" },
                          { value: "40HQ", label: "40HQ" },
                          { value: "LCL", label: "LCL 拼柜" }
                        ]}
                        onChange={(value) => setCreateQuoteForm((p) => ({ ...p, containerType: value }))}
                      />
                    </label>
                    <label>货币
                      <FtSelect
                        value={createQuoteForm.currency}
                        options={[
                          { value: "USD", label: "USD" },
                          { value: "CNY", label: "CNY" },
                          { value: "EUR", label: "EUR" },
                          { value: "GBP", label: "GBP" },
                          { value: "JPY", label: "JPY" },
                          { value: "AUD", label: "AUD" },
                          { value: "CAD", label: "CAD" }
                        ]}
                        onChange={(value) => setCreateQuoteForm((p) => ({ ...p, currency: value as SupportedCurrency }))}
                      />
                    </label>
                  </div>
                  <QuoteProductPicker
                    compact
                    currency={createQuoteForm.currency}
                    onDraftAdd={addCreateQuoteItem}
                  />
                  <div className="conv-cqf-items">
                    {createQuotePreviewItems.length === 0 && <span className="conv-cqf-empty">可先添加产品，也可以创建空报价单后进入详情编辑。</span>}
                    {createQuotePreviewItems.map((item, index) => (
                      <div key={`${item.id}-${index}`} className="conv-cqf-item">
                        {item.image && <img src={item.image} alt={item.name} />}
                        <span>{item.name}<em>{item.sku} × {item.quantity}</em></span>
                        <strong>{createQuoteForm.currency} {(item.unitPrice * item.quantity).toFixed(2)}</strong>
                        <button type="button" onClick={() => removeCreateQuoteItem(index)}>移除</button>
                      </div>
                    ))}
                  </div>
                  <div className="conv-cqf-actions">
                    <button type="button" className="conv-cqf-cancel" onClick={() => setShowCreateQuote(false)}>取消</button>
                    <button type="button" className="conv-cqf-submit" disabled={creatingQuote} onClick={() => void submitCreateQuote()}>
                      <Plus size={13} /> {creatingQuote ? "创建中..." : "创建报价单"}
                    </button>
                  </div>
                </div>
              )}

              <section className="conv-quote-workspace">
                <div className="conv-quote-workspace-head">
                  <div>
                    <span><ReceiptText size={13} /> 报价单工作区</span>
                    <small>{loadingQuote ? "加载中" : activeQuoteCount > 0 ? `${activeQuoteCount} 张关联报价单` : "暂无关联报价单"}</small>
                  </div>
                  {quoteDetail && <strong>{usdFmt.format(localTotal)}</strong>}
                </div>

                {loadingQuote ? (
                  <p className="conv-panel-empty">加载中...</p>
                ) : customerQuotes.length === 0 ? (
                  <div className="conv-panel-empty-state">
                    <ReceiptText size={22} strokeWidth={1.5} />
                    <strong>{active.isCustomer ? "暂无关联报价单" : "尚未创建报价单"}</strong>
                  </div>
                ) : (
                  <>
                    <div className="conv-quote-selector" ref={quoteSelectorRef}>
                      <button
                        type="button"
                        className="conv-quote-sel-trigger"
                        onClick={() => setQuoteSelectorOpen((v) => !v)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setQuoteSelectorOpen(false);
                        }}
                      >
                        <span className="conv-quote-sel-info">
                          <span className="conv-quote-sel-no">{quoteDetail?.quoteNo ?? "选择报价单"}</span>
                          {quoteDetail && (
                            <span className={`conv-qs-badge status-${quoteStatusColor(quoteDetail.status)}`}>
                              {quoteDetail.status}
                            </span>
                          )}
                          {quoteDetail?.destinationPort && (
                            <span className="conv-quote-sel-port">{quoteDetail.destinationPort}</span>
                          )}
                          {quoteDetail && (
                            <span className="conv-quote-sel-amt">{usdFmt.format(localTotal)}</span>
                          )}
                        </span>
                        <ChevronDown size={14} className={quoteSelectorOpen ? "conv-qs-chevron open" : "conv-qs-chevron"} />
                      </button>
                      {quoteSelectorOpen && (
                        <div
                          className="conv-quote-sel-dropdown"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") setQuoteSelectorOpen(false);
                          }}
                        >
                          {customerQuotes.map((q) => (
                            <button
                              type="button"
                              key={q.id}
                              className={`conv-quote-sel-item${q.id === selectedQuoteId ? " selected" : ""}`}
                              onClick={() => { setSelectedQuoteId(q.id); setQuoteSelectorOpen(false); }}
                            >
                              <span className="conv-qs-item-left">
                                <span className="conv-qs-item-no">{q.quoteNo}</span>
                                <span className={`conv-qs-badge status-${quoteStatusColor(q.status)}`}>{q.status}</span>
                              </span>
                              <span className="conv-qs-item-right">
                                <span className="conv-qs-item-port">{q.destinationPort}</span>
                                <span className="conv-qs-item-amt">{usdFmt.format(q.totalAmount)}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tabs */}
                    <div className="conv-panel-tabs">
                      <button
                        type="button"
                        className={`conv-panel-tab${panelTab === "current" ? " active" : ""}`}
                        onClick={() => setPanelTab("current")}
                      >当前版本</button>
                      <button
                        type="button"
                        className={`conv-panel-tab${panelTab === "history" ? " active" : ""}`}
                        onClick={() => setPanelTab("history")}
                      >历史版本</button>
                    </div>

                    {panelTab === "current" && quoteDetail && (
                      <>
                        <div className="conv-side-subhead">报价概况</div>
                        <div className="conv-quote-meta">
                          <div className="conv-qm-row">
                            <span className="conv-qm-item conv-qm-status-item">
                              <span className="conv-qm-label">报价状态</span>
                              <FtSelect
                                className={`conv-qm-status-select quote-status-select status-${quoteStatusColor(quoteDetail.status)}`}
                                value={quoteDetail.status}
                                options={QUOTE_STATUS_OPTIONS}
                                onChange={(value) => void updateQuoteStatus(value)}
                                disabled={updatingQuoteStatus}
                              />
                            </span>
                            {quoteDetail.containerType && (
                              <span className="conv-qm-item">
                                <span className="conv-qm-label">集装箱</span>
                                <span className="conv-qm-val">{quoteDetail.containerType}</span>
                              </span>
                            )}
                            {quoteDetail.destinationPort && (
                              <span className="conv-qm-item">
                                <span className="conv-qm-label">目的港</span>
                                <span className="conv-qm-val">{quoteDetail.destinationPort}</span>
                              </span>
                            )}
                            {(quoteDetail.contactName || quoteDetail.company) && (
                              <span className="conv-qm-item">
                                <span className="conv-qm-label">联系人</span>
                                <span className="conv-qm-val">{quoteDetail.contactName || quoteDetail.company}</span>
                              </span>
                            )}
                          </div>
                          <div className="conv-qm-row">
                            {quoteDetail.productAmount > 0 && (
                              <span className="conv-qm-item">
                                <span className="conv-qm-label">产品金额</span>
                                <span className="conv-qm-val">{usdFmt.format(quoteDetail.productAmount)}</span>
                              </span>
                            )}
                            {quoteDetail.shippingFee > 0 && (
                              <span className="conv-qm-item">
                                <span className="conv-qm-label">海运费</span>
                                <span className="conv-qm-val">{usdFmt.format(quoteDetail.shippingFee)}</span>
                              </span>
                            )}
                            {(quoteDetail.localFee + quoteDetail.documentFee + quoteDetail.customsFee + quoteDetail.insuranceFee) > 0 && (
                              <span className="conv-qm-item">
                                <span className="conv-qm-label">其他费</span>
                                <span className="conv-qm-val">{usdFmt.format(quoteDetail.localFee + quoteDetail.documentFee + quoteDetail.customsFee + quoteDetail.insuranceFee)}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="conv-side-subhead">产品明细</div>
                        <div className="conv-quote-items">
                          {localItems.length === 0 && <p className="conv-panel-empty">暂无产品明细</p>}
                          {localItems.map((item) => (
                            <div key={item.id} className="conv-quote-item-row">
                              {item.image && <img src={item.image} alt={item.name} className="conv-qi-img" />}
                              <div className="conv-qi-info">
                                <span className="conv-qi-name">{item.name || item.sku}</span>
                                <span className="conv-qi-sku">{item.sku}</span>
                              </div>
                              <span className="conv-qi-qty">×{item.quantity}</span>
                              <span className="conv-qi-price">
                                {editingItemId === item.id ? (
                                  <input
                                    className="conv-qi-price-input"
                                    type="number"
                                    min={0}
                                    step={0.01}
                                    value={editingPrice}
                                    autoFocus
                                    onChange={(e) => setEditingPrice(e.target.value)}
                                    onBlur={() => { void savePrice(item.id); }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") { void savePrice(item.id); }
                                      if (e.key === "Escape") { setEditingItemId(null); }
                                    }}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="conv-qi-price-view"
                                    onClick={() => { setEditingItemId(item.id); setEditingPrice(String(item.unitPrice)); }}
                                    title="点击编辑单价"
                                  >
                                    {usdFmt.format(item.unitPrice)}
                                    <Edit2 size={10} className="conv-qi-edit-icon" />
                                  </button>
                                )}
                              </span>
                              <span className="conv-qi-amount">{usdFmt.format(item.unitPrice * item.quantity)}</span>
                            </div>
                          ))}
                          <div className="conv-quote-total">
                            <span>总计</span>
                            <strong>{usdFmt.format(localTotal)}</strong>
                          </div>
                        </div>

                        <div className="conv-wa-send-block">
                          <div className="conv-wa-send-head-row">
                            <span className="conv-wa-send-head">
                              {quoteDetail.status === "已成交" ? "发送成交单至 WhatsApp" : "发送报价至 WhatsApp"}
                            </span>
                          </div>
                          <div className="conv-wa-send-actions">
                            <button
                              type="button"
                              className="conv-wa-send-btn"
                              onClick={() => quoteDetail.status === "已成交" ? void sendDealMessage() : void sendWa()}
                              disabled={quoteDetail.status === "已成交" ? sendingDealReceipt : (!waMessage.trim() || sendingWa)}
                            >
                              <Send size={13} />
                              {quoteDetail.status === "已成交"
                                ? sendingDealReceipt ? "发送中..." : "发送成交单"
                                : sendingWa ? "发送中..." : "发送报价"}
                            </button>
                            <button
                              type="button"
                              className="conv-wa-send-btn secondary"
                              onClick={() => void sendWithPdf()}
                              disabled={sendingWa || generatingPdf || sendingDealReceipt}
                            >
                              <Download size={13} />
                              {quoteDetail.status === "已成交"
                                ? sendingDealReceipt ? "发送中..." : "生成并发送 PDF"
                                : (sendingWa || generatingPdf) ? "处理中..." : "生成并发送 PDF"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {panelTab === "history" && (
                      <div className="conv-snap-list">
                        {loadingSnaps && <p className="conv-panel-empty">加载中...</p>}
                        {!loadingSnaps && snapshots.length === 0 && (
                          <p className="conv-panel-empty">暂无历史版本</p>
                        )}
                        {snapshots.map((snap, idx) => {
                          const isLatest = idx === 0;
                          const prev = snapshots[idx + 1];
                          const delta = prev ? snap.totalAmount - prev.totalAmount : null;
                          return (
                            <button
                              type="button"
                              key={snap.id}
                              className="conv-snap-item conv-snap-item-btn"
                              onClick={() => setSnapForModal(snap)}
                            >
                              <span className={`conv-snap-dot${isLatest ? " active" : ""}`} />
                              <div className="conv-snap-info">
                                <span className="conv-snap-ver">v{snap.version} {isLatest && <span className="conv-snap-latest-tag">最新</span>}</span>
                                <span className="conv-snap-reason">{SNAPSHOT_REASON_LABELS[snap.reason] ?? snap.reason}</span>
                                {delta !== null && (
                                  <span className={`conv-snap-delta${delta >= 0 ? " up" : " down"}`}>
                                    {delta >= 0 ? "+" : ""}{usdFmt.format(delta)}
                                  </span>
                                )}
                                <span className="conv-snap-time">{snap.createdAt.slice(0, 16)}</span>
                              </div>
                              <span className="conv-snap-amt">{usdFmt.format(snap.totalAmount)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          ) : (
            <div className="conv-panel-placeholder">
              <ReceiptText size={28} strokeWidth={1.2} />
              <p>选择会话后显示<br />客户与报价信息</p>
            </div>
          )}
        </aside>
      </div>
    </div>
    {/* ── Quote editor modal ── */}
    {showQuoteModal && quoteDetail && (
      <QuoteEditorModal
        quote={quoteDetail as unknown as QuoteWithItems}
        saving={savingQuoteModal}
        onClose={() => setShowQuoteModal(false)}
        onSubmit={saveQuoteModal}
      />
    )}

    {restoreDraftQuote && (
      <QuoteEditorModal
        quote={restoreDraftQuote as unknown as QuoteWithItems}
        saving={savingQuoteModal}
        onClose={() => setRestoreDraftQuote(null)}
        onSubmit={saveQuoteModal}
        title="回溯编辑报价单"
        subtitle="历史版本已带入当前报价单草稿"
        submitLabel="确认保存回溯"
      />
    )}

    {snapForModal && snapshotToQuote(snapForModal) && (
      <QuoteEditorModal
        quote={snapshotToQuote(snapForModal) as unknown as QuoteWithItems}
        saving={false}
        onClose={() => setSnapForModal(null)}
        onSubmit={() => undefined}
        mode="readonly"
        title={`历史版本 v${snapForModal.version}`}
        subtitle={`${SNAPSHOT_REASON_LABELS[snapForModal.reason] ?? snapForModal.reason} · ${snapForModal.createdAt.slice(0, 16)}`}
        onRestore={snapForModal.id === snapshots[0]?.id ? undefined : openRestoreDraft}
      />
    )}

    {showCatalogModal && active && (
      <div className="conv-modal-overlay" role="dialog" aria-modal="true">
        <div className="conv-modal conv-catalog-modal">
          <div className="conv-modal-head">
            <span><FileText size={15} /> 生成产品目录</span>
            <button className="conv-modal-close" onClick={() => setShowCatalogModal(false)} aria-label="关闭">
              <X size={16} />
            </button>
          </div>
          <div className="conv-modal-body conv-catalog-body">
            <div className="conv-catalog-toolbar">
              <label className="conv-catalog-search">
                <Search size={14} />
                <input
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder={loadingCatalogProducts ? "正在加载产品..." : "搜索产品 / SKU / 材质"}
                />
              </label>
              <button type="button" className="conv-catalog-light-btn" onClick={() => selectVisibleCatalogProducts(visibleCatalogProducts)} disabled={!visibleCatalogProducts.length}>
                全选当前
              </button>
              <button type="button" className="conv-catalog-light-btn" onClick={() => { setSelectedCatalogIds(new Set()); setGeneratedCatalogDoc(null); }} disabled={selectedCatalogIds.size === 0}>
                清空
              </button>
            </div>
            <div className="conv-catalog-summary">
              <span>已选择 {selectedCatalogIds.size} 个产品</span>
              {generatedCatalogDoc && (
                <a href={`/api/storefront/catalog-documents/${generatedCatalogDoc.id}`} target="_blank" rel="noreferrer">
                  查看产品目录
                </a>
              )}
            </div>
            {panelMsg && (
              <div className={`conv-catalog-inline-msg ${panelMsgType}`}>{panelMsg}</div>
            )}
            {generatedCatalogDoc && (
              <div className="conv-catalog-ready">
                <span>产品目录已生成</span>
                <a href={`/api/storefront/catalog-documents/${generatedCatalogDoc.id}`} target="_blank" rel="noreferrer">
                  打开目录
                </a>
              </div>
            )}
            <div className="conv-catalog-list">
              {loadingCatalogProducts && <div className="conv-empty-tip">正在加载产品...</div>}
              {!loadingCatalogProducts && visibleCatalogProducts.length === 0 && (
                <div className="conv-empty-tip">没有匹配产品</div>
              )}
              {visibleCatalogProducts.map((product) => {
                const spec = product.specs[0];
                const checked = selectedCatalogIds.has(product.id);
                return (
                  <label
                    key={product.id}
                    className={`conv-catalog-product${checked ? " selected" : ""}`}
                  >
                    <input type="checkbox" checked={checked} onChange={(event) => toggleCatalogCheckbox(event, product.id)} />
                    {(spec?.image || product.image) && <img src={spec?.image ?? product.image} alt={product.name} />}
                    <span className="conv-catalog-product-info">
                      <strong>{product.name}</strong>
                      <em>{product.nameEn || product.sku}</em>
                      <small>{product.sku}{spec?.skuName ? ` · ${spec.skuName}` : ""}</small>
                    </span>
                    <span className="conv-catalog-product-meta">
                      <strong>{cnyFmt.format(product.finalPrice)}</strong>
                      <em>MOQ {product.moq}</em>
                    </span>
                  </label>
                );
              })}
            </div>
            <label className="conv-catalog-message">
              <span>发送消息</span>
              <textarea
                value={catalogMessage}
                rows={3}
                onChange={(event) => setCatalogMessage(event.target.value)}
                placeholder="发送给客户的说明，会自动翻译为英文"
              />
            </label>
          </div>
          <div className="conv-modal-footer">
            <button type="button" className="conv-modal-cancel" onClick={() => setShowCatalogModal(false)}>取消</button>
            <button type="button" className="conv-catalog-generate-btn" onClick={() => void generateCatalogPdf()} disabled={selectedCatalogIds.size === 0 || generatingCatalog}>
              {generatingCatalog ? "生成中..." : "生成 PDF"}
            </button>
            <button type="button" className="conv-modal-save" onClick={() => void sendCatalogPdf()} disabled={!generatedCatalogDoc || sendingCatalog}>
              <Send size={13} /> {sendingCatalog ? "发送中..." : "发送 PDF"}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
