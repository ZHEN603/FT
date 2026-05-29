"use client";

import { Bell, MessageCircle } from "lucide-react";
import React, { useEffect, useState } from "react";

type AdminNotification = {
  id: string;
  type: "new_inquiry" | "customer_message" | "quote_sent" | "deal_won";
  title: string;
  body: string;
  quoteId: string | null;
  quoteNo: string | null;
  customerName: string;
  whatsapp: string;
  createdAt: string;
  unread: boolean;
};

export const AdminTopContext = React.createContext<{
  openConversations: (target?: { whatsapp?: string; quoteId?: string }) => void;
  navigate: (nextSection: string, nextTab?: string) => void;
}>({ openConversations: () => undefined, navigate: () => undefined });

export function AdminTop({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) {
  const { openConversations, navigate } = React.useContext(AdminTopContext);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  async function loadNotifications() {
    const response = await fetch("/api/admin/notifications");
    if (!response.ok) return;
    const data = await response.json() as { unreadCount: number; items: AdminNotification[] };
    setNotifications(data.items ?? []);
    setUnreadCount(data.unreadCount ?? 0);
  }

  useEffect(() => {
    const initial = window.setTimeout(() => void loadNotifications(), 0);
    const timer = window.setInterval(() => void loadNotifications(), 30000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  function openNotification(item: AdminNotification) {
    if (item.whatsapp || item.quoteId) {
      if (item.quoteId) navigate("quotes");
      openConversations({ whatsapp: item.whatsapp, quoteId: item.quoteId ?? undefined });
    }
    setOpen(false);
  }

  return (
    <div className="admin-top">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="admin-top-actions">
        {children}
        <div className="admin-notification-wrap">
          <button className="admin-bell" type="button" aria-label="通知" onClick={() => setOpen((current) => !current)}>
            <Bell size={20} />
            {unreadCount > 0 && <span>{unreadCount}</span>}
          </button>
          {open && (
            <div className="admin-notification-panel">
              <strong>信息栏</strong>
              {notifications.length === 0 && <p>暂无新通知</p>}
              {notifications.slice(0, 8).map((item) => (
                <button type="button" key={item.id} onClick={() => openNotification(item)}>
                  <em className={item.unread ? "unread" : ""} />
                  <span><b>{item.title}</b><small>{item.customerName} {item.quoteNo ? `· ${item.quoteNo}` : ""}</small></span>
                  <i>{item.createdAt}</i>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="admin-bell admin-message-icon" type="button" onClick={() => openConversations()} aria-label="会话中心"><MessageCircle size={20} /></button>
      </div>
    </div>
  );
}
