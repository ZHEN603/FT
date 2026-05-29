"use client";

import { AdminTop } from "../shared/AdminTop";
import { tabLabel } from "../shared/utils";
import { ProductCategoriesAdmin } from "../categories/ProductCategoriesAdmin";
import { ProductCatalogAdmin } from "./ProductCatalogAdmin";

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

export function ProductsAdmin({ tab }: { tab: string }) {
  if (tab === "categories") {
    return <ProductCategoriesAdmin />;
  }
  if (tab && tab !== "catalog") {
    return <ComingSoon title={tabLabel(tab) || "产品管理"} />;
  }
  return <ProductCatalogAdmin />;
}
