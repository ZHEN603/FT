"use client";

import {
  Box,
  BriefcaseBusiness,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Contact,
  Database,
  FileText,
  FolderTree,
  Globe2,
  Grid2X2,
  Headphones,
  Languages,
  LayoutDashboard,
  LineChart,
  LogOut,
  MessageCircle,
  Package,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Tag,
  UserRound,
  Users,
  Warehouse
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { categories } from "@/lib/mock-data";

export const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const categoryIcons: Record<string, LucideIcon> = {
  wood: Shirt,
  plastic: Shirt,
  metal: Shirt,
  velvet: Sparkles,
  pants: BriefcaseBusiness,
  accessory: Package
};

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand-compact" : "brand"}>
      <div className="brand-name">
        MOTARRO<span>+</span>
      </div>
      <div className="brand-sub">专业衣架供应商</div>
    </div>
  );
}

export function FrontHeader() {
  return (
    <header className="front-header">
      <Brand />
      <div className="front-search">
        <button className="search-type">
          产品 <ChevronDown size={16} />
        </button>
        <div className="search-box">
          <Search size={18} />
          <input placeholder="搜索产品名称 / 型号 / 关键词" />
        </div>
        <button className="brown-button">搜索</button>
      </div>
      <div className="front-actions">
        <button className="header-pill">
          我的询盘 <Badge value="8" />
        </button>
        <button className="header-pill">
          收藏夹 <Badge value="12" />
        </button>
        <button className="header-pill">
          <Globe2 size={18} /> 中文 <ChevronDown size={16} />
        </button>
        <button className="header-pill">
          <UserRound size={18} /> 尊贵的访客 <ChevronDown size={16} />
        </button>
      </div>
    </header>
  );
}

function Badge({ value }: { value: string }) {
  return <span className="badge">{value}</span>;
}

export function CategorySidebar({ active = "all", onSelect }: { active?: string; onSelect?: (id: string) => void }) {
  return (
    <aside className="front-sidebar">
      <div className="category-panel">
        <CategoryRow icon={Grid2X2} label="全部分类" active={active === "all"} onClick={() => onSelect?.("all")} />
        {categories.map((category) => (
          <CategoryRow
            key={category.id}
            icon={categoryIcons[category.id] ?? Shirt}
            label={category.name}
            active={active === category.id}
            onClick={() => onSelect?.(category.id)}
          />
        ))}
        <CategoryRow icon={Warehouse} label="儿童衣架" />
        <CategoryRow icon={Box} label="展示架 / 挂钩" />
        <CategoryRow icon={Package} label="套装组合" />
        <CategoryRow icon={Settings} label="定制服务" />
        <button className="all-category">
          查看全部分类 <ChevronRight size={16} />
        </button>
      </div>
      <MiniContainerCard />
      <div className="help-card">
        <p>需要报价或帮助?</p>
        <span>我们的专业团队为您服务</span>
        <button className="brown-button">联系在线客服</button>
      </div>
    </aside>
  );
}

function CategoryRow({ icon: Icon, label, active = false, onClick }: { icon: LucideIcon; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button className={active ? "category-row active" : "category-row"} onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
      <ChevronRight size={16} />
    </button>
  );
}

export function MiniContainerCard({ full = false }: { full?: boolean }) {
  return (
    <div className={full ? "mini-container full" : "mini-container"}>
      <div className="mini-container-head">
        <strong>我的集装箱</strong>
        <span>实时更新</span>
      </div>
      <div className="mini-container-main">
        <div className="ring">68%</div>
        <div>
          <strong>{full ? "40GP 普通柜" : "20GP 普柜"}</strong>
          <p>{full ? "12.03m x 2.35m x 2.39m" : "已装：9.80 m3 / 28 m3"}</p>
        </div>
      </div>
      <div className="container-visual">
        <div className="container-box" />
      </div>
      <div className="container-kv">
        <span>体积</span>
        <strong>{full ? "43.01 m3 / 67.63 m3" : "9.80 m3 / 28 m3"}</strong>
        <span>重量</span>
        <strong>{full ? "18,240 kg / 26,800 kg" : "8,430 kg / 28,000 kg"}</strong>
      </div>
      <button className="outline-brown">{full ? "查看我的集装箱" : "我的集装箱"}</button>
    </div>
  );
}

export function AdminSidebar({
  active = "dashboard",
  activeSub,
  onNavigate
}: {
  active?: string;
  activeSub?: string;
  onNavigate?: (section: string, tab?: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(["products", "analytics", "settings"]));
  const groups = [
    { id: "dashboard", icon: LayoutDashboard, label: "仪表盘" },
    {
      id: "products",
      icon: Package,
      label: "产品管理",
      children: [
        { id: "catalog", label: "产品目录" },
        { id: "categories", label: "分类管理" },
        { id: "collection", label: "产品采集" }
      ]
    },
    { id: "quotes", icon: ReceiptText, label: "报价单管理" },
    { id: "customers", icon: Users, label: "客户管理" },
    { id: "followups", icon: MessageCircle, label: "跟进记录" },
    { id: "suppliers", icon: Contact, label: "供应商管理" },
    {
      id: "analytics",
      icon: LineChart,
      label: "分析管理",
      children: [
        { id: "product-views", label: "产品浏览分析" },
        { id: "quotes", label: "询盘分析" },
        { id: "countries", label: "国家/地区分析" },
        { id: "behavior", label: "客户行为分析" }
      ]
    },
    { id: "calculator", icon: Calculator, label: "报价换算" },
    { id: "exchange", icon: Globe2, label: "汇率管理" },
    {
      id: "settings",
      icon: Settings,
      label: "系统设置",
      children: [
        { id: "company", label: "公司资料" },
        { id: "contact", label: "联系方式" },
        { id: "certificates", label: "资质证书" },
        { id: "brand", label: "品牌信息" },
        { id: "social", label: "社交媒体" }
      ]
    },
    { id: "logs", icon: FileText, label: "操作日志" }
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  function navigate(section: string, tab?: string) {
    onNavigate?.(section, tab);
  }

  function toggleGroup(id: string) {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleNavItemClick(item: (typeof groups)[number]) {
    if (item.children) {
      if (collapsed) {
        setCollapsed(false);
      }
      toggleGroup(item.id);
      return;
    }
    navigate(item.id);
  }

  return (
    <aside className={collapsed ? "admin-sidebar collapsed" : "admin-sidebar"}>
      <div className="admin-logo">
        <div className="admin-logo-mark" />
        <div className="admin-logo-text">
          <strong>询盘管理系统</strong>
          <span>外贸询盘 · 高效报价</span>
        </div>
        <button
          className="admin-collapse-toggle"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
          aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>
      <nav className="admin-nav">
        {groups.map((item) => (
          <div key={item.id}>
            <button
              className={active === item.id ? "admin-nav-item active" : "admin-nav-item"}
              onClick={() => handleNavItemClick(item)}
              type="button"
            >
              <item.icon size={18} />
              <span className="admin-nav-label">{item.label}</span>
              {item.children && (
                <span
                  className={openGroups.has(item.id) ? "admin-nav-chevron open" : "admin-nav-chevron"}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleGroup(item.id);
                  }}
                >
                  <ChevronDown size={16} />
                </span>
              )}
            </button>
            {item.children && !collapsed && openGroups.has(item.id) && (
              <div className="admin-subnav">
                {item.children.map((child) => (
                  <button
                    className={active === item.id && activeSub === child.id ? "active" : ""}
                    onClick={() => navigate(item.id, child.id)}
                    key={child.id}
                    type="button"
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <button className="admin-user" onClick={logout}>
        <div className="avatar">管</div>
        <div className="admin-user-text">
          <strong>管理员</strong>
          <span>admin@yoursourcing.com</span>
        </div>
        <LogOut size={16} />
      </button>
    </aside>
  );
}

export const adminIcons = {
  Box,
  ClipboardList,
  Database,
  FolderTree,
  Headphones,
  Languages,
  ShieldCheck,
  Star,
  Tag,
  Users
};
