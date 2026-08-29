"use client";

export const ADMIN_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

type AdminPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  itemLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

export function AdminPagination({
  page,
  pageSize,
  total,
  itemLabel = "bản ghi",
  onPageChange,
  onPageSizeChange,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(total, safePage * pageSize);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderTop: "1px solid #e4e4e7",
        flexWrap: "wrap",
      }}
    >
      <div style={{ fontSize: 13, color: "#71717a", fontWeight: 700 }}>
        Hiển thị {from}-{to} / {total} {itemLabel}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select
          className="cpanel-select"
          value={pageSize}
          onChange={(event) => {
            onPageSizeChange(Number(event.target.value));
            onPageChange(1);
          }}
          style={{ height: 34, minWidth: 88, padding: "0 10px", fontSize: 13, fontWeight: 700 }}
        >
          {ADMIN_PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option} / trang
            </option>
          ))}
        </select>
        <button
          type="button"
          className="cpanel-btn cpanel-btn-secondary"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          style={{ height: 34, padding: "0 12px", fontSize: 13 }}
        >
          Trước
        </button>
        <span style={{ fontSize: 13, color: "#52525b", fontWeight: 800, minWidth: 74, textAlign: "center" }}>
          {safePage}/{totalPages}
        </span>
        <button
          type="button"
          className="cpanel-btn cpanel-btn-secondary"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          style={{ height: 34, padding: "0 12px", fontSize: 13 }}
        >
          Sau
        </button>
      </div>
    </div>
  );
}
