"use client";

import { FtSelect } from "./FtSelect";

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10 条/页" },
  { value: "20", label: "20 条/页" },
  { value: "50", label: "50 条/页" }
];

export function paginationRange(page: number, totalPages: number): Array<number | "..."> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages];
  }
  if (page >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "...", page - 1, page, page + 1, "...", totalPages];
}

export function PaginationFooter({
  total,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange
}: {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const pages = paginationRange(page, totalPages);
  return (
    <div className="table-foot">
      <span>共 {total.toLocaleString()} 条 · 第 {page} / {totalPages} 页</span>
      <div>
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>&lt;</button>
        {pages.map((item, index) => (
          item === "..."
            ? <span className="page-ellipsis" key={`${item}-${index}`}>...</span>
            : <button key={item} className={item === page ? "active" : ""} onClick={() => onPageChange(item)}>{item}</button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>&gt;</button>
      </div>
      <FtSelect
        className="table-foot-size-select"
        value={String(pageSize)}
        options={PAGE_SIZE_OPTIONS}
        onChange={(value) => onPageSizeChange(Number(value))}
      />
    </div>
  );
}
