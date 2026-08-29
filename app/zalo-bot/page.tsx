"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Settings2, Users } from "lucide-react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import {
  fetchZaloAccounts,
  fetchZaloBotGroups,
  fetchZaloBotCommands,
  saveZaloBotGroups,
  scanZaloGroups,
  updateZaloAccountCommandBotSettings,
  type ZaloGroup,
  type ZaloAccount
} from "../lib/auth";
import { showError, showToast } from "../lib/swal";

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function commandStorageKey(accountId: number | string) {
  return `techmax:zalo-bot:commands:v1:${accountId}`;
}

const pageSizeOptions = [5, 10, 20, 50];

export default function ZaloBotPage() {
  const [accounts, setAccounts] = useState<ZaloAccount[]>([]);
  const [commandCounts, setCommandCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [updatingModeId, setUpdatingModeId] = useState<number | null>(null);
  const [groupModalAccount, setGroupModalAccount] = useState<ZaloAccount | null>(null);
  const [groups, setGroups] = useState<ZaloGroup[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsSaving, setGroupsSaving] = useState(false);

  const activeAccounts = useMemo(() => accounts.filter((account) => account.status === "active"), [accounts]);
  const filteredAccounts = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return activeAccounts;
    return activeAccounts.filter((account) =>
      [account.display_name, account.phone_number, account.own_id, account.proxy]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [activeAccounts, search]);
  const commandModeCount = useMemo(() => accounts.filter((account) => account.command_bot_enabled).length, [accounts]);
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginatedAccounts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredAccounts.slice(start, start + pageSize);
  }, [filteredAccounts, safePage, pageSize]);
  const pageFrom = filteredAccounts.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageTo = Math.min(filteredAccounts.length, safePage * pageSize);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize]);

  useEffect(() => {
    let cancelled = false;
    async function loadCommandCounts() {
      const counts: Record<string, number> = {};
      for (const account of accounts) {
        try {
          counts[String(account.id)] = (await fetchZaloBotCommands(account.id)).length;
        } catch {
          const saved = window.localStorage.getItem(commandStorageKey(account.id));
          try {
            const parsed = saved ? JSON.parse(saved) : [];
            counts[String(account.id)] = Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            counts[String(account.id)] = 0;
          }
        }
      }
      if (!cancelled) setCommandCounts(counts);
    }
    loadCommandCounts();
    return () => {
      cancelled = true;
    };
  }, [accounts]);

  async function loadAccounts() {
    setLoading(true);
    try {
      setAccounts(await fetchZaloAccounts());
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải danh sách tài khoản Zalo.");
    } finally {
      setLoading(false);
    }
  }

  async function toggleCommandMode(account: ZaloAccount) {
    const nextEnabled = !account.command_bot_enabled;
    setUpdatingModeId(account.id);
    try {
      setAccounts(await updateZaloAccountCommandBotSettings(account.id, nextEnabled));
      showToast(nextEnabled ? "Đã bật dùng Lệnh." : "Đã tắt dùng Lệnh.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật chế độ dùng Lệnh.");
    } finally {
      setUpdatingModeId(null);
    }
  }

  async function openGroupModal(account: ZaloAccount) {
    setGroupModalAccount(account);
    setGroups([]);
    setSelectedGroupIds([]);
    setGroupsLoading(true);
    try {
      const data = await fetchZaloBotGroups(account.id);
      setGroups(data);
      setSelectedGroupIds(data.filter((group) => group.bot_enabled).map((group) => group.group_id));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải danh sách group BOT.");
    } finally {
      setGroupsLoading(false);
    }
  }

  async function scanGroupsForBot() {
    if (!groupModalAccount) return;
    setGroupsLoading(true);
    try {
      await scanZaloGroups(groupModalAccount.id);
      const data = await fetchZaloBotGroups(groupModalAccount.id);
      setGroups(data);
      setSelectedGroupIds(data.filter((group) => group.bot_enabled).map((group) => group.group_id));
      showToast(`Đã quét ${data.length} group Zalo.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể quét group Zalo.");
    } finally {
      setGroupsLoading(false);
    }
  }

  function toggleSelectedGroup(groupId: string) {
    setSelectedGroupIds((current) => current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId]);
  }

  async function saveGroupSelection() {
    if (!groupModalAccount) return;
    setGroupsSaving(true);
    try {
      const data = await saveZaloBotGroups(groupModalAccount.id, selectedGroupIds);
      setGroups(data);
      setSelectedGroupIds(data.filter((group) => group.bot_enabled).map((group) => group.group_id));
      showToast("Đã lưu group BOT Zalo.");
      setGroupModalAccount(null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu group BOT Zalo.");
    } finally {
      setGroupsSaving(false);
    }
  }

  return (
    <AppFrame active="/zalo-bot" title="BOT Zalo">
      <PageHeader
        eyebrow="Automation"
        title="BOT Zalo"
        desc="Chọn tài khoản Zalo đang hoạt động để bật dùng Lệnh hoặc vào trang tùy chỉnh lệnh BOT riêng cho tài khoản đó."
      />

      <div className="zalo-bot-page">
        <section className="grid-4">
          <StatCard label="Tài khoản hoạt động" value={String(activeAccounts.length)} help="Có thể cấu hình BOT" icon="message_circle" />
          <StatCard label="Đang dùng Lệnh" value={String(commandModeCount)} help="AI sẽ tự tắt khi bật Lệnh" icon="smart_toy" />
          <StatCard label="Tổng tài khoản" value={String(accounts.length)} help="Tất cả tài khoản Zalo" icon="users" />
          <StatCard label="Tổng lệnh" value={String(Object.values(commandCounts).reduce((sum, count) => sum + count, 0))} help="Lệnh BOT đã lưu" icon="list_alt" />
        </section>

        <section className="card zalo-bot-accounts-card">
          <div className="between zalo-bot-table-head">
            <div>
              <h2>Tài khoản Zalo đang hoạt động</h2>
              <p className="subtitle">Bật một trong hai chế độ: AI tự trả lời hoặc Lệnh BOT. Hai chế độ này tự tắt nhau.</p>
            </div>
            <input className="input" placeholder="Tìm tài khoản..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>

          <div className="table-wrap zalo-bot-account-table-wrap">
            <table className="zalo-bot-account-table">
              <thead>
                <tr>
                  <th>Tài khoản</th>
                  <th>Own ID</th>
                  <th>Số điện thoại</th>
                  <th>Lệnh đã tạo</th>
                  <th>Lần cuối online</th>
                  <th>Trạng thái</th>
                  <th>Tùy chỉnh lệnh</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7}><div className="zalo-bot-empty">Đang tải tài khoản Zalo...</div></td>
                  </tr>
                ) : null}
                {!loading && !filteredAccounts.length ? (
                  <tr>
                    <td colSpan={7}><div className="zalo-bot-empty">Chưa có tài khoản Zalo đang hoạt động.</div></td>
                  </tr>
                ) : null}
                {paginatedAccounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.display_name || "Zalo Account"}</strong>
                    </td>
                    <td>{account.own_id}</td>
                    <td>{account.phone_number || "N/A"}</td>
                    <td><span className="status blue">{commandCounts[String(account.id)] || 0} lệnh</span></td>
                    <td>{formatDate(account.last_seen_at)}</td>
                    <td>
                      <button
                        className="btn btn-secondary zalo-bot-command-mode-btn"
                        disabled={updatingModeId === account.id}
                        type="button"
                        onClick={() => toggleCommandMode(account)}
                      >
                        {account.command_bot_enabled ? <CheckCircle2 size={16} /> : <Ban size={16} />}
                        {account.command_bot_enabled ? "Bật" : "Tắt"}
                      </button>
                    </td>
                    <td>
                      <div className="zalo-account-actions">
                        <Link className="btn btn-secondary" href={`/zalo-bot/${account.id}`}>
                          <Settings2 size={16} /> Tùy chỉnh
                        </Link>
                        <button className="btn btn-secondary" type="button" onClick={() => openGroupModal(account)}>
                          <Users size={16} /> Quản lý group
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="zalo-bot-pagination">
            <span>
              Hiển thị {pageFrom}-{pageTo} / {filteredAccounts.length} tài khoản
            </span>
            <div className="zalo-bot-pagination-actions">
              <select
                className="input"
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="Số tài khoản mỗi trang"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>{option} / trang</option>
                ))}
              </select>
              <button className="btn btn-secondary" type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Trước
              </button>
              <strong>{safePage}/{totalPages}</strong>
              <button className="btn btn-secondary" type="button" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                Sau
              </button>
            </div>
          </div>
        </section>
        {groupModalAccount ? (
          <div className="modal-backdrop" onMouseDown={() => setGroupModalAccount(null)}>
            <section className="zalo-bot-content-modal" role="dialog" aria-modal="true" aria-labelledby="zalo-bot-group-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="between">
                <div>
                  <h2 id="zalo-bot-group-title">Quản lý group</h2>
                  <p className="subtitle">{groupModalAccount.display_name || groupModalAccount.own_id}</p>
                </div>
                <button className="icon-btn" type="button" onClick={() => setGroupModalAccount(null)} aria-label="Đóng">
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div className="zalo-bot-group-toolbar">
                <button className="btn btn-secondary" type="button" disabled={groupsLoading} onClick={scanGroupsForBot}>
                  <Icon name="refresh_cw" size={16} /> {groupsLoading ? "Đang quét..." : "Scan group"}
                </button>
                <span className="muted">{selectedGroupIds.length}/{groups.length} group được chọn</span>
              </div>

              <p className="muted zalo-bot-group-note">Chỉ hiển thị group mà tài khoản bot có quyền gửi tin nhắn.</p>

              <div className="zalo-bot-group-list">
                {groupsLoading && !groups.length ? (
                  <div className="zalo-bot-empty">Đang tải danh sách group...</div>
                ) : null}
                {!groupsLoading && !groups.length ? (
                  <div className="zalo-bot-empty">Chưa có group. Nhấn Scan group để quét từ tài khoản Zalo này.</div>
                ) : null}
                {groups.map((group) => (
                  <label className="zalo-bot-group-row" key={group.group_id}>
                    <input
                      type="checkbox"
                      checked={selectedGroupIds.includes(group.group_id)}
                      onChange={() => toggleSelectedGroup(group.group_id)}
                    />
                    <span>
                      <strong>{group.group_name || `Group ${group.group_id}`}</strong>
                      <small>{group.member_count ? `${group.member_count} thành viên` : "Chưa rõ thành viên"} · {group.group_id}</small>
                    </span>
                  </label>
                ))}
              </div>

              <div className="zalo-bot-actions">
                <button className="btn btn-secondary" type="button" onClick={() => setGroupModalAccount(null)}>Đóng</button>
                <button className="btn btn-red" type="button" disabled={groupsSaving} onClick={saveGroupSelection}>
                  <CheckCircle2 size={16} /> {groupsSaving ? "Đang lưu..." : "Lưu group"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppFrame>
  );
}
