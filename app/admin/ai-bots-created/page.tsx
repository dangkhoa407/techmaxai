"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../components";
import { deleteAiBot, fetchAdminAiBotsCreated, updateAiBotStatus, type AdminAiBot } from "../../lib/auth";
import { showConfirm, showError, showToast } from "../../lib/swal";
import { AdminPagination, paginate } from "../admin-pagination";

function genderText(value: string) {
  if (value === "male") return "Nam";
  if (value === "female") return "Nữ";
  return "Khác";
}

export default function AdminAiBotsCreatedPage() {
  const [bots, setBots] = useState<AdminAiBot[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  function loadBots() {
    setLoading(true);
    fetchAdminAiBotsCreated()
      .then(setBots)
      .catch((error) => showError(error instanceof Error ? error.message : "Không thể tải bot AI."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadBots();
  }, []);

  const filteredBots = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return bots;
    return bots.filter((bot) =>
      [
        bot.full_name,
        bot.owner_name,
        bot.owner_email,
        bot.model?.name,
        bot.model?.model_id,
        bot.model?.provider,
      ].some((value) => String(value || "").toLowerCase().includes(q))
    );
  }, [bots, search]);

  const paginatedBots = paginate(filteredBots, page, pageSize);
  const activeCount = bots.filter((bot) => bot.status === "active").length;
  const attachedChannels = bots.reduce((total, bot) => total + bot.zalo_account_count + bot.facebook_page_count, 0);

  async function toggleBot(bot: AdminAiBot) {
    try {
      await updateAiBotStatus(bot.id, bot.status === "active" ? "inactive" : "active");
      showToast(bot.status === "active" ? "Đã tắt bot AI." : "Đã bật bot AI.");
      loadBots();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật bot AI.");
    }
  }

  async function removeBot(bot: AdminAiBot) {
    if (!(await showConfirm(`Xoá bot AI "${bot.full_name}"?`))) return;
    try {
      await deleteAiBot(bot.id);
      showToast("Đã xoá bot AI.");
      loadBots();
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá bot AI.");
    }
  }

  if (loading && !bots.length) {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#71717a" }}>Đang tải bot AI...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="cpanel-page-title-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16 }}>
        <div>
          <h1>Bot AI đã tạo</h1>
          <p>Theo dõi toàn bộ bot AI do khách hàng tạo và kênh đang gắn với từng bot.</p>
        </div>
        <button className="cpanel-btn cpanel-btn-secondary" onClick={loadBots} disabled={loading} type="button">
          <Icon name="update" size={16} /> Làm mới
        </button>
      </div>

      <div className="admin-summary-strip">
        <span>Tổng bot: <strong>{bots.length}</strong></span>
        <span>Đang bật: <strong>{activeCount}</strong></span>
        <span>Kênh đã gắn: <strong>{attachedChannels}</strong></span>
      </div>

      <div className="cpanel-card">
        <div className="cpanel-card-header" style={{ display: "block" }}>
          <div style={{ position: "relative", maxWidth: 420 }}>
            <input
              className="cpanel-input"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên bot, chủ sở hữu, model..."
              style={{ paddingLeft: 40 }}
            />
            <div style={{ position: "absolute", left: 14, top: 11, color: "#a1a1aa" }}>
              <Icon name="search" size={18} />
            </div>
          </div>
        </div>
        <div className="cpanel-card-body" style={{ padding: 0 }}>
          {filteredBots.length ? (
            <div className="cpanel-table-container">
              <table className="cpanel-table">
                <thead>
                  <tr>
                    <th>Bot AI</th>
                    <th>Chủ sở hữu</th>
                    <th>Model</th>
                    <th>Đào tạo</th>
                    <th>Kênh Zalo</th>
                    <th>Fanpage</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                    <th style={{ textAlign: "right" }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBots.map((bot) => (
                    <tr key={bot.id}>
                      <td>
                        <div style={{ fontWeight: 900 }}>{bot.full_name}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{genderText(bot.gender)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{bot.owner_name || `User #${bot.owner_id}`}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{bot.owner_email}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{bot.model?.name || "Chưa rõ model"}</div>
                        <div style={{ color: "#71717a", fontSize: 12, marginTop: 3 }}>{bot.model?.provider || "-"}</div>
                      </td>
                      <td>
                        <span className="cpanel-status-pill blue">{bot.training_count} mục</span>
                      </td>
                      <td style={{ fontWeight: 900 }}>{bot.zalo_account_count}</td>
                      <td style={{ fontWeight: 900 }}>{bot.facebook_page_count}</td>
                      <td>
                        <span className={`cpanel-status-pill ${bot.status === "active" ? "green" : "red"}`}>
                          {bot.status === "active" ? "Đang bật" : "Đã tắt"}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: "#71717a" }}>{bot.created_at || "-"}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <Link className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", textDecoration: "none" }} href={`/chatbot-ai/${bot.id}/training`}>
                            <Icon name="menu_book" size={14} /> Train
                          </Link>
                          <Link className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", textDecoration: "none" }} href="/chatbot-ai">
                            <Icon name="edit_note" size={14} /> Sửa
                          </Link>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px" }} type="button" onClick={() => toggleBot(bot)}>
                            <Icon name={bot.status === "active" ? "pause" : "play"} size={14} /> {bot.status === "active" ? "Tắt" : "Bật"}
                          </button>
                          <button className="cpanel-btn cpanel-btn-secondary" style={{ height: 32, fontSize: 12, padding: "0 10px", color: "#dc2626" }} type="button" onClick={() => removeBot(bot)}>
                            <Icon name="x" size={14} /> Xoá
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: "center", color: "#71717a" }}>Không có bot AI phù hợp.</div>
          )}
          {filteredBots.length ? (
            <AdminPagination
              page={page}
              pageSize={pageSize}
              total={filteredBots.length}
              itemLabel="bot"
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
