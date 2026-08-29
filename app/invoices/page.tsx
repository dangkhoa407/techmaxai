"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader } from "../components";
import { fetchDepositInvoices, formatVnd, useAuthUser, type DepositInvoice } from "../lib/auth";

const PAGE_SIZE = 10;

export default function InvoicesPage() {
  const { user } = useAuthUser();
  const [invoices, setInvoices] = useState<DepositInvoice[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchDepositInvoices()
      .then((rows) => {
        if (!cancelled) setInvoices(rows);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Không thể tải danh sách hóa đơn.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredInvoices = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return invoices;

    return invoices.filter((invoice) =>
      [
        invoice.invoice_code,
        invoice.transfer_content,
        invoice.bank.bank_name,
        invoice.bank.account_number,
        invoice.status_text,
        invoice.created_at,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [invoices, search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filteredInvoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const paidTotal = invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.amount, 0);
  const pendingTotal = invoices.filter((invoice) => invoice.status === "pending").length;

  function changePage(nextPage: number) {
    setPage(Math.min(Math.max(nextPage, 1), pageCount));
  }

  return (
    <AppFrame active="/invoices" title="Hóa đơn">
      <PageHeader
        title="Danh sách hóa đơn nạp tiền"
        desc="Quản lý và theo dõi lịch sử giao dịch nạp tiền vào hệ thống."
        action={
          <Link className="btn btn-red" href="/deposit">
            <Icon name="add_circle" /> Tạo hóa đơn mới
          </Link>
        }
      />

      <div className="stack">
        <div className="glass activity-search">
          <div className="activity-search-input">
            <Icon name="search" size={20} />
            <input
              className="input"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm theo mã hóa đơn, nội dung chuyển khoản, ngân hàng..."
              value={search}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => changePage(1)} type="button">
            <Icon name="filter_list" size={18} />
            Tìm kiếm
          </button>
        </div>

        {error ? (
          <div className="card pad" style={{ borderColor: "rgba(255, 90, 90, 0.35)", background: "rgba(120, 0, 0, 0.16)" }}>
            <strong>Không thể tải hóa đơn</strong>
            <p className="muted" style={{ margin: "8px 0 0" }}>{error}</p>
          </div>
        ) : null}

        <div className="glass">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mã hóa đơn</th>
                  <th>Kênh thanh toán</th>
                  <th style={{ textAlign: "right" }}>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Tạo lúc</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <strong>{invoice.invoice_code}</strong>
                      <div className="muted" style={{ fontSize: 12 }}>Nội dung: {invoice.transfer_content}</div>
                    </td>
                    <td>
                      {invoice.bank.bank_name}
                      <div className="muted" style={{ fontSize: 12 }}>{invoice.bank.account_number}</div>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 800 }}>{formatVnd(invoice.amount)}</td>
                    <td><span className={`status ${invoice.tone}`}>{invoice.status_text}</span></td>
                    <td className="muted">{invoice.created_at}</td>
                    <td>
                      <Link className="btn btn-secondary" href={`/invoices/${encodeURIComponent(invoice.invoice_code)}`} style={{ padding: "7px 12px", fontSize: 12 }}>
                        Xem chi tiết
                      </Link>
                    </td>
                  </tr>
                ))}
                {!loading && pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="activity-empty">
                        <strong>Chưa có hóa đơn nào</strong>
                        <p>Tạo hóa đơn mới tại trang nạp tiền để bắt đầu đối soát.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
                {loading ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="activity-empty">
                        <strong>Đang tải dữ liệu</strong>
                        <p>Hệ thống đang lấy danh sách hóa đơn từ database.</p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="activity-pagination">
            <p>
              Tổng: {filteredInvoices.length} hóa đơn • Trang {safePage}/{pageCount}
            </p>
            <div className="row">
              <button className="btn btn-secondary" disabled={safePage <= 1} onClick={() => changePage(safePage - 1)} type="button">
                ‹
              </button>
              <button className="btn btn-red" type="button">{safePage}</button>
              <button className="btn btn-secondary" disabled={safePage >= pageCount} onClick={() => changePage(safePage + 1)} type="button">
                ›
              </button>
            </div>
          </div>
        </div>

        <div className="grid-3">
          <div className="card pad">
            <h2 style={{ marginTop: 0 }}>Tổng quan tài chính</h2>
            <div className="stack">
              <div className="between"><span className="muted">Số dư hiện tại</span><strong>{formatVnd(user?.money)}</strong></div>
              <div className="between"><span className="muted">Tổng đã nạp</span><strong style={{ color: "var(--green)" }}>{formatVnd(paidTotal)}</strong></div>
              <div className="between"><span className="muted">Hóa đơn chờ thanh toán</span><strong style={{ color: "var(--primary)" }}>{pendingTotal}</strong></div>
            </div>
          </div>

          <div className="card pad hero-card" style={{ gridColumn: "span 2" }}>
            <div>
              <Icon name="support_agent" size={48} />
              <h2>Cần hỗ trợ?</h2>
              <p className="subtitle">Nếu bạn gặp vấn đề về thanh toán, hãy liên hệ đội ngũ kỹ thuật để kiểm tra giao dịch.</p>
              <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
                <Link className="btn btn-secondary" href="/tickets">
                  <Icon name="mail" /> Gửi ticket
                </Link>
                <Link className="btn btn-red" href="/deposit">
                  <Icon name="payments" /> Tạo hóa đơn mới
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppFrame>
  );
}
