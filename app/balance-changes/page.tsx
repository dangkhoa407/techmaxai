"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import { BalanceTransaction, BalanceTransactionStats, fetchBalanceChanges, formatVnd } from "../lib/auth";

const PAGE_SIZE = 10;

const emptyStats: BalanceTransactionStats = {
  current_balance: 0,
  total_count: 0,
  total_volume: 0,
  balance_change: 0,
  total_increase: 0,
  total_decrease: 0,
};

function signedVnd(value: number) {
  const amount = Math.round(Number(value || 0));
  if (amount > 0) return `+${formatVnd(amount)}`;
  if (amount < 0) return `-${formatVnd(Math.abs(amount))}`;
  return formatVnd(0);
}

function transactionTone(item: BalanceTransaction) {
  return item.direction === "increase" ? "green" : "red";
}

export default function BalanceChangesPage() {
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [stats, setStats] = useState<BalanceTransactionStats>(emptyStats);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [type, setType] = useState("all");
  const [direction, setDirection] = useState("all");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchBalanceChanges({
        page,
        limit: PAGE_SIZE,
        search: appliedSearch,
        type,
        direction,
      });
      setTransactions(payload.transactions);
      setStats(payload.stats);
      setTotal(payload.total);
      setPageCount(payload.page_count);
      if (payload.page_count > 0 && page > payload.page_count) setPage(payload.page_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải biến động số dư.");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, direction, page, type]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const canPrev = page > 1;
  const canNext = page < pageCount;
  const balanceHelp = useMemo(() => {
    if (stats.balance_change > 0) return "Số dư tăng";
    if (stats.balance_change < 0) return "Số dư giảm";
    return "Ổn định";
  }, [stats.balance_change]);

  function applyFilters() {
    setPage(1);
    setAppliedSearch(search.trim());
  }

  return (
    <AppFrame active="/balance-changes" title="Biến động số dư">
      <PageHeader
        title="Biến động số dư"
        desc="Theo dõi lịch sử tăng giảm số dư, giao dịch nạp tiền và thanh toán gói dịch vụ."
        action={<Link className="btn btn-red" href="/deposit"><Icon name="add" /> Nạp tiền</Link>}
      />

      <section className="grid-4" style={{ marginBottom: 18 }}>
        <StatCard label="Tổng giao dịch" value={formatVnd(stats.total_volume)} help={`${stats.total_count} giao dịch`} icon="swap_horiz" />
        <StatCard label="Số dư hiện tại" value={formatVnd(stats.current_balance)} help={balanceHelp} icon="account_balance" />
        <StatCard label="Tổng nạp" value={signedVnd(stats.total_increase)} help="Tất cả giao dịch tăng" icon="payments" />
        <StatCard label="Tổng chi" value={signedVnd(-stats.total_decrease)} help="Thanh toán và điều chỉnh giảm" icon="credit_card_off" />
      </section>

      <section className="glass balance-filter">
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", top: 13, left: 14, color: "var(--dim)" }}>
            <Icon name="search" size={20} />
          </span>
          <input
            className="input"
            style={{ paddingLeft: 44 }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
            placeholder="Tìm theo mã tham chiếu, ghi chú, loại giao dịch..."
          />
        </div>
        <select className="input balance-select" value={type} onChange={(event) => { setType(event.target.value); setPage(1); }}>
          <option value="all">Tất cả loại giao dịch</option>
          <option value="deposit">Nạp tiền</option>
          <option value="package_payment">Thanh toán</option>
          <option value="admin_adjustment">Điều chỉnh</option>
          <option value="refund">Hoàn tiền</option>
        </select>
        <select className="input balance-select" value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1); }}>
          <option value="all">Tất cả chiều</option>
          <option value="increase">Tăng</option>
          <option value="decrease">Giảm</option>
        </select>
        <button className="btn btn-secondary" onClick={applyFilters}>
          <Icon name="filter_list" size={18} />
          Lọc
        </button>
      </section>

      <section className="glass" style={{ marginTop: 18, overflow: "hidden" }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Loại</th>
                <th style={{ textAlign: "right" }}>Số tiền</th>
                <th style={{ textAlign: "right" }}>Biến động</th>
                <th style={{ textAlign: "right" }}>Số dư sau</th>
                <th>Tham chiếu</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 28, textAlign: "center" }}>Đang tải dữ liệu...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="danger-text" style={{ padding: 28, textAlign: "center" }}>{error}</td>
                </tr>
              ) : transactions.length ? (
                transactions.map((item) => {
                  const tone = transactionTone(item);
                  return (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.display_id}</strong>
                        <div className={tone === "green" ? "balance-plus" : "balance-minus"}>{item.direction_text}</div>
                      </td>
                      <td>
                        <span className={`status ${tone}`}>{item.type_text}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatVnd(item.amount)}</td>
                      <td className={tone === "green" ? "balance-plus amount" : "balance-minus amount"} style={{ textAlign: "right" }}>
                        {signedVnd(item.change_amount)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{formatVnd(item.balance_after)}</td>
                      <td>
                        <div className="muted">{item.reference || "-"}</div>
                        {item.note ? <small className="muted">{item.note}</small> : null}
                      </td>
                      <td className="muted">{item.created_at || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: 28, textAlign: "center" }}>Chưa có biến động số dư.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="between" style={{ padding: 18, background: "rgba(32,31,31,.72)", borderTop: "1px solid var(--border)" }}>
          <p className="muted">Tổng: {total} giao dịch • Trang {page}/{pageCount}</p>
          <div className="row">
            <button className="btn btn-secondary" disabled={!canPrev || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              <Icon name="chevron_left" size={18} />
            </button>
            <button className="btn btn-red">{page}</button>
            <button className="btn btn-secondary" disabled={!canNext || loading} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
              <Icon name="chevron_right" size={18} />
            </button>
          </div>
        </div>
      </section>
    </AppFrame>
  );
}
