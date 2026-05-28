"use client";

import { X } from "lucide-react";
import { followupTypeClass } from "./FollowupEditorModal";
import type { FollowupRecord } from "./types";

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="detail-section"><h4>{title}<button>编辑</button></h4>{children}</section>;
}

export function FollowupDetail({
  followup,
  onEdit,
  onClose,
  onCreate
}: {
  followup: FollowupRecord;
  onEdit: (followup: FollowupRecord) => void;
  onClose: (followup: FollowupRecord) => void;
  onCreate: () => void;
}) {
  return (
    <aside className="admin-detail followup-detail">
      <div className="detail-head"><h2>跟进记录详情</h2><X size={18} /></div>
      <DetailSection title="基本信息">
        <div className="detail-kv">
          <span>客户名称</span><strong>{followup.company}</strong>
          <span>联系人</span><strong>{followup.contactName}</strong>
          <span>WhatsApp</span><strong>{followup.whatsapp}</strong>
          <span>报价单号</span><strong>{followup.quoteNo ?? "-"}</strong>
        </div>
      </DetailSection>
      <DetailSection title="跟进信息">
        <div className="detail-kv">
          <span>跟进类型</span><strong><span className={`followup-type-pill ${followupTypeClass(followup.type)}`}>{followup.type}</span></strong>
          <span>跟进状态</span><strong><span className={`status-pill ${followup.status === "已成交" ? "active" : ""}`}>{followup.status}</span></strong>
          <span>跟进人</span><strong>{followup.owner}</strong>
          <span>跟进时间</span><strong>{followup.createdAt}</strong>
          <span>下次跟进时间</span><strong>{followup.nextFollowUpAt ?? "-"}</strong>
        </div>
      </DetailSection>
      <h3>跟进内容</h3>
      <p className="followup-content-box">{followup.content}</p>
      <h3>跟进记录时间线</h3>
      <div className="followup-timeline">
        {followup.timeline.map((item, index) => (
          <div key={item.id} className={index === 0 ? "active" : ""}>
            <span>{item.createdAt}</span>
            <strong>{item.owner}</strong>
            <p>{item.content}</p>
          </div>
        ))}
      </div>
      <div className="detail-actions">
        <button className="admin-light" onClick={() => onEdit(followup)}>编辑记录</button>
        <button className="admin-light success" onClick={() => onClose(followup)}>标记为已成交</button>
        <button className="admin-primary" onClick={onCreate}>新建跟进记录</button>
      </div>
    </aside>
  );
}
