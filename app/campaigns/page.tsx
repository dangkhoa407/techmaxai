"use client";

import { useEffect, useMemo, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../components";
import {
  cancelZaloCampaign,
  cancelRunningZaloCampaigns,
  createZaloCampaign,
  deleteZaloCampaign,
  deleteZaloFriend,
  deleteZaloGroup,
  deleteZaloGroupMember,
  fetchZaloCampaigns,
  pauseZaloCampaign,
  resumeZaloCampaign,
  scanZaloFriends,
  scanZaloGroupMembers,
  scanZaloGroups,
  type ZaloAccount,
  type ZaloCampaign,
  type ZaloCampaignStats,
  type ZaloFriend,
  type ZaloGroup,
  type ZaloGroupMember,
  fetchZaloAccounts,
} from "../lib/auth";
import { showConfirm, showError, showToast } from "../lib/swal";

const emptyStats: ZaloCampaignStats = { total: 0, scheduled: 0, running: 0, completed: 0, failed: 0 };
const campaignTargetPageSize = 20;
const weekdayOptions = [
  { value: 1, label: "Thứ 2" },
  { value: 2, label: "Thứ 3" },
  { value: 3, label: "Thứ 4" },
  { value: 4, label: "Thứ 5" },
  { value: 5, label: "Thứ 6" },
  { value: 6, label: "Thứ 7" },
  { value: 0, label: "CN" },
];

function localDateTimeValue(offsetMinutes = 10) {
  const date = new Date(Date.now() + offsetMinutes * 60 * 1000);
  date.setSeconds(0, 0);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  if (!value) return "Chưa có";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function formatWeekdays(days?: number[]) {
  const selected = Array.isArray(days) ? days : [];
  if (!selected.length) return "chưa chọn thứ";
  return weekdayOptions.filter((day) => selected.includes(day.value)).map((day) => day.label).join(", ");
}

function formatScheduleTimes(times?: string[]) {
  const values = Array.isArray(times) ? times.filter(Boolean) : [];
  return values.length ? values.join(", ") : "";
}

function campaignScheduleText(campaign: ZaloCampaign) {
  const isRecurring = campaign.schedule_type === "daily" || campaign.schedule_type === "custom";
  if (isRecurring) {
    const parts = [
      `tuỳ chỉnh ${formatWeekdays(campaign.days_of_week)}`,
      formatScheduleTimes(campaign.scheduled_times) ? `giờ: ${formatScheduleTimes(campaign.scheduled_times)}` : "",
    ].filter(Boolean).join(", ");

    if (campaign.status === "running") {
      return `${parts}, đang gửi lượt này...`;
    }
    if (campaign.status === "paused") {
      return `${parts}, đang tạm dừng`;
    }
    if (campaign.status === "completed") {
      return `${parts}, đã hoàn tất${campaign.finished_at ? ` lúc ${formatDate(campaign.finished_at)}` : ""}`;
    }
    if (campaign.status === "scheduled" && campaign.next_run_at) {
      return `${parts}, lần kế tiếp ${formatDate(campaign.next_run_at)}`;
    }
    return parts;
  }

  if (campaign.status === "running") {
    return "Đang gửi chiến dịch...";
  }
  if (campaign.status === "completed") {
    return `Đã hoàn tất${campaign.finished_at ? ` lúc ${formatDate(campaign.finished_at)}` : ""}`;
  }
  const dates = campaign.scheduled_datetimes?.length
    ? `mốc: ${campaign.scheduled_datetimes.map(formatDate).join(", ")}`
    : `gửi lúc ${formatDate(campaign.scheduled_at)}`;
  if (campaign.status === "scheduled" && campaign.next_run_at) {
    return `${dates}, lần kế tiếp ${formatDate(campaign.next_run_at)}`;
  }
  return dates;
}

function statusText(status: ZaloCampaign["status"] | string) {
  const map: Record<string, string> = {
    scheduled: "Đã lên lịch",
    running: "Đang gửi",
    paused: "Đã dừng",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
    failed: "Thất bại",
    pending: "Đang chờ",
    sent: "Đã gửi",
  };
  return map[status] || status;
}

function statusTone(status: string) {
  if (status === "completed" || status === "sent") return "green";
  if (status === "running" || status === "scheduled" || status === "pending") return "orange";
  if (status === "paused") return "orange";
  return "red";
}

function formatCampaignTargetMeta(target: ZaloCampaign["targets"][number]) {
  const prefix = target.target_type === "group" ? "gid" : "fid";
  const idLabel = `${prefix} ${target.group_id}`;
  if (target.error_message) {
    return /^(fid|gid)\s+/i.test(target.error_message) ? target.error_message : `${idLabel}: ${target.error_message}`;
  }
  return target.sent_at ? formatDate(target.sent_at) : idLabel;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });
}

type CampaignTargetItem = {
  id: string;
  name: string;
  meta: string;
  raw: ZaloGroup | ZaloFriend | ZaloGroupMember;
};

function isCampaignAccountReady(account: ZaloAccount) {
  const status = String(account.status || "").toLowerCase();
  return !["inactive", "disabled", "deleted", "missing"].includes(status);
}

export default function CampaignsPage() {
  const [accounts, setAccounts] = useState<ZaloAccount[]>([]);
  const [groups, setGroups] = useState<ZaloGroup[]>([]);
  const [friends, setFriends] = useState<ZaloFriend[]>([]);
  const [members, setMembers] = useState<ZaloGroupMember[]>([]);
  const [campaigns, setCampaigns] = useState<ZaloCampaign[]>([]);
  const [stats, setStats] = useState<ZaloCampaignStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number>(0);
  const [targetType, setTargetType] = useState<"group" | "friend" | "member">("group");
  const [sourceGroupId, setSourceGroupId] = useState("");
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [campaignTargetPages, setCampaignTargetPages] = useState<Record<number, number>>({});
  const [search, setSearch] = useState("");
  const [imageName, setImageName] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "Chiến dịch Zalo",
    message: "",
    schedule_type: "once" as "now" | "once" | "custom",
    scheduled_at: localDateTimeValue(),
    scheduled_times: [localDateTimeValue().slice(11, 16)],
    scheduled_datetimes: [localDateTimeValue()],
    custom_scheduled_time: localDateTimeValue().slice(11, 16),
    custom_scheduled_times: [localDateTimeValue().slice(11, 16)],
    delay_seconds: 8,
    days_of_week: [1, 2, 3, 4, 5],
    image_data_url: "",
  });

  const activeAccounts = useMemo(() => accounts.filter(isCampaignAccountReady), [accounts]);
  const currentAccount = activeAccounts.find((account) => account.id === selectedAccountId) || null;
  const targetLabel = targetType === "friend" ? "bạn bè" : targetType === "member" ? "thành viên" : "nhóm";
  const targetTitle = targetType === "friend" ? "Bạn bè Zalo" : targetType === "member" ? "Thành viên trong nhóm" : "Nhóm Zalo";
  const minDelaySeconds = targetType === "member" || form.image_data_url ? 10 : 3;

  const visibleTargets = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let items: CampaignTargetItem[] = targetType === "friend"
      ? friends
        .filter((friend) => !selectedAccountId || friend.zalo_account_id === selectedAccountId)
        .map((friend) => ({ id: friend.friend_id, name: friend.friend_name, meta: friend.friend_id, raw: friend }))
      : targetType === "member"
        ? members
          .filter((member) => !selectedAccountId || member.zalo_account_id === selectedAccountId)
          .filter((member) => !sourceGroupId || member.source_group_id === sourceGroupId)
          .map((member) => ({
            id: member.member_id,
            name: member.member_name,
            meta: `${member.source_group_name} · ${member.member_id}`,
            raw: member,
          }))
        : groups
          .filter((group) => !selectedAccountId || group.zalo_account_id === selectedAccountId)
          .map((group) => ({
            id: group.group_id,
            name: group.group_name,
            meta: `${group.member_count ? `${group.member_count} thành viên` : "Chưa rõ thành viên"} · ${group.group_id}`,
            raw: group,
          }));

    if (targetType === "member" && !sourceGroupId) {
      const unique = new Map<string, CampaignTargetItem>();
      for (const item of items) {
        if (!unique.has(item.id)) unique.set(item.id, item);
      }
      items = [...unique.values()];
    }

    return items.filter((item) => !keyword || [item.name, item.id].some((value) => String(value).toLowerCase().includes(keyword)));
  }, [friends, groups, members, search, selectedAccountId, sourceGroupId, targetType]);

  const allFilteredSelected = visibleTargets.length > 0 && visibleTargets.every((target) => selectedTargets.includes(target.id));

  function campaignTargetPage(campaign: ZaloCampaign) {
    const maxPage = Math.max(1, Math.ceil(campaign.targets.length / campaignTargetPageSize));
    return Math.min(maxPage, Math.max(1, campaignTargetPages[campaign.id] || 1));
  }

  function setCampaignTargetPage(campaignId: number, page: number) {
    setCampaignTargetPages((value) => ({ ...value, [campaignId]: Math.max(1, page) }));
  }

  async function loadData(accountId = selectedAccountId) {
    setLoading(true);
    try {
      const payload = await fetchZaloCampaigns(accountId || undefined, sourceGroupId || undefined);
      let nextAccounts = payload.accounts;
      if (!nextAccounts.length) {
        nextAccounts = await fetchZaloAccounts().catch(() => []);
      }
      setAccounts(nextAccounts);
      setGroups(payload.groups);
      setFriends(payload.friends);
      setMembers(payload.members);
      setCampaigns((current) => payload.campaigns.length || !current.length ? payload.campaigns : current);
      setStats(payload.stats);
      const firstActive = nextAccounts.find(isCampaignAccountReady);
      if (!accountId && firstActive) setSelectedAccountId(firstActive.id);
      if (accountId && !nextAccounts.some((account) => account.id === accountId && isCampaignAccountReady(account))) {
        setSelectedAccountId(0);
        setSelectedTargets([]);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải dữ liệu chiến dịch.");
    } finally {
      setLoading(false);
    }
  }

  async function handleScanTargets() {
    if (!selectedAccountId) {
      showError(`Vui lòng chọn tài khoản Zalo đang hoạt động trước khi quét ${targetLabel}.`);
      return;
    }
    setScanning(true);
    try {
      if (targetType === "friend") {
        const nextFriends = await scanZaloFriends(selectedAccountId);
        setFriends(nextFriends);
        showToast(`Đã quét ${nextFriends.length} bạn bè Zalo.`);
      } else if (targetType === "member") {
        const nextMembers = await scanZaloGroupMembers(selectedAccountId, sourceGroupId);
        setMembers(nextMembers);
        showToast(`Đã quét ${nextMembers.length} thành viên Zalo.`);
      } else {
        const nextGroups = await scanZaloGroups(selectedAccountId);
        setGroups(nextGroups);
        showToast(`Đã quét ${nextGroups.length} nhóm Zalo.`);
      }
      setSelectedTargets([]);
    } catch (error) {
      showError(error instanceof Error ? error.message : `Không thể quét ${targetLabel} Zalo.`);
    } finally {
      setScanning(false);
    }
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (targetType === "member") {
      showError("Gửi thành viên trong nhóm chỉ hỗ trợ tin nhắn chữ.");
      event.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn file ảnh.");
      event.target.value = "";
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      showError("Ảnh tối đa 6MB.");
      event.target.value = "";
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((value) => ({ ...value, image_data_url: dataUrl, delay_seconds: Math.max(10, Number(value.delay_seconds || 8)) }));
      setImageName(file.name);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đọc ảnh.");
    }
  }

  async function handleDeleteTarget(target: CampaignTargetItem) {
    if (!(await showConfirm(`Xóa ${targetLabel} "${target.name}" khỏi danh sách chiến dịch?`))) return;
    try {
      if (targetType === "friend") {
        const friend = target.raw as ZaloFriend;
        const nextFriends = await deleteZaloFriend(friend.zalo_account_id, friend.friend_id);
        setFriends(nextFriends);
      } else if (targetType === "member") {
        const member = target.raw as ZaloGroupMember;
        const nextMembers = await deleteZaloGroupMember(member.zalo_account_id, member.member_id, member.source_group_id);
        setMembers(nextMembers);
      } else {
        const group = target.raw as ZaloGroup;
        const nextGroups = await deleteZaloGroup(group.zalo_account_id, group.group_id);
        setGroups(nextGroups);
      }
      setSelectedTargets((items) => items.filter((id) => id !== target.id));
      showToast(`Đã xóa ${targetLabel} khỏi danh sách.`);
    } catch (error) {
      showError(error instanceof Error ? error.message : `Không thể xóa ${targetLabel}.`);
    }
  }

  function toggleTarget(targetId: string) {
    setSelectedTargets((items) => items.includes(targetId) ? items.filter((id) => id !== targetId) : [...items, targetId]);
  }

  function toggleAllFiltered() {
    const visibleIds = visibleTargets.map((target) => target.id);
    setSelectedTargets((items) => allFilteredSelected ? items.filter((id) => !visibleIds.includes(id)) : [...new Set([...items, ...visibleIds])]);
  }

  function toggleWeekday(day: number) {
    setForm((value) => ({
      ...value,
      days_of_week: value.days_of_week.includes(day)
        ? value.days_of_week.filter((item) => item !== day)
        : [...value.days_of_week, day],
    }));
  }

  function normalizeScheduleTimes(times: string[]) {
    return [...new Set(times.map((time) => time.trim()).filter((time) => /^\d{2}:\d{2}$/.test(time)))].sort();
  }

  function normalizeScheduleDateTimes(values: string[]) {
    return [...new Set(values.map((value) => value.trim()).filter((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)))].sort();
  }

  function addCustomScheduleTime() {
    setForm((value) => {
      return { ...value, custom_scheduled_times: normalizeScheduleTimes([...value.custom_scheduled_times, value.custom_scheduled_time]) };
    });
  }

  function removeCustomScheduleTime(time: string) {
    setForm((value) => {
      return { ...value, custom_scheduled_times: value.custom_scheduled_times.filter((item) => item !== time) };
    });
  }

  function addOnceScheduleDateTime() {
    setForm((value) => {
      return { ...value, scheduled_datetimes: normalizeScheduleDateTimes([...value.scheduled_datetimes, value.scheduled_at]) };
    });
  }

  function removeOnceScheduleDateTime(dateTime: string) {
    setForm((value) => {
      return { ...value, scheduled_datetimes: value.scheduled_datetimes.filter((item) => item !== dateTime) };
    });
  }

  async function handleCreateCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAccountId) {
      showError("Vui lòng chọn tài khoản Zalo đang hoạt động.");
      return;
    }
    if (!selectedTargets.length) {
      showError(`Vui lòng chọn ít nhất một ${targetLabel}.`);
      return;
    }
    if (!form.message.trim() && !form.image_data_url) {
      showError("Vui lòng nhập nội dung tin nhắn hoặc chọn ảnh.");
      return;
    }
    if (targetType === "member" && form.image_data_url) {
      showError("Gửi thành viên trong nhóm chỉ hỗ trợ tin nhắn chữ.");
      return;
    }
    if (form.schedule_type === "custom" && !form.days_of_week.length) {
      showError("Vui lòng chọn ít nhất một thứ để gửi tuỳ chỉnh.");
      return;
    }
    const scheduleTimes = form.schedule_type === "custom"
      ? normalizeScheduleTimes(form.custom_scheduled_times)
      : [];
    const scheduleDateTimes = form.schedule_type === "once" ? normalizeScheduleDateTimes(form.scheduled_datetimes) : [];
    if (form.schedule_type === "custom" && !scheduleTimes.length) {
      showError("Vui lòng chọn giờ gửi tuỳ chỉnh.");
      return;
    }
    if (form.schedule_type === "once" && !scheduleDateTimes.length) {
      showError("Vui lòng chọn ít nhất một mốc ngày giờ gửi.");
      return;
    }
    const customScheduledAt = form.schedule_type === "custom"
      ? `${localDateTimeValue().slice(0, 10)}T${scheduleTimes[0]}:00`
      : form.schedule_type === "once"
        ? `${scheduleDateTimes[0]}:00`
      : form.scheduled_at;

    setSaving(true);
    try {
      const nextCampaigns = await createZaloCampaign({
        zalo_account_id: selectedAccountId,
        target_type: targetType,
        source_group_id: targetType === "member" ? sourceGroupId : undefined,
        name: form.name.trim() || "Chiến dịch Zalo",
        message: form.message,
        schedule_type: form.schedule_type === "custom" ? "custom" : "once",
        days_of_week: form.schedule_type === "custom" ? form.days_of_week : [],
        scheduled_times: scheduleTimes,
        scheduled_datetimes: scheduleDateTimes,
        send_now: form.schedule_type === "now",
        scheduled_at: customScheduledAt,
        delay_seconds: Math.max(minDelaySeconds, form.delay_seconds),
        group_ids: selectedTargets,
        target_ids: selectedTargets,
        image_data_url: form.image_data_url || null,
        client_time: new Date().toISOString(),
      });
      if (nextCampaigns.length) {
        setCampaigns(nextCampaigns);
      }
      setSelectedTargets([]);
      setForm((value) => {
        const nextScheduled = localDateTimeValue();
        return {
          ...value,
          message: "",
          scheduled_at: nextScheduled,
          scheduled_times: [nextScheduled.slice(11, 16)],
          scheduled_datetimes: [nextScheduled],
          custom_scheduled_time: nextScheduled.slice(11, 16),
          custom_scheduled_times: [nextScheduled.slice(11, 16)],
          image_data_url: ""
        };
      });
      setImageName("");
      setComposeOpen(false);
      showToast("Đã tạo chiến dịch Zalo.");
      await loadData(selectedAccountId);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tạo chiến dịch.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelCampaign(campaign: ZaloCampaign) {
    if (!(await showConfirm(`Hủy chiến dịch "${campaign.name}"?`))) return;
    try {
      const nextCampaigns = await cancelZaloCampaign(campaign.id);
      setCampaigns(nextCampaigns);
      showToast("Đã hủy chiến dịch.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể hủy chiến dịch.");
    }
  }

  async function handlePauseCampaign(campaign: ZaloCampaign) {
    if (!(await showConfirm(`Dừng chiến dịch "${campaign.name}"? Bạn có thể tiếp tục lại sau.`))) return;
    try {
      const nextCampaigns = await pauseZaloCampaign(campaign.id);
      setCampaigns(nextCampaigns);
      showToast("Đã dừng chiến dịch.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể dừng chiến dịch.");
    }
  }

  async function handleResumeCampaign(campaign: ZaloCampaign) {
    try {
      const nextCampaigns = await resumeZaloCampaign(campaign.id);
      setCampaigns(nextCampaigns);
      showToast("Đã tiếp tục chiến dịch.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tiếp tục chiến dịch.");
    }
  }

  async function handleDeleteCampaign(campaign: ZaloCampaign) {
    const runningText = ["scheduled", "running", "paused"].includes(campaign.status) ? " Chiến dịch chưa hoàn tất sẽ được dừng trước khi xoá khỏi lịch sử." : "";
    if (!(await showConfirm(`Xoá lịch sử chiến dịch "${campaign.name}"?${runningText}`))) return;
    try {
      const nextCampaigns = await deleteZaloCampaign(campaign.id);
      setCampaigns(nextCampaigns);
      showToast("Đã xoá lịch sử chiến dịch.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xoá lịch sử chiến dịch.");
    }
  }

  async function handleCancelHiddenCampaigns() {
    if (!(await showConfirm("Hủy tất cả chiến dịch Zalo đang chạy hoặc đang chờ?"))) return;
    try {
      const nextCampaigns = await cancelRunningZaloCampaigns();
      setCampaigns(nextCampaigns);
      showToast("Đã hủy các chiến dịch đang chạy hoặc đang chờ.");
      await loadData(selectedAccountId);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể hủy chiến dịch đang chạy ngầm.");
    }
  }

  useEffect(() => {
    loadData(0);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchZaloCampaigns(selectedAccountId || undefined)
        .then(async (payload) => {
          let nextAccounts = payload.accounts;
          if (!nextAccounts.length) {
            nextAccounts = await fetchZaloAccounts().catch(() => []);
          }
          setAccounts(nextAccounts);
          if (selectedAccountId && !nextAccounts.some((account) => account.id === selectedAccountId && isCampaignAccountReady(account))) {
            setSelectedAccountId(0);
            setSelectedTargets([]);
          }
          setCampaigns((current) => payload.campaigns.length || !current.length ? payload.campaigns : current);
          setStats(payload.stats);
        })
        .catch(() => null);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [selectedAccountId]);

  return (
    <AppFrame active="/campaigns" title="Chiến dịch">
      <PageHeader
        title="Chiến dịch Zalo"
        desc="Quét nhóm hoặc bạn bè từ tài khoản Zalo đã kết nối, chọn người nhận và lên lịch gửi nội dung theo từng đợt."
        action={
          <button className="btn btn-red" disabled={!selectedAccountId || scanning} onClick={handleScanTargets} type="button">
            <Icon name="search" size={18} /> {scanning ? "Đang quét..." : `Scan ${targetLabel}`}
          </button>
        }
      />

      <div className="stack">
        <section className="grid-4">
          <StatCard label="Chiến dịch" value={String(stats.total)} help="Tổng chiến dịch đã tạo" icon="campaign" />
          <StatCard label="Đang chờ" value={String(stats.scheduled)} help="Đã lên lịch gửi" icon="schedule_send" />
          <StatCard label="Đang chạy" value={String(stats.running)} help="Worker đang xử lý" icon="timer" />
          <StatCard label="Đã scan" value={String(targetType === "friend" ? friends.length : targetType === "member" ? visibleTargets.length : groups.length)} help={currentAccount?.display_name || "Tài khoản Zalo"} icon="groups" />
        </section>

        {composeOpen ? (
        <section className="campaign-workspace campaign-workspace-modal" onMouseDown={() => setComposeOpen(false)}>
          <form className="card pad campaign-compose campaign-compose-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={handleCreateCampaign}>
            <div className="between">
              <div>
                <h2>Thiết lập gửi Zalo</h2>
                <p className="subtitle">Chọn tài khoản, chọn nhóm hoặc bạn bè, nhập nội dung và đặt lịch gửi.</p>
              </div>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <span className="status orange">{selectedTargets.length} {targetLabel}</span>
                <button className="btn btn-secondary" onClick={() => setComposeOpen(false)} type="button">
                  <Icon name="x" size={16} /> Đóng
                </button>
              </div>
            </div>

            <label>
              <span>Tài khoản Zalo</span>
              <select
                className="input"
                value={selectedAccountId || ""}
                onChange={(event) => {
                  const id = Number(event.target.value || 0);
                  setSelectedAccountId(id);
                  setSelectedTargets([]);
                  setSourceGroupId("");
                  loadData(id);
                }}
              >
                <option value="">Chọn tài khoản Zalo</option>
                {activeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.display_name || account.phone_number || account.own_id} {account.status && account.status !== "active" ? `(${statusText(account.status)})` : ""}
                  </option>
                ))}
                {!activeAccounts.length ? <option disabled value="__empty">Chưa có tài khoản Zalo khả dụng</option> : null}
              </select>
            </label>

            <label>
              <span>Gửi cho</span>
              <select
                className="input"
                value={targetType}
                onChange={(event) => {
                  const nextTargetType = event.target.value as "group" | "friend" | "member";
                  setTargetType(nextTargetType);
                  if (nextTargetType === "member") {
                    setForm((value) => ({ ...value, image_data_url: "", delay_seconds: Math.max(10, Number(value.delay_seconds || 8)) }));
                    setImageName("");
                  }
                  setSelectedTargets([]);
                  setSearch("");
                  if (nextTargetType === "friend") setTargetModalOpen(false);
                  if (nextTargetType !== "member") setSourceGroupId("");
                }}
              >
                <option value="group">Nhóm Zalo</option>
                <option value="friend">Bạn bè Zalo</option>
                <option value="member">Thành viên trong nhóm</option>
              </select>
              {targetType !== "friend" ? (
                <button className="btn btn-secondary" onClick={() => setTargetModalOpen(true)} type="button">
                  <Icon name="groups" size={17} /> Xem nhóm
                </button>
              ) : null}
            </label>

            {targetType === "member" ? (
              <label>
                <span>Nhóm nguồn</span>
                <select
                  className="input"
                  value={sourceGroupId}
                  onChange={(event) => {
                    setSourceGroupId(event.target.value);
                    setSelectedTargets([]);
                    setSearch("");
                  }}
                >
                  <option value="">Tất cả nhóm đã scan</option>
                  {groups
                    .filter((group) => !selectedAccountId || group.zalo_account_id === selectedAccountId)
                    .map((group) => (
                      <option key={group.group_id} value={group.group_id}>
                        {group.group_name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            <label>
              <span>Tên chiến dịch</span>
              <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>

            <label>
              <span>Nội dung tin nhắn</span>
              <textarea
                className="input campaign-message-input"
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
                placeholder={`Nhập nội dung sẽ gửi vào các ${targetLabel} đã chọn...`}
              />
            </label>

            <div className="campaign-image-picker">
              <label className={`btn btn-secondary ${targetType === "member" ? "disabled" : ""}`}>
                <Icon name="image" size={18} /> Chọn ảnh
                <input accept="image/*" disabled={targetType === "member"} onChange={handleImageChange} type="file" />
              </label>
              {form.image_data_url ? (
                <div className="campaign-image-preview">
                  <img src={form.image_data_url} alt="Ảnh đính kèm" />
                  <span>{imageName || "Ảnh đính kèm"}</span>
                  <button className="btn btn-secondary" onClick={() => { setForm({ ...form, image_data_url: "" }); setImageName(""); }} type="button">
                    <Icon name="x" size={16} /> Xóa ảnh
                  </button>
                </div>
              ) : (
                <span className="muted">{targetType === "member" ? "Gửi thành viên trong nhóm chỉ hỗ trợ tin nhắn chữ." : "Có thể gửi kèm ảnh JPG, PNG, WEBP hoặc GIF tối đa 6MB."}</span>
              )}
            </div>

            <label>
              <span>Kiểu gửi</span>
              <select
                className="input"
                value={form.schedule_type}
                onChange={(event) => {
                  const nextType = event.target.value as "now" | "once" | "custom";
                  setForm({ ...form, schedule_type: nextType });
                }}
              >
                <option value="now">Gửi tức thời</option>
                <option value="once">Lên lịch một lần</option>
                <option value="custom">Gửi tuỳ chỉnh</option>
              </select>
            </label>

            {form.schedule_type === "custom" ? (
              <div className="stack" style={{ gap: 12 }}>
                <div className="campaign-weekday-field">
                  <span>Chọn thứ gửi</span>
                  <div className="campaign-weekday-grid">
                    {weekdayOptions.map((day) => (
                      <button
                        className={`campaign-weekday-button ${form.days_of_week.includes(day.value) ? "active" : ""}`}
                        key={day.value}
                        onClick={() => toggleWeekday(day.value)}
                        type="button"
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  <span>Giờ gửi</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      className="input"
                      type="time"
                      value={form.custom_scheduled_time}
                      onChange={(event) => setForm({ ...form, custom_scheduled_time: event.target.value })}
                    />
                    <button className="btn btn-secondary" type="button" onClick={addCustomScheduleTime} style={{ whiteSpace: "nowrap" }}>
                      <Icon name="add" size={16} /> Thêm giờ
                    </button>
                  </div>
                </label>
                <div className="campaign-time-chip-list">
                  {form.custom_scheduled_times.map((time) => (
                    <button className="campaign-time-chip" key={time} type="button" onClick={() => removeCustomScheduleTime(time)}>
                      {time} <Icon name="x" size={14} />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="campaign-schedule-grid">
              {form.schedule_type === "once" ? (
                <label className="campaign-time-field">
                  <span>Ngày giờ gửi</span>
                  <div className="campaign-date-time-row">
                    <input
                      className="input"
                      type="datetime-local"
                      value={form.scheduled_at}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setForm({
                          ...form,
                          scheduled_at: nextValue,
                          scheduled_datetimes: form.scheduled_datetimes.length <= 1 ? [nextValue] : form.scheduled_datetimes,
                        });
                      }}
                    />
                    <button className="btn btn-secondary campaign-add-date-time-button" type="button" onClick={addOnceScheduleDateTime}>
                      <Icon name="add" size={16} /> Thêm ngày giờ
                    </button>
                  </div>
                  <div className="campaign-time-chip-list">
                    {form.scheduled_datetimes.map((dateTime) => (
                      <button className="campaign-time-chip" key={dateTime} type="button" onClick={() => removeOnceScheduleDateTime(dateTime)}>
                        {formatDate(dateTime)} <Icon name="x" size={14} />
                      </button>
                    ))}
                  </div>
                </label>
              ) : null}
              <label>
                <span>Delay giữa các {targetLabel} (giây)</span>
                <input
                  className="input"
                  min={minDelaySeconds}
                  max={300}
                  type="number"
                  value={form.delay_seconds}
                  onChange={(event) => {
                    const nextDelay = Number(event.target.value || 8);
                    setForm({ ...form, delay_seconds: Math.max(minDelaySeconds, nextDelay) });
                  }}
                />
              </label>
            </div>

            <button className="btn btn-red" disabled={saving || !selectedAccountId || !selectedTargets.length} type="submit">
              <Icon name="schedule_send" size={18} /> {saving ? "Đang lưu..." : form.schedule_type === "now" ? "Gửi ngay" : form.schedule_type === "custom" ? "Lên lịch tuỳ chỉnh" : "Lên lịch gửi"}
            </button>
          </form>

          <section className="card campaign-groups">
            <div className="between campaign-panel-head">
              <div>
                <h2>{targetTitle}</h2>
                <p className="subtitle">Danh sách lấy từ lần scan gần nhất của tài khoản đang chọn.</p>
              </div>
              <button className="btn btn-secondary" disabled={!visibleTargets.length} onClick={toggleAllFiltered} type="button">
                <Icon name="check" size={17} /> {allFilteredSelected ? "Bỏ chọn" : "Chọn tất cả"}
              </button>
            </div>

            <div className="campaign-search-row">
              <input className="input" placeholder={`Tìm ${targetLabel} theo tên hoặc ID`} value={search} onChange={(event) => setSearch(event.target.value)} />
              <button className="btn btn-secondary" disabled={!selectedAccountId || scanning} onClick={handleScanTargets} type="button">
                <Icon name="refresh_cw" size={17} /> Quét lại
              </button>
            </div>

            {loading ? (
              <div className="campaign-empty">
                <Icon name="timer" size={44} />
                <p>Đang tải dữ liệu...</p>
              </div>
            ) : visibleTargets.length ? (
              <div className="campaign-group-list">
                {visibleTargets.map((target) => (
                  <div className="campaign-group-item" key={`${targetType}-${target.id}`}>
                    <input checked={selectedTargets.includes(target.id)} onChange={() => toggleTarget(target.id)} type="checkbox" />
                    <div>
                      <strong>{target.name}</strong>
                      <span>{target.meta}</span>
                    </div>
                    <button className="btn btn-secondary campaign-group-delete" onClick={() => handleDeleteTarget(target)} type="button" aria-label={`Xóa ${target.name}`}>
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="campaign-empty">
                <Icon name="groups" size={44} />
                <p>Chưa có {targetLabel}. Chọn tài khoản Zalo rồi bấm Scan {targetLabel}.</p>
              </div>
            )}
          </section>
        </section>
        ) : null}

        <section className="card">
          <div className="between campaign-panel-head">
            <div>
              <h2>Lịch sử chiến dịch</h2>
              <p className="subtitle">Theo dõi tiến độ gửi từng mục tiêu và hủy campaign chưa hoàn tất.</p>
            </div>
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={handleCancelHiddenCampaigns} type="button">
                <Icon name="x" size={16} /> Dừng chiến dịch ngầm
              </button>
              <button className="btn btn-red" onClick={() => setComposeOpen(true)} type="button">
                <Icon name="add" size={17} /> Thêm chiến dịch
              </button>
            </div>
          </div>

          {campaigns.length ? (
            <div className="campaign-list">
              {campaigns.map((campaign) => {
                const targetPage = campaignTargetPage(campaign);
                const targetPageCount = Math.max(1, Math.ceil(campaign.targets.length / campaignTargetPageSize));
                const targetStart = (targetPage - 1) * campaignTargetPageSize;
                const visibleCampaignTargets = campaign.targets.slice(targetStart, targetStart + campaignTargetPageSize);
                const isRecurringCampaign = campaign.schedule_type === "daily" || campaign.schedule_type === "custom";
                return (
                <article className="campaign-card" key={campaign.id}>
                  <div className="between">
                    <div>
                      <h3>{campaign.name}</h3>
                      <p className="muted">
                        {campaign.account_name || campaign.own_id} · {campaign.target_type === "friend" ? "Bạn bè" : campaign.target_type === "member" ? "Thành viên" : "Nhóm"} · {campaignScheduleText(campaign)}
                      </p>
                    </div>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <span className={`status ${statusTone(campaign.status)}`}>{statusText(campaign.status)}</span>
                      {["paused", "cancelled", "failed"].includes(campaign.status) ? (
                        <button
                          className="btn btn-primary"
                          onClick={() => handleResumeCampaign(campaign)}
                          type="button"
                          style={{ padding: "6px 12px", fontSize: 13 }}
                        >
                          <Icon name="play" size={15} /> Tiếp tục gửi
                        </button>
                      ) : null}
                      <button className="btn btn-secondary" onClick={() => handleDeleteCampaign(campaign)} type="button">
                        <Icon name="trash" size={16} /> Xoá lịch sử
                      </button>
                    </div>
                  </div>
                  {campaign.image ? (
                    <div className="campaign-history-image">
                      <img src={campaign.image.thumb || campaign.image.url} alt="Ảnh chiến dịch" />
                      <span>{campaign.image.filename || "Ảnh đính kèm"}</span>
                    </div>
                  ) : null}
                  {campaign.message ? <p className="campaign-message-preview">{campaign.message}</p> : null}
                  <div className="campaign-progress-row">
                    <span>{campaign.sent_count}/{campaign.total_groups} đã gửi</span>
                    <span>{campaign.failed_count} lỗi</span>
                    <span>{isRecurringCampaign ? "Tuỳ chỉnh" : "Một lần"}</span>
                    <span>Delay {campaign.delay_seconds} giây</span>
                  </div>
                  {campaign.last_error ? <div className="form-message error">{campaign.last_error}</div> : null}
                  <details open={campaign.targets.length > 0}>
                    <summary>Chi tiết mục tiêu</summary>
                    {visibleCampaignTargets.length ? (
                      <div className="campaign-target-list">
                        {visibleCampaignTargets.map((target) => (
                          <div className="campaign-target" key={target.id}>
                            <span className={`status ${statusTone(target.status)}`}>{statusText(target.status)}</span>
                            <strong>{target.group_name}</strong>
                            <small>{formatCampaignTargetMeta(target)}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">Chưa có dữ liệu mục tiêu cho chiến dịch này.</p>
                    )}
                    {targetPageCount > 1 ? (
                      <div className="campaign-target-pagination">
                        <button className="btn btn-secondary" disabled={targetPage <= 1} onClick={() => setCampaignTargetPage(campaign.id, targetPage - 1)} type="button">
                          <Icon name="chevron_left" size={16} /> Trước
                        </button>
                        <span>
                          {targetStart + 1}-{Math.min(targetStart + campaignTargetPageSize, campaign.targets.length)} / {campaign.targets.length}
                        </span>
                        <button className="btn btn-secondary" disabled={targetPage >= targetPageCount} onClick={() => setCampaignTargetPage(campaign.id, targetPage + 1)} type="button">
                          Sau <Icon name="chevron_right" size={16} />
                        </button>
                      </div>
                    ) : null}
                  </details>
                  {["scheduled", "running", "paused", "cancelled", "failed"].includes(campaign.status) ? (
                    <div className="row" style={{ justifyContent: "flex-end", marginTop: 12 }}>
                      {["paused", "cancelled", "failed"].includes(campaign.status) ? (
                        <button className="btn btn-primary" onClick={() => handleResumeCampaign(campaign)} type="button">
                          <Icon name="play" size={16} /> Tiếp tục gửi
                        </button>
                      ) : (
                        <button className="btn btn-secondary" onClick={() => handlePauseCampaign(campaign)} type="button">
                          <Icon name="pause" size={16} /> Dừng
                        </button>
                      )}
                      {["scheduled", "running", "paused"].includes(campaign.status) ? (
                        <button className="btn btn-secondary" onClick={() => handleCancelCampaign(campaign)} type="button">
                          <Icon name="x" size={16} /> Hủy chiến dịch
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
                );
              })}
            </div>
          ) : (
            <div className="campaign-empty">
              <Icon name="campaign" size={44} />
              <p>Chưa có chiến dịch nào.</p>
            </div>
          )}
        </section>

        {targetModalOpen && targetType !== "friend" ? (
          <div className="campaign-target-modal-backdrop" role="presentation" onMouseDown={() => setTargetModalOpen(false)}>
            <section className="card campaign-groups campaign-target-modal" role="dialog" aria-modal="true" aria-labelledby="campaign-target-modal-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="between campaign-panel-head">
                <div>
                  <h2 id="campaign-target-modal-title">{targetTitle}</h2>
                  <p className="subtitle">Danh sách lấy từ lần scan gần nhất của tài khoản đang chọn.</p>
                </div>
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="btn btn-secondary" disabled={!visibleTargets.length} onClick={toggleAllFiltered} type="button">
                    <Icon name="check" size={17} /> {allFilteredSelected ? "Bỏ chọn" : "Chọn tất cả"}
                  </button>
                  <button className="btn btn-secondary" onClick={() => setTargetModalOpen(false)} type="button">
                    <Icon name="x" size={16} /> Đóng
                  </button>
                </div>
              </div>

              <div className="campaign-search-row">
                <input className="input" placeholder={`Tìm ${targetLabel} theo tên hoặc ID`} value={search} onChange={(event) => setSearch(event.target.value)} />
                <button className="btn btn-secondary" disabled={!selectedAccountId || scanning} onClick={handleScanTargets} type="button">
                  <Icon name="refresh_cw" size={17} /> Quét lại
                </button>
              </div>

              {loading ? (
                <div className="campaign-empty">
                  <Icon name="timer" size={44} />
                  <p>Đang tải dữ liệu...</p>
                </div>
              ) : visibleTargets.length ? (
                <div className="campaign-group-list">
                  {visibleTargets.map((target) => (
                    <div className="campaign-group-item" key={`${targetType}-modal-${target.id}`}>
                      <input checked={selectedTargets.includes(target.id)} onChange={() => toggleTarget(target.id)} type="checkbox" />
                      <div>
                        <strong>{target.name}</strong>
                        <span>{target.meta}</span>
                      </div>
                      <button className="btn btn-secondary campaign-group-delete" onClick={() => handleDeleteTarget(target)} type="button" aria-label={`Xóa ${target.name}`}>
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="campaign-empty">
                  <Icon name="groups" size={44} />
                  <p>Chưa có {targetLabel}. Chọn tài khoản Zalo rồi bấm Scan {targetLabel}.</p>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </AppFrame>
  );
}
