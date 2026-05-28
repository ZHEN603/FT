"use client";

import React, { useEffect } from "react";

export function AdminModalBackdrop({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  return <div className="admin-modal-backdrop">{children}</div>;
}
