"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchAdminBankSetting, updateAdminBankSetting, type BankSetting } from "../../lib/auth";
import { Icon } from "../../components";
import { showToast, showError } from "../../lib/swal";

function formatVnd(value?: number | null) {
  if (value === null || value === undefined) return "Chưa có dữ liệu";
  return `${Number(value || 0).toLocaleString("vi-VN")} đ`;
}

export default function AdminBankSettingsPage() {
  const [bank, setBank] = useState<BankSetting | null>(null);
  const [bankFields, setBankFields] = useState<Partial<BankSetting>>({
    bank_code: "",
    bank_name: "",
    account_number: "",
    account_name: "",
    branch: "",
    transfer_prefix: "",
    history_api_url: "",
    mb_username: "",
    mb_password: "",
    min_amount: 0,
    max_amount: 0,
  });
  const [logoData, setLogoData] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchAdminBankSetting()
      .then((data) => {
        setBank(data);
        setBankFields({
          bank_code: data.bank_code,
          bank_name: data.bank_name,
          account_number: data.account_number,
          account_name: data.account_name,
          branch: data.branch || "",
          transfer_prefix: data.transfer_prefix,
          history_api_url: data.history_api_url || "",
          mb_username: data.mb_username || "",
          mb_password: "",
          min_amount: data.min_amount,
          max_amount: data.max_amount,
        });
        setLogoData(data.logo_data || null);
      })
      .catch((err) => {
        showError("Lỗi: " + err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleLogoFile = (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn file ảnh hợp lệ.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showError("Ảnh không được vượt quá 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLogoData(reader.result as string);
      setLogoDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBank = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSaving(true);

    try {
      const payload: Partial<BankSetting> = {
        bank_code: bankFields.bank_code || "",
        bank_name: bankFields.bank_name || "",
        account_number: bankFields.account_number || "",
        account_name: bankFields.account_name || "",
        branch: bankFields.branch || "",
        transfer_prefix: bankFields.transfer_prefix || "",
        history_api_url: "",
        mb_username: bankFields.mb_username || "",
        min_amount: Number(bankFields.min_amount || 0),
        max_amount: Number(bankFields.max_amount || 0),
      };
      if (bankFields.mb_password) {
        payload.mb_password = bankFields.mb_password;
      }
      (payload as Partial<BankSetting> & { check_mb_login: boolean }).check_mb_login = true;

      if (logoDirty) {
        payload.logo_data = logoData;
      }

      const updated = await updateAdminBankSetting(payload);
      setBank(updated);
      setBankFields((prev) => ({ ...prev, mb_password: "" }));
      setLogoDirty(false);
      showToast("Cấu hình MB Bank đã được kiểm tra và cập nhật thành công.");
    } catch (err: any) {
      showError(err.message || "Không thể cập nhật cấu hình ngân hàng.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải cấu hình ngân hàng...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row">
        <h1>Cấu hình ngân hàng nhận tiền</h1>
        <p>Quản lý thông tin tài khoản bank nhận và API đối soát giao dịch tự động.</p>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header">
          <h2>Thông tin cấu hình Bank nhận</h2>
        </div>
        <div className="cpanel-card-body">
          {/* Banners removed per toast request */}

          <form onSubmit={handleSaveBank}>
            {/* Logo ngân hàng */}
            <div className="cpanel-field">
              <label>Logo Ngân hàng</label>
              <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                <div
                  style={{
                    width: 72, height: 72,
                    borderRadius: 8,
                    background: "#ffffff",
                    border: "2px dashed #e4e4e7",
                    display: "grid",
                    placeItems: "center",
                    overflow: "hidden",
                    cursor: "pointer"
                  }}
                  onClick={() => logoInputRef.current?.click()}
                  title="Nhấp để tải ảnh lên"
                >
                  {logoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoData} alt="Logo Preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 900, color: "#047857" }}>
                      {bankFields.bank_code?.slice(0, 3).toUpperCase() || "VCB"}
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      className="cpanel-btn cpanel-btn-secondary"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={saving}
                      style={{ height: 36 }}
                    >
                      <Icon name="upload" size={14} /> Chọn ảnh logo
                    </button>
                    {logoData && (
                      <button
                        type="button"
                        className="cpanel-btn cpanel-btn-secondary"
                        onClick={() => { setLogoData(null); setLogoDirty(true); }}
                        disabled={saving}
                        style={{ height: 36, color: "#ef4444" }}
                      >
                        <Icon name="delete" size={14} /> Xóa logo
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: "#71717a" }}>
                    Chấp nhận JPG, PNG, WEBP, SVG. Dung lượng tối đa 2MB.
                  </span>
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleLogoFile}
              />
            </div>

            <div style={{ height: 1, backgroundColor: "#e4e4e7", margin: "20px 0" }} />

            {/* Đăng nhập MB Bank */}
            <div className="cpanel-field">
              <label>Đăng nhập MB Bank lấy lịch sử giao dịch</label>
              <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                <input
                  type="text"
                  className="cpanel-input"
                  placeholder="Tài khoản Internet Banking MB"
                  value={bankFields.mb_username || ""}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, mb_username: ev.target.value }))}
                  autoComplete="off"
                  disabled={saving}
                />
                <input
                  type="password"
                  className="cpanel-input"
                  placeholder={bank?.mb_password_configured ? "Để trống nếu không đổi mật khẩu" : "Mật khẩu MB Bank"}
                  value={bankFields.mb_password || ""}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, mb_password: ev.target.value }))}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </div>
              <p style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
                Khi lưu, hệ thống sẽ đăng nhập thử MB Bank để kiểm tra đúng tài khoản/mật khẩu. Auto bank sẽ tự lấy lịch sử giao dịch mỗi 30 giây.
              </p>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                <span
                  className={`cpanel-status-pill ${bank?.bank_status === "active" ? "green" : bank?.bank_status === "error" ? "red" : "orange"}`}
                  style={{ fontSize: 10, padding: "2px 8px" }}
                >
                  • {bank?.bank_status === "active" ? "Bank đang hoạt động" : bank?.bank_status === "error" ? "Bank lỗi đăng nhập" : "Bank chưa kích hoạt"}
                </span>
                {bank?.bank_last_checked_at ? (
                  <span style={{ fontSize: 11, color: "#71717a" }}>Kiểm tra cuối: {bank.bank_last_checked_at}</span>
                ) : null}
                {bank?.bank_last_error ? (
                  <span style={{ fontSize: 11, color: "#ef4444" }}>{bank.bank_last_error}</span>
                ) : null}
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  border: "1px solid #e4e4e7",
                  borderRadius: 10,
                  background: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: "#71717a", fontWeight: 700 }}>Số tiền hiện có trong bank</div>
                  <strong style={{ fontSize: 22, color: "#047857" }}>{formatVnd(bank?.bank_balance)}</strong>
                </div>
                {bank?.bank_balance_updated_at ? (
                  <span style={{ fontSize: 11, color: "#71717a" }}>Cập nhật: {bank.bank_balance_updated_at}</span>
                ) : null}
              </div>
            </div>

            <div style={{ height: 1, backgroundColor: "#e4e4e7", margin: "20px 0" }} />

            {/* 2-Column Grid */}
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 20 }}>
              <div className="cpanel-field">
                <label>Mã Ngân hàng</label>
                <input
                  type="text"
                  className="cpanel-input"
                  value={bankFields.bank_code}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, bank_code: ev.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="cpanel-field">
                <label>Tên Ngân hàng</label>
                <input
                  type="text"
                  className="cpanel-input"
                  value={bankFields.bank_name}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, bank_name: ev.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="cpanel-field">
                <label>Số tài khoản</label>
                <input
                  type="text"
                  className="cpanel-input"
                  value={bankFields.account_number}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, account_number: ev.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="cpanel-field">
                <label>Tên chủ tài khoản</label>
                <input
                  type="text"
                  className="cpanel-input"
                  value={bankFields.account_name}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, account_name: ev.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="cpanel-field">
                <label>Chi nhánh</label>
                <input
                  type="text"
                  className="cpanel-input"
                  value={bankFields.branch || ""}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, branch: ev.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="cpanel-field">
                <label>Nội dung nạp (Prefix)</label>
                <input
                  type="text"
                  className="cpanel-input"
                  value={bankFields.transfer_prefix}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, transfer_prefix: ev.target.value }))}
                  disabled={saving}
                />
              </div>

              <div className="cpanel-field">
                <label>Nạp tối thiểu (VND)</label>
                <input
                  type="number"
                  className="cpanel-input"
                  value={bankFields.min_amount}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, min_amount: Number(ev.target.value) }))}
                  disabled={saving}
                />
              </div>

              <div className="cpanel-field">
                <label>Nạp tối đa (VND)</label>
                <input
                  type="number"
                  className="cpanel-input"
                  value={bankFields.max_amount}
                  onChange={(ev) => setBankFields((prev) => ({ ...prev, max_amount: Number(ev.target.value) }))}
                  disabled={saving}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" className="cpanel-btn cpanel-btn-red" disabled={saving}>
                <Icon name="check" size={16} /> {saving ? "Đang kiểm tra..." : "Kiểm tra MB & lưu"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
