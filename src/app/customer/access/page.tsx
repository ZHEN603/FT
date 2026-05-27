"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, MessageCircle, RefreshCw } from "lucide-react";

type CustomerAccess = {
  customer: { company: string; contactName: string; email: string; whatsapp: string };
  quotes: Array<{
    id: string;
    quoteNo: string;
    status: string;
    currency: "CNY" | "USD";
    totalAmount: number;
    createdAt: string;
    documents: Array<{ id: string; type: string; title: string; version: number; createdAt: string }>;
    items: Array<{ id: string; name: string; sku: string; quantity: number; unitPrice: number; amount: number }>;
  }>;
  conversations: Array<{
    id: string;
    quoteId: string | null;
    messages: Array<{ id: string; senderType: string; sourceText: string; translatedText: string; createdAt: string }>;
  }>;
};

export default function CustomerAccessPage() {
  const [data, setData] = useState<CustomerAccess | null>(null);
  const [error, setError] = useState("");
  const [recoverQuoteNo, setRecoverQuoteNo] = useState("");
  const [recoverIdentity, setRecoverIdentity] = useState("");
  const [recoverLink, setRecoverLink] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      window.setTimeout(() => setError("缺少访问链接 token。"), 0);
      return;
    }
    fetch(`/api/storefront/quotes/access?token=${encodeURIComponent(token)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("访问链接已过期或无效")))
      .then((payload: CustomerAccess) => setData(payload))
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
      setError("无法恢复访问链接，请检查报价单号和邮箱/WhatsApp。");
      return;
    }
    const payload = await response.json() as { accessUrl: string };
    setRecoverLink(payload.accessUrl);
  }

  if (error && !data) {
    return (
      <main className="customer-access-page">
        <section className="customer-access-card">
          <h1>访问链接不可用</h1>
          <p>{error}</p>
          <form className="recover-form" onSubmit={recover}>
            <input value={recoverQuoteNo} onChange={(event) => setRecoverQuoteNo(event.target.value)} placeholder="报价单号，例如 QT-20260527-001" />
            <input value={recoverIdentity} onChange={(event) => setRecoverIdentity(event.target.value)} placeholder="邮箱或 WhatsApp" />
            <button type="submit">重新获取访问链接</button>
          </form>
          {recoverLink && <a className="customer-link" href={recoverLink}>打开新的客户访问链接</a>}
        </section>
      </main>
    );
  }

  if (!data) {
    return <main className="customer-access-page"><section className="customer-access-card"><RefreshCw /> 正在加载报价记录...</section></main>;
  }

  return (
    <main className="customer-access-page">
      <section className="customer-access-card">
        <div className="customer-access-head">
          <div>
            <h1>报价与询盘记录</h1>
            <p>{data.customer.company} / {data.customer.contactName}</p>
          </div>
          <CheckCircle2 />
        </div>
        <div className="customer-quote-list">
          {data.quotes.map((quote) => (
            <article key={quote.id} className="customer-quote">
              <header><strong>{quote.quoteNo}</strong><span>{quote.status}</span></header>
              <p>{quote.createdAt} · 总额 {quote.currency} {quote.totalAmount.toFixed(2)}</p>
              <table><tbody>{quote.items.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.sku}</td><td>x {item.quantity}</td><td>{quote.currency} {item.amount.toFixed(2)}</td></tr>)}</tbody></table>
              <div className="customer-docs">
                {quote.documents.map((doc) => <a key={doc.id} href={`/api/storefront/documents/${doc.id}`}><FileText size={16} /> {doc.title} v{doc.version}</a>)}
              </div>
            </article>
          ))}
        </div>
        <h2><MessageCircle size={20} /> 会话记录</h2>
        <div className="customer-message-list">
          {data.conversations.flatMap((conversation) => conversation.messages).map((message) => (
            <div key={message.id} className={message.senderType === "customer" ? "customer-message mine" : "customer-message"}>
              <strong>{message.senderType === "customer" ? "我" : "业务团队"}</strong>
              <span>{message.translatedText || message.sourceText}</span>
              <small>{message.createdAt}</small>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
