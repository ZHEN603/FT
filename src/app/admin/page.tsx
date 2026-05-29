"use client";

import { useEffect, useState } from "react";
import { AdminSidebar } from "@/components/shared";
import { AdminTopContext } from "./_components/shared/AdminTop";
import { AdminTop } from "./_components/shared/AdminTop";
import { Dashboard } from "./_components/dashboard/Dashboard";
import { ProductsAdmin } from "./_components/products/ProductsAdmin";
import { QuotesAdmin } from "./_components/quotes/QuotesAdmin";
import { CustomersAdmin } from "./_components/customers/CustomersAdmin";
import { FollowupsAdmin } from "./_components/followups/FollowupsAdmin";
import { SuppliersAdmin } from "./_components/suppliers/SuppliersAdmin";
import { ExchangeRatesAdmin } from "./_components/exchange/ExchangeRatesAdmin";
import { tabLabel } from "./_components/shared/utils";

type Section =
  | "dashboard"
  | "products"
  | "quotes"
  | "customers"
  | "followups"
  | "suppliers"
  | "analytics"
  | "calculator"
  | "exchange"
  | "settings"
  | "logs";

function ComingSoon({ title }: { title: string }) {
  return (
    <>
      <AdminTop title={title} subtitle="该页面正在开发中，敬请期待。" />
      <section className="admin-panel coming-soon-panel">
        <strong>敬请期待</strong>
      </section>
    </>
  );
}

export default function AdminPage() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [section, setSection] = useState<Section>(() => {
    if (typeof window === "undefined") return "dashboard";
    const requested = new URLSearchParams(window.location.search).get("section") as Section | null;
    return requested ?? "dashboard";
  });
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return section === "products" ? "catalog" : "";
    return new URLSearchParams(window.location.search).get("tab") ?? (section === "products" ? "catalog" : "");
  });

  useEffect(() => {
    void fetch("/api/auth/me").then((response) => {
      if (response.status === 401) {
        window.location.href = `/admin/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        return;
      }
      setCheckingAuth(false);
    }).catch(() => {
      window.location.href = "/admin/login?redirect=%2Fadmin";
    });
  }, []);

  useEffect(() => {
    function syncFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const nextSection = (params.get("section") as Section | null) ?? "dashboard";
      setSection(nextSection);
      setTab(params.get("tab") ?? (nextSection === "products" ? "catalog" : ""));
    }
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  function navigate(nextSection: string, nextTab?: string) {
    const safeSection = nextSection as Section;
    setSection(safeSection);
    const resolvedTab = nextTab ?? (safeSection === "products" ? "catalog" : "");
    setTab(resolvedTab);
    const nextUrl = safeSection === "dashboard"
      ? "/admin"
      : `/admin?section=${safeSection}${resolvedTab ? `&tab=${resolvedTab}` : ""}`;
    window.history.pushState(null, "", nextUrl);
  }

  function openConversations(_target?: { whatsapp?: string; quoteId?: string }) {
    const params = new URLSearchParams();
    if (_target?.whatsapp) params.set("whatsapp", _target.whatsapp);
    if (_target?.quoteId) params.set("quoteId", _target.quoteId);
    window.open(`/admin/conversations${params.size ? `?${params.toString()}` : ""}`, "_blank");
  }

  if (checkingAuth) {
    return (
      <main className="admin-auth-loading">
        <div>正在验证登录状态...</div>
      </main>
    );
  }

  return (
    <main className="admin-app">
      <AdminSidebar active={section} activeSub={tab} onNavigate={navigate} />
      <section className="admin-content">
        <AdminTopContext.Provider value={{ openConversations, navigate }}>
          {section === "dashboard" && <Dashboard />}
          {section === "products" && <ProductsAdmin tab={tab} />}
          {section === "quotes" && <QuotesAdmin onOpenConversation={openConversations} />}
          {section === "customers" && <CustomersAdmin onOpenConversation={openConversations} />}
          {section === "followups" && <FollowupsAdmin onOpenConversation={openConversations} />}
          {section === "suppliers" && <SuppliersAdmin />}
          {section === "analytics" && <ComingSoon title={tabLabel(tab) || "分析管理"} />}
          {section === "calculator" && <ComingSoon title="报价换算" />}
          {section === "exchange" && <ExchangeRatesAdmin />}
          {section === "settings" && <ComingSoon title={tabLabel(tab) || "系统设置"} />}
          {section === "logs" && <ComingSoon title="操作日志" />}
        </AdminTopContext.Provider>
      </section>
    </main>
  );
}
