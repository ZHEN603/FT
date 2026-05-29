"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, MessageCircle, RefreshCw } from "lucide-react";

type AccessLanguage = "zh" | "en";

type CustomerAccess = {
  customer: {
    company: string;
    contactName: string;
    email: string;
    whatsapp: string;
    preferredLanguage?: string;
    preferredCurrency?: string;
  };
  quotes: Array<{
    id: string;
    quoteNo: string;
    status: string;
    currency: string;
    totalAmount: number;
    createdAt: string;
    documents: Array<{ id: string; type: string; title: string; version: number; createdAt: string }>;
    items: Array<{ id: string; name: string; nameEn?: string | null; sku: string; quantity: number; unitPrice: number; amount: number }>;
  }>;
  conversations: Array<{
    id: string;
    quoteId: string | null;
    messages: Array<{ id: string; senderType: string; sourceText: string; translatedText: string; createdAt: string }>;
  }>;
};

const ACCESS_TEXT = {
  zh: {
    unavailable: "访问链接不可用",
    missingToken: "缺少访问链接 token。",
    invalidLink: "访问链接已过期或无效",
    recoverFailed: "无法恢复访问链接，请检查报价单号和邮箱/WhatsApp。",
    quotePlaceholder: "报价单号，例如 QT-20260527-001",
    identityPlaceholder: "邮箱或 WhatsApp",
    recover: "重新获取访问链接",
    openRecovered: "打开新的客户访问链接",
    loading: "正在加载报价记录...",
    title: "报价与询盘记录",
    total: "总额",
    qty: "数量",
    conversations: "会话记录",
    me: "我",
    team: "业务团队",
    emptyMessages: "暂无会话记录",
    noDocuments: "暂无报价文件"
  },
  en: {
    unavailable: "Access Link Unavailable",
    missingToken: "Missing access token.",
    invalidLink: "The access link has expired or is invalid.",
    recoverFailed: "Could not recover the link. Please check quote number and email/WhatsApp.",
    quotePlaceholder: "Quote No., e.g. QT-20260527-001",
    identityPlaceholder: "Email or WhatsApp",
    recover: "Recover Access Link",
    openRecovered: "Open New Access Link",
    loading: "Loading quote records...",
    title: "Quotes & Inquiry Records",
    total: "Total",
    qty: "Qty",
    conversations: "Conversation History",
    me: "Me",
    team: "Sales Team",
    emptyMessages: "No conversation history yet",
    noDocuments: "No quote documents yet"
  }
} as const;

function isEnglishPreference(value?: string | null) {
  return !value || value.toLowerCase().startsWith("en");
}

function statusLabel(status: string, language: AccessLanguage) {
  if (language === "zh") return status;
  return ({
    新询价: "New Inquiry",
    跟进中: "Following Up",
    已报价: "Quoted",
    已成交: "Won",
    已关闭: "Closed"
  } as Record<string, string>)[status] ?? status;
}

function documentTitle(doc: { type: string; title: string; version: number }, language: AccessLanguage) {
  if (language === "zh") {
    const zh = ({
      inquiry_receipt: "询盘回执",
      quote_pdf: "报价单",
      deal_receipt: "成交回执"
    } as Record<string, string>)[doc.type] ?? doc.title;
    return `${zh} v${doc.version}`;
  }
  const en = ({
    inquiry_receipt: "Inquiry Receipt",
    quote_pdf: "Quotation",
    deal_receipt: "Deal Receipt"
  } as Record<string, string>)[doc.type] ?? doc.title;
  return `${en} v${doc.version}`;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "CNY" ? "zh-CN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "JPY" ? 0 : 2
  }).format(Number(value || 0));
}

function itemName(item: { name: string; nameEn?: string | null }, language: AccessLanguage) {
  return language === "en" ? item.nameEn || item.name : item.name;
}

export default function CustomerAccessPage() {
  const [data, setData] = useState<CustomerAccess | null>(null);
  const [language, setLanguage] = useState<AccessLanguage>("en");
  const [error, setError] = useState("");
  const [recoverQuoteNo, setRecoverQuoteNo] = useState("");
  const [recoverIdentity, setRecoverIdentity] = useState("");
  const [recoverLink, setRecoverLink] = useState("");
  const text = ACCESS_TEXT[language];

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      window.setTimeout(() => setError(ACCESS_TEXT.en.missingToken), 0);
      return;
    }
    fetch(`/api/storefront/quotes/access?token=${encodeURIComponent(token)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error(ACCESS_TEXT.en.invalidLink)))
      .then((payload: CustomerAccess) => {
        setData(payload);
        setLanguage(isEnglishPreference(payload.customer.preferredLanguage) ? "en" : "zh");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function recover(event: React.FormEvent) {
    event.preventDefault();
    setRecoverLink("");
    const response = await fetch("/api/storefront/quotes/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quoteNo: recoverQuoteNo, identity: recoverIdentity })
    });
    if (!response.ok) {
      setError(text.recoverFailed);
      return;
    }
    const payload = await response.json() as { accessUrl: string };
    setRecoverLink(payload.accessUrl);
  }

  if (error && !data) {
    return (
      <main className="customer-access-page">
        <section className="customer-access-card">
          <div className="customer-access-language">
            <button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>EN</button>
            <button className={language === "zh" ? "active" : ""} type="button" onClick={() => setLanguage("zh")}>中文</button>
          </div>
          <h1>{text.unavailable}</h1>
          <p>{error}</p>
          <form className="recover-form" onSubmit={recover}>
            <input value={recoverQuoteNo} onChange={(event) => setRecoverQuoteNo(event.target.value)} placeholder={text.quotePlaceholder} />
            <input value={recoverIdentity} onChange={(event) => setRecoverIdentity(event.target.value)} placeholder={text.identityPlaceholder} />
            <button type="submit">{text.recover}</button>
          </form>
          {recoverLink && <a className="customer-link" href={recoverLink}>{text.openRecovered}</a>}
        </section>
      </main>
    );
  }

  if (!data) {
    return <main className="customer-access-page"><section className="customer-access-card"><RefreshCw /> {text.loading}</section></main>;
  }

  return (
    <main className="customer-access-page">
      <section className="customer-access-card">
        <div className="customer-access-language">
          <button className={language === "en" ? "active" : ""} type="button" onClick={() => setLanguage("en")}>EN</button>
          <button className={language === "zh" ? "active" : ""} type="button" onClick={() => setLanguage("zh")}>中文</button>
        </div>
        <div className="customer-access-head">
          <div>
            <h1>{text.title}</h1>
            <p>{data.customer.company} / {data.customer.contactName}</p>
          </div>
          <CheckCircle2 />
        </div>
        <div className="customer-quote-list">
          {data.quotes.map((quote) => (
            <article key={quote.id} className="customer-quote">
              <header><strong>{quote.quoteNo}</strong><span>{statusLabel(quote.status, language)}</span></header>
              <p>{quote.createdAt} · {text.total} {money(quote.totalAmount, quote.currency)}</p>
              <table>
                <tbody>
                  {quote.items.map((item) => (
                    <tr key={item.id}>
                      <td>{itemName(item, language)}</td>
                      <td>{item.sku}</td>
                      <td>{text.qty} {item.quantity}</td>
                      <td>{money(item.amount, quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="customer-docs">
                {quote.documents.length === 0 && <span>{text.noDocuments}</span>}
                {quote.documents.map((doc) => <a key={doc.id} href={`/api/storefront/documents/${doc.id}`}><FileText size={16} /> {documentTitle(doc, language)}</a>)}
              </div>
            </article>
          ))}
        </div>
        <h2><MessageCircle size={20} /> {text.conversations}</h2>
        <div className="customer-message-list">
          {data.conversations.flatMap((conversation) => conversation.messages).length === 0 && <div className="customer-message"><span>{text.emptyMessages}</span></div>}
          {data.conversations.flatMap((conversation) => conversation.messages).map((message) => (
            <div key={message.id} className={message.senderType === "customer" ? "customer-message mine" : "customer-message"}>
              <strong>{message.senderType === "customer" ? text.me : text.team}</strong>
              <span>{language === "en" ? message.translatedText || message.sourceText : message.sourceText || message.translatedText}</span>
              <small>{message.createdAt}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
