"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppFrame, Icon, PageHeader } from "../components";
import {
  createDepositInvoice,
  fetchDepositBank,
  fetchDepositInvoices,
  formatVnd,
  useAuthUser,
  type BankSetting,
  type DepositInvoice,
} from "../lib/auth";

const QUICK_AMOUNTS = [100000, 200000, 500000, 1000000];

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export default function DepositPage() {
  const router = useRouter();
  const { user } = useAuthUser();
  const [bank, setBank] = useState<BankSetting | null>(null);
  const [invoices, setInvoices] = useState<DepositInvoice[]>([]);
  const [amountInput, setAmountInput] = useState("15000");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchDepositBank(), fetchDepositInvoices()])
      .then(([bankPayload, invoicePayload]) => {
        if (cancelled) return;
        setBank(bankPayload);
        setInvoices(invoicePayload);
        setAmountInput(String(bankPayload.min_amount || 15000));
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Không thể tải cấu hình nạp tiền.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const amount = Number(amountInput || 0);
  const formattedAmountInput = amountInput ? amount.toLocaleString("vi-VN") : "";
  const paidTotal = useMemo(
    () => invoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.amount, 0),
    [invoices]
  );
  const pendingCount = useMemo(
    () => invoices.filter((invoice) => invoice.status === "pending").length,
    [invoices]
  );

  const validationMessage = useMemo(() => {
    if (!bank) return "";
    if (!amount) return "Nhập số tiền cần nạp.";
    if (amount < bank.min_amount) {
      return `Số tiền tối thiểu là ${formatVnd(bank.min_amount)}.`;
    }
    if (amount > bank.max_amount) {
      return `Số tiền tối đa là ${formatVnd(bank.max_amount)}.`;
    }
    return "";
  }, [amount, bank]);

  async function handleCreateInvoice() {
    if (!bank || validationMessage) {
      setError(validationMessage || "Chưa có cấu hình ngân hàng nhận tiền.");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const invoice = await createDepositInvoice(amount);
      setSuccess(`Đã tạo hóa đơn ${invoice.invoice_code}. Đang chuyển sang trang chi tiết...`);
      router.push(`/invoices/${encodeURIComponent(invoice.invoice_code)}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Không thể tạo hóa đơn nạp tiền.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppFrame active="/deposit" title="Tài chính / Nạp tiền">
      <PageHeader
        title="Nạp tiền vào tài khoản"
        desc="Chọn kênh nhận tiền, nhập số tiền cần nạp rồi tạo hóa đơn."
        action={
          <button className="btn btn-red" disabled={loading || submitting || !!validationMessage || !bank} onClick={handleCreateInvoice} type="button">
            <Icon name="add_card" /> {submitting ? "Đang tạo..." : "Tạo hóa đơn nạp tiền"}
          </button>
        }
      />

      <div className="grid-3">
        <section className="card pad stack" style={{ gridColumn: "span 2" }}>
          <div className="row">
            <Icon name="account_balance" />
            <h2 style={{ margin: 0 }}>Chọn kênh thanh toán</h2>
          </div>
          <p className="subtitle">Thông tin chuyển khoản sẽ xuất hiện ở trang chi tiết hóa đơn sau khi tạo thành công.</p>

          {error ? (
            <div className="card pad" style={{ borderColor: "rgba(255, 90, 90, 0.35)", background: "rgba(120, 0, 0, 0.16)", color: "var(--primary)" }}>
              <strong>Không thể tạo hóa đơn</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>{error}</p>
            </div>
          ) : null}

          {success ? (
            <div className="card pad" style={{ borderColor: "rgba(22, 163, 74, 0.35)", background: "rgba(22, 163, 74, 0.12)", color: "var(--primary)" }}>
              <strong>Tạo hóa đơn thành công</strong>
              <p className="muted" style={{ margin: "8px 0 0" }}>{success}</p>
            </div>
          ) : null}

          <div className="grid-2">
            <div className="card pad" style={{ borderColor: "var(--red)", background: "rgba(224,36,36,.06)" }}>
              <div className="between">
                <div className="row">
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: "#fff",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    {bank?.logo_data ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={bank.logo_data}
                        alt={bank.bank_name}
                        style={{ width: 40, height: 40, objectFit: "contain" }}
                      />
                    ) : (
                      <span style={{ color: "#047857", fontWeight: 900, fontSize: 13 }}>
                        {bank?.bank_code?.slice(0, 3).toUpperCase() || "VCB"}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>{bank?.bank_name || "Đang tải cấu hình..."}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Min: {bank ? formatVnd(bank.min_amount) : "..."} • Max: {bank ? formatVnd(bank.max_amount) : "..."}
                    </div>
                  </div>
                </div>
              </div>
            </div>


          </div>

          <div>
            <div className="between">
              <h2 style={{ margin: 0 }}>Số tiền cần nạp</h2>
              <span className="muted">VND</span>
            </div>
            <input
              className="input"
              inputMode="numeric"
              onChange={(event) => {
                setAmountInput(digitsOnly(event.target.value));
                setError("");
                setSuccess("");
              }}
              placeholder="Nhập số tiền"
              style={{ marginTop: 12, fontSize: 42, fontWeight: 800, padding: 24 }}
              value={formattedAmountInput}
            />
            <div className="row" style={{ flexWrap: "wrap", marginTop: 14 }}>
              {QUICK_AMOUNTS.map((quickAmount) => (
                <button
                  className="btn btn-secondary"
                  key={quickAmount}
                  onClick={() => {
                    setAmountInput(String(quickAmount));
                    setError("");
                    setSuccess("");
                  }}
                  type="button"
                >
                  {formatVnd(quickAmount)}
                </button>
              ))}
            </div>
            {validationMessage ? (
              <p style={{ color: "var(--danger)", margin: "12px 0 0", fontSize: 13, fontWeight: 700 }}>{validationMessage}</p>
            ) : null}
          </div>

          <div className="card pad">
            <p className="muted">
              Kênh <strong style={{ color: "var(--primary)" }}>{bank?.bank_name || "Vietcombank"}</strong> cho phép nạp từ{" "}
              {bank ? formatVnd(bank.min_amount) : "..."} đến {bank ? formatVnd(bank.max_amount) : "..."}.
            </p>
            <p className="muted">
              Số dư hiện tại: <strong style={{ color: "var(--red)" }}>{formatVnd(user?.money)}</strong>, Tổng đã nạp:{" "}
              <strong>{formatVnd(paidTotal)}</strong>.
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Đang có <strong>{pendingCount}</strong> hóa đơn chờ thanh toán. Mỗi hóa đơn chỉ có hiệu lực trong 15 phút.
            </p>
          </div>

          <button
            className="btn btn-red"
            disabled={loading || submitting || !!validationMessage || !bank}
            onClick={handleCreateInvoice}
            style={{ width: "100%", padding: 18, fontSize: 18 }}
            type="button"
          >
            <Icon name="rocket_launch" /> {submitting ? "Đang tạo hóa đơn..." : "Tạo hóa đơn nạp tiền"}
          </button>
        </section>

        <aside className="stack">
          <div className="card pad">
            <div className="row">
              <Icon name="verified_user" />
              <h2 style={{ margin: 0 }}>Quy trình nạp tiền</h2>
            </div>
            {["Chọn kênh thanh toán", "Nhập số tiền cần nạp", "Mở trang chi tiết hóa đơn"].map((item, index) => (
              <div className="row" key={item} style={{ alignItems: "flex-start", marginTop: 24 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 999,
                    border: "2px solid var(--red)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--red)",
                    fontWeight: 900,
                  }}
                >
                  {index + 1}
                </div>
                <div>
                  <strong>{item}</strong>
                  <p className="muted" style={{ marginTop: 4 }}>Giữ đúng luồng để hệ thống đối soát giao dịch nhanh hơn.</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card pad" style={{ borderLeft: "4px solid var(--red)" }}>
            <div className="row">
              <Icon name="assignment_late" />
              <h2 style={{ margin: 0 }}>Lưu ý đối soát</h2>
            </div>
            <p className="muted">Không sử dụng lại nội dung của hóa đơn cũ cho giao dịch mới.</p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Khi đã chuyển tiền sau 10 phút vẫn chưa cộng tiền, vui lòng gửi Ticket để xử lý
            </p>
          </div>

          <div className="card hero-card">
            <div>
              <Icon name="security" size={42} />
              <p style={{ fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>Secured by TechMax Encryption</p>
            </div>
          </div>
        </aside>
      </div>
    </AppFrame>
  );
}
