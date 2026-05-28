"use client";

import {
  ChevronDown,
  ChevronLeft,
  Edit2,
  MessageCircle,
  MessagesSquare,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  User,
  UserCheck
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

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
  currency: "CNY" | "USD";
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
};

type QuoteDetail = {
  id: string;
  quoteNo: string;
  status: string;
  totalAmount: number;
  destinationPort: string;
  contactName: string;
  company: string;
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
  createdAt: string;
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

const QUOTE_STATUS_COLORS: Record<string, string> = {
  "新询价": "yellow",
  "跟进中": "yellow",
  "已报价": "blue",
  "已成交": "green",
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

const SNAPSHOT_REASON_LABELS: Record<string, string> = {
  price_edit: "单价修改",
  items_changed: "产品变更",
  sent_to_customer: "发送给客户",
  restored: "版本回溯",
  manual: "手动保存",
};

/* ── Dedup: phone → email → customerId ────────────────────────── */
function mergeByIdentity(convs: AdminConversation[]): MergedCustomer[] {
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
      // upgrade to customer if a later conversation is linked
      if (conv.isCustomer && !mc.isCustomer) {
        mc.isCustomer = true;
        mc.customerId = conv.customerId;
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
  const [sendMode, setSendMode] = useState<"text" | "pdf">("text");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatedDocId, setGeneratedDocId] = useState<string | null>(null);
  const [generatedDocPath, setGeneratedDocPath] = useState<string | null>(null);

  /* Convert / create-quote */
  const [converting, setConverting] = useState(false);
  const [showCreateQuote, setShowCreateQuote] = useState(false);
  const [createQuoteForm, setCreateQuoteForm] = useState<CreateQuoteForm>({ destinationPort: "", containerType: "20GP", currency: "USD" });
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [panelMsg, setPanelMsg] = useState("");

  /* Quote selector dropdown */
  const [quoteSelectorOpen, setQuoteSelectorOpen] = useState(false);
  const quoteSelectorRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const mergedList = mergeByIdentity(conversations);
  const activeMerged = mergedList.find((mc) => mc.key === activeKey) ?? null;
  const active = activeMerged
    ? conversations.find((c) => c.id === activeMerged.primaryConvId) ?? null
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
      setConversations(list);
      setActiveKey((prev) => targetKey ?? prev ?? merged[0]?.key ?? null);
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
        setCreateQuoteForm((prev) => ({ ...prev, destinationPort: activeMerged.destinationPort || "" }));
      }
      setShowCreateQuote(false);
      setPanelMsg("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeMerged]);

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
  async function restoreSnapshot(snapshotId: string) {
    if (!selectedQuoteId) return;
    await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/snapshots/${encodeURIComponent(snapshotId)}/restore`, {
      method: "POST"
    });
    setPanelTab("current");
    const res = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}`);
    if (res.ok) {
      const d = await res.json() as { quote?: QuoteDetail };
      if (d.quote) {
        setQuoteDetail(d.quote);
        setLocalItems(d.quote.items);
        setCustomerQuotes((prev) => prev.map((q) => q.id === d.quote!.id ? d.quote! : q));
        setWaMessage(buildWaMessage(d.quote));
      }
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
    if (!active || !waMessage.trim() || sendingWa) return;
    setSendingWa(true);
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
      await load();
    } finally { setSendingWa(false); }
  }

  /* ── Generate PDF ── */
  async function generatePdf() {
    if (!selectedQuoteId || generatingPdf) return;
    setGeneratingPdf(true);
    try {
      const res = await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "quote_pdf" })
      });
      if (!res.ok) return;
      const d = await res.json() as { document?: { id: string; filePath: string; title: string } };
      if (d.document) {
        setGeneratedDocId(d.document.id);
        setGeneratedDocPath(d.document.filePath);
        window.open(`/api/storefront/documents/${d.document.id}`, "_blank");
      }
    } finally { setGeneratingPdf(false); }
  }

  /* ── Send with PDF ── */
  async function sendWithPdf() {
    if (!active || !selectedQuoteId || !generatedDocId || sendingWa) return;
    setSendingWa(true);
    try {
      await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/snapshots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "sent_to_customer" })
      });
      await fetch(`/api/admin/quotes/${encodeURIComponent(selectedQuoteId)}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: generatedDocId })
      });
      const pdfMsg = waMessage.trim() || `[报价单PDF已发送]\n${quoteDetail?.quoteNo ?? ""}`;
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
      setGeneratedDocId(null);
      setGeneratedDocPath(null);
      await load();
    } finally { setSendingWa(false); }
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

  function selectCustomer(key: string) {
    setActiveKey(key);
    setReadKeys((prev) => prev.has(key) ? prev : new Set([...prev, key]));
    setPanelTab("current");
    setEditingItemId(null);
    setPanelMsg("");
  }

  /* ── Convert contact to customer ── */
  async function convertToCustomer() {
    if (!active || converting) return;
    setConverting(true);
    setPanelMsg("");
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/convert`, { method: "POST" });
      if (res.ok) {
        setPanelMsg("已成功转为客户");
        await load();
      } else {
        const d = await res.json() as { message?: string };
        setPanelMsg(d.message ?? "转换失败");
      }
    } finally { setConverting(false); }
  }

  /* ── Create new quote for this conversation ── */
  async function submitCreateQuote() {
    if (!active || creatingQuote) return;
    setCreatingQuote(true);
    setPanelMsg("");
    try {
      const res = await fetch(`/api/admin/conversations/${encodeURIComponent(active.id)}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createQuoteForm)
      });
      if (res.ok) {
        const d = await res.json() as { quote?: { id: string; quoteNo: string } };
        setShowCreateQuote(false);
        setPanelMsg(`报价单 ${d.quote?.quoteNo ?? ""} 已创建`);
        await load();
      } else {
        const d = await res.json() as { message?: string };
        setPanelMsg(d.message ?? "创建失败");
      }
    } finally { setCreatingQuote(false); }
  }

  const waUrl = active
    ? `https://wa.me/${active.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("您好，我是报价团队。")}`
    : "#";

  const localTotal = localItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

  return (
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
        <button className="conv-refresh-btn" onClick={() => void load()} title="刷新">
          <RefreshCw size={15} className={loading ? "conv-spin" : ""} />
          刷新
        </button>
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
                  onClick={() => selectCustomer(mc.key)}
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
                {active.messages.map((msg) => (
                  <div key={msg.id} className={`conv-msg ${msg.direction}`}>
                    <div className="conv-msg-bubble">
                      <p>{msg.translatedText}</p>
                      {msg.sourceText !== msg.translatedText && (
                        <small className="conv-msg-source">原文：{msg.sourceText}</small>
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
                ))}
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
            <>
              {/* ── Customer block ── */}
              <section className="conv-panel-block">
                <div className="conv-panel-head">
                  <span className="conv-panel-head-label"><User size={13} /> {active.isCustomer ? "客户信息" : "联系人信息"}</span>
                  {!active.isCustomer && (
                    <button
                      className="conv-convert-btn"
                      disabled={converting}
                      onClick={() => void convertToCustomer()}
                      title="将此联系人正式登记为客户"
                    >
                      <UserCheck size={13} />
                      {converting ? "转换中..." : "一键转客户"}
                    </button>
                  )}
                </div>
                {!active.isCustomer && (
                  <div className="conv-contact-badge">询盘前阶段 · 尚未成为正式客户</div>
                )}
                {panelMsg && <div className="conv-panel-msg">{panelMsg}</div>}
                <div className="conv-panel-rows">
                  {active.customerNo && (
                    <div className="conv-panel-row"><span>编号</span><strong>{active.customerNo}</strong></div>
                  )}
                  <div className="conv-panel-row"><span>公司</span><strong>{active.company || "—"}</strong></div>
                  <div className="conv-panel-row"><span>联系人</span><strong>{active.customerName || "—"}</strong></div>
                  {active.country && <div className="conv-panel-row"><span>国家</span><strong>{active.country}</strong></div>}
                  {active.destinationPort && <div className="conv-panel-row"><span>目的港</span><strong>{active.destinationPort}</strong></div>}
                  {active.customerGroup && <div className="conv-panel-row"><span>分组</span><strong>{active.customerGroup}</strong></div>}
                  <div className="conv-panel-row">
                    <span>WhatsApp</span>
                    <a href={waUrl} target="_blank" rel="noreferrer" className="conv-panel-link">{active.whatsapp || "—"}</a>
                  </div>
                  {active.email && (
                    <div className="conv-panel-row">
                      <span>邮箱</span>
                      <a href={`mailto:${active.email}`} className="conv-panel-link">{active.email}</a>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Quote section ── */}
              <section className="conv-panel-block conv-panel-block-grow">
                <div className="conv-panel-head">
                  <span className="conv-panel-head-label"><ReceiptText size={13} /> 关联报价单</span>
                  <div className="conv-panel-head-actions">
                    {activeMerged?.customerId && (
                      <a
                        href={`/admin?section=quotes&customerId=${encodeURIComponent(activeMerged.customerId)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="conv-panel-detail-btn"
                      >
                        筛选全部
                      </a>
                    )}
                    <button
                      className="conv-create-quote-btn"
                      onClick={() => setShowCreateQuote((v) => !v)}
                      title="为此会话生成新报价单（若尚未成为客户则自动转化）"
                    >
                      <Plus size={13} /> 生成新报价单
                    </button>
                  </div>
                </div>

                {/* Create quote inline form */}
                {showCreateQuote && (
                  <div className="conv-create-quote-form">
                    <div className="conv-cqf-row">
                      <label>目的港
                        <input
                          value={createQuoteForm.destinationPort}
                          onChange={(e) => setCreateQuoteForm((p) => ({ ...p, destinationPort: e.target.value }))}
                          placeholder="如 Hamburg"
                        />
                      </label>
                      <label>集装箱
                        <select value={createQuoteForm.containerType} onChange={(e) => setCreateQuoteForm((p) => ({ ...p, containerType: e.target.value }))}>
                          <option value="20GP">20GP</option>
                          <option value="40GP">40GP</option>
                          <option value="40HQ">40HQ</option>
                          <option value="LCL">LCL 拼柜</option>
                        </select>
                      </label>
                      <label>货币
                        <select value={createQuoteForm.currency} onChange={(e) => setCreateQuoteForm((p) => ({ ...p, currency: e.target.value as "CNY" | "USD" }))}>
                          <option value="USD">USD</option>
                          <option value="CNY">CNY</option>
                        </select>
                      </label>
                    </div>
                    <div className="conv-cqf-actions">
                      <button className="conv-cqf-cancel" onClick={() => setShowCreateQuote(false)}>取消</button>
                      <button className="conv-cqf-submit" disabled={creatingQuote} onClick={() => void submitCreateQuote()}>
                        <Plus size={13} /> {creatingQuote ? "创建中..." : "创建报价单"}
                      </button>
                    </div>
                    {!active.isCustomer && (
                      <p className="conv-cqf-note">创建后将自动转为正式客户</p>
                    )}
                  </div>
                )}

                {/* Quote selector */}
                {loadingQuote ? (
                  <p className="conv-panel-empty">加载中...</p>
                ) : customerQuotes.length === 0 ? (
                  <p className="conv-panel-empty">{active.isCustomer ? "暂无关联报价单" : "尚未创建报价单"}</p>
                ) : (
                  <>
                    <div className="conv-quote-selector" ref={quoteSelectorRef}>
                      <button
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
                        className={`conv-panel-tab${panelTab === "current" ? " active" : ""}`}
                        onClick={() => setPanelTab("current")}
                      >当前版本</button>
                      <button
                        className={`conv-panel-tab${panelTab === "history" ? " active" : ""}`}
                        onClick={() => setPanelTab("history")}
                      >历史版本</button>
                    </div>

                    {panelTab === "current" && quoteDetail && (
                      <>
                        {/* Items list */}
                        <div className="conv-quote-items">
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

                        {/* WA send */}
                        <div className="conv-wa-send-block">
                          <div className="conv-wa-send-head-row">
                            <span className="conv-wa-send-head">发送报价至 WhatsApp</span>
                            <div className="conv-wa-mode-tabs">
                              <button
                                className={`conv-wa-mode-tab${sendMode === "text" ? " active" : ""}`}
                                onClick={() => { setSendMode("text"); setGeneratedDocId(null); setGeneratedDocPath(null); }}
                              >文字</button>
                              <button
                                className={`conv-wa-mode-tab${sendMode === "pdf" ? " active" : ""}`}
                                onClick={() => setSendMode("pdf")}
                              >PDF</button>
                            </div>
                          </div>

                          <textarea
                            className="conv-wa-send-textarea"
                            value={waMessage}
                            onChange={(e) => setWaMessage(e.target.value)}
                            rows={sendMode === "pdf" ? 3 : 6}
                          />

                          {sendMode === "text" && (
                            <button
                              className="conv-wa-send-btn"
                              onClick={() => void sendWa()}
                              disabled={!waMessage.trim() || sendingWa}
                            >
                              <Send size={13} />
                              {sendingWa ? "发送中..." : "发送报价"}
                            </button>
                          )}

                          {sendMode === "pdf" && (
                            <div className="conv-wa-pdf-actions">
                              <button
                                className="conv-wa-pdf-gen-btn"
                                onClick={() => void generatePdf()}
                                disabled={generatingPdf}
                              >
                                {generatingPdf ? "生成中..." : "生成并下载 PDF"}
                              </button>
                              {generatedDocId && generatedDocPath && (
                                <a
                                  className="conv-wa-pdf-link"
                                  href={`/api/storefront/documents/${generatedDocId}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  ↓ 下载报价单
                                </a>
                              )}
                              <button
                                className="conv-wa-send-btn"
                                onClick={() => void sendWithPdf()}
                                disabled={!generatedDocId || sendingWa}
                                style={{ flex: 1 }}
                              >
                                <Send size={13} />
                                {sendingWa ? "发送中..." : "发送报价单"}
                              </button>
                            </div>
                          )}
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
                            <div key={snap.id} className="conv-snap-item">
                              <span className={`conv-snap-dot${isLatest ? " active" : ""}`} />
                              <div className="conv-snap-info">
                                <span className="conv-snap-ver">v{snap.version}</span>
                                <span className="conv-snap-reason">{SNAPSHOT_REASON_LABELS[snap.reason] ?? snap.reason}</span>
                                {delta !== null && (
                                  <span className={`conv-snap-delta${delta >= 0 ? " up" : " down"}`}>
                                    {delta >= 0 ? "+" : ""}{usdFmt.format(delta)}
                                  </span>
                                )}
                                <span className="conv-snap-time">{snap.createdAt.slice(0, 16)}</span>
                              </div>
                              {!isLatest && (
                                <button className="conv-snap-restore" onClick={() => void restoreSnapshot(snap.id)}>
                                  回溯
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          ) : (
            <div className="conv-panel-placeholder">
              <ReceiptText size={28} strokeWidth={1.2} />
              <p>选择会话后显示<br />客户与报价信息</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
