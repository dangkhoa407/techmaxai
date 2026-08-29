"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { io as createSocket } from "socket.io-client";
import {
  API_BASE_URL,
  fetchLoginSessions,
  fetchNotifications,
  formatVnd,
  getToken,
  logoutUser,
  markNotificationsRead,
  useAuthUser,
  type AppNotification,
  type LoginSession
} from "./lib/auth";
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Bell,
  Bot,
  Box,
  BriefcaseBusiness,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CircleOff,
  Clock,
  CloudOff,
  CreditCard,
  Download,
  CalendarClock,
  FilePenLine,
  FileText,
  Filter,
  Gauge,
  Globe,
  Gift,
  Handshake,
  History,
  Image,
  Landmark,
  LifeBuoy,
  Link2,
  Lock,
  LogOut,
  Mail,
  Menu,
  Phone,
  MessageCircle,
  Minus,
  Network,
  Pause,
  Play,
  Plus,
  PlusCircle,
  QrCode,
  ReceiptText,
  Reply,
  RefreshCw,
  Rocket,
  Router,
  Search,
  Send,
  Settings,
  Shield,
  ShoppingBag,
  Smile,
  Timer,
  ToggleRight,
  UserCircle,
  UserPlus,
  UserRoundX,
  Users,
  Wallet,
  MapPin,
  Video,
  Building2,
  Fingerprint,
  X,
  Zap
} from "lucide-react";

const navGroups = [
  {
    label: "Tổng quan",
    items: [
      ["dashboard", "Tổng quan", "/dashboard"],
      ["person_book", "Hồ sơ", "/profile"],
      ["shopping_bag", "Gói dịch vụ", "/packages"],
      ["settings", "Quản lý gói", "/plan-management"]
    ]
  },
  {
    label: "Vận hành",
    items: [
      ["language", "Website", "/api-docs"],
      ["zalo", "Tài khoản Zalo", "/zalo-accounts"],
      ["smart_toy", "BOT Zalo", "/zalo-bot"],
      ["vpn_lock", "Proxy", "/proxies"],
      ["group_work", "Fanpage Facebook", "/facebook-pages"],
      ["auto_facebook", "Auto Facebook", "/facebook-auto"],
      ["threads", "Auto Threads", "/threads-auto"],
      ["message_circle", "Chat", "/chat"],
      ["hub", "Mạng xã hội", "/social"],
      // ["groups", "Quản lý nhóm", "#"],
      ["smart_toy", "Quản lý Bot AI", "/chatbot-ai"],
      ["campaign", "Chiến dịch", "/campaigns"]
    ]
  },
  {
    label: "Hỗ trợ",
    items: [
      ["support_agent", "Gửi ticket", "/tickets"]
    ]
  },
  {
    label: "Tài chính",
    items: [
      ["payments", "Nạp tiền", "/deposit"],
      ["receipt_long", "Hóa đơn", "/invoices"],
      ["account_balance_wallet", "Biến động số dư", "/balance-changes"],
      ["history", "Nhật ký hoạt động", "/activity"]
    ]
  }
];

const customSvgIconMap: Record<string, string> = {
  account_balance_wallet: "/icons/balance-changes.svg",
  account_circle: "/icons/user.svg",
  auto_facebook: "/icons/facebook.svg",
  bolt: "/icons/wrench.svg",
  campaign: "/icons/campaign.svg",
  dashboard: "/icons/home.svg",
  group: "/icons/group.svg",
  group_work: "/icons/flag.svg",
  groups: "/icons/group.svg",
  hub: "/icons/social.svg",
  image: "/icons/image.svg",
  language: "/icons/earth.svg",
  list_alt: "/icons/invoices.svg",
  mail: "/icons/message.svg",
  message_circle: "/icons/chat.svg",
  notifications: "/icons/bell.svg",
  payments: "/icons/deposit.svg",
  person_book: "/icons/user.svg",
  proxy: "/icons/proxy.svg",
  receipt_long: "/icons/invoices.svg",
  search: "/icons/search.svg",
  security: "/icons/protect.svg",
  settings: "/icons/setting.svg",
  shopping_bag: "/icons/star.svg",
  smart_toy: "/icons/aibot.svg",
  support_agent: "/icons/ticketsupport.svg",
  threads: "/icons/threads.svg",
  users: "/icons/group.svg",
  vpn_lock: "/icons/proxy.svg",
  wallet: "/icons/deposit.svg",
  zalo: "/icons/zalo.svg",
  location_on: "/icons/location.svg",
  map_pin: "/icons/location.svg",
  business: "/icons/earth.svg",
  credit_card_off: "/icons/protect.svg",
  flag: "/icons/flag.svg",
  history: "/icons/activity-log.svg",
  logout: "/icons/home.svg",
  person_add: "/icons/group.svg"
};

const iconMap = {
  access_time: Clock,
  account_balance: Landmark,
  account_balance_wallet: Wallet,
  account_circle: UserCircle,
  add: Plus,
  add_card: CreditCard,
  add_circle: PlusCircle,
  analytics: Activity,
  assignment_late: AlertTriangle,
  bar_chart: BarChart3,
  bolt: Zap,
  campaign: Send,
  check: Check,
  check_circle: CheckCircle,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  cloud_off: CloudOff,
  dashboard: Gauge,
  download: Download,
  error: AlertTriangle,
  filter_list: Filter,
  group: Users,
  users: Users,
  group_add: UserPlus,
  group_work: Network,
  groups: Users,
  handshake: Handshake,
  history: History,
  hub: Network,
  image: Image,
  gift: Gift,
  inventory_2: Box,
  language: Globe,
  list_alt: FileText,
  link: Link2,
  lock: Lock,
  logout: LogOut,
  mail: Mail,
  menu_book: BriefcaseBusiness,
  menu_open: Menu,
  message_circle: MessageCircle,
  minus: Minus,
  monitoring: Activity,
  notifications: Bell,
  payments: Banknote,
  pause: Pause,
  person_add: UserPlus,
  person_book: UserCircle,
  person_off: UserRoundX,
  phone: Phone,
  play: Play,
  qr_code_scanner: QrCode,
  receipt_long: ReceiptText,
  reply: Reply,
  refresh_cw: RefreshCw,
  rocket_launch: Rocket,
  router: Router,
  search: Search,
  security: Shield,
  schedule_send: CalendarClock,
  send: Send,
  settings: Settings,
  smile: Smile,
  shopping_bag: ShoppingBag,
  swap_horiz: ArrowLeftRight,
  smart_toy: Bot,
  support_agent: LifeBuoy,
  terminal: Network,
  edit_note: FilePenLine,
  timer: Timer,
  toggle_on: ToggleRight,
  update: RefreshCw,
  vpn_lock: Lock,
  warning: AlertTriangle,
  wallet: Wallet,
  location_on: MapPin,
  map_pin: MapPin,
  video: Video,
  business: Building2,
  fingerprint: Fingerprint,
  x: X,
  credit_card_off: CreditCard
};

export function Icon({ name, size = 22, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  const LucideIcon = iconMap[name as keyof typeof iconMap] ?? CircleOff;
  return <LucideIcon size={size} strokeWidth={1.8} style={style} aria-hidden="true" />;
}

export function NavIcon({ name, size = 22, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  const svgSrc = customSvgIconMap[name];
  if (!svgSrc) return <Icon name={name} size={size} style={style} />;

  return (
    <img
      className="app-icon-svg"
      src={svgSrc}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      decoding="async"
    />
  );
}

export function VerifiedBadge({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      className={["verified-badge", className].filter(Boolean).join(" ")}
      src="/icons/verified.svg"
      alt="Đã xác minh"
      title="Đã xác minh"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      decoding="async"
    />
  );
}

export function UserAvatar({
  name,
  src,
  size = 44,
  className = "",
}: {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const text = String(name || "Bạn").trim();
  const words = text.split(/\s+/).filter(Boolean);
  const initials = words.length <= 1
    ? (words[0] || "B").slice(0, 2).toUpperCase()
    : `${words[0][0] || ""}${words[words.length - 1][0] || ""}`.toUpperCase();

  return (
    <span
      className={["user-avatar", className].filter(Boolean).join(" ")}
      style={{ width: size, height: size, flexBasis: size, fontSize: Math.max(11, Math.round(size * 0.3)) }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

export function RouteTransitionOverlay() {
  return null;
}

function LogoText({ compact = false }: { compact?: boolean }) {
  return (
    <img
      className={compact ? "logo-text-img compact" : "logo-text-img"}
      src={compact ? "/favicon.png" : "/logo-text.png"}
      alt="TechMax"
      width={compact ? 4000 : 5669}
      height={compact ? 4000 : 1512}
      decoding="async"
    />
  );
}

export function Sidebar({ active, collapsed }: { active: string; collapsed: boolean }) {
  const { user } = useAuthUser();
  const isAdmin = user?.level === "admin";

  const displayedGroups = [...navGroups];
  if (isAdmin) {
    displayedGroups.push({
      label: "Quản trị hệ thống",
      items: [
        ["dashboard", "Admin Dashboard", "/admin"]
      ]
    });
  }

  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <Link className="brand" href="/dashboard">
        <LogoText compact={collapsed} />
      </Link>
      <nav>
        {displayedGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-section">{group.label}</div>
            {group.items.map(([icon, label, href]) => (
              <Link
                className={`nav-link ${active === href ? "active" : ""}`}
                href={href}
                key={`${group.label}-${label}`}
              >
                <NavIcon name={icon} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export function Topbar({ title, collapsed, onToggleSidebar }: { title: React.ReactNode; collapsed: boolean; onToggleSidebar: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthUser();
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [loginSessions, setLoginSessions] = useState<LoginSession[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const accountRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const displayName = user?.fullname || "Khách hàng";
  const displayEmail = user?.email || "none@gmail.com";
  const mainBalance = formatVnd(user?.money);
  const accountMenu = [
    ["person_book", "Hồ sơ người dùng", "/profile"],
    ["shopping_bag", "Gói dịch vụ", "/packages"],
    ["account_circle", "Tài khoản Zalo", "/zalo-accounts"],
    ["smart_toy", "BOT Zalo", "/zalo-bot"],
    ["vpn_lock", "Proxy", "/proxies"],
    ["campaign", "Tài khoản Fanpage", "/facebook-pages"],
    ["smart_toy", "Quản lý Bot AI", "/chatbot-ai"],
    ["payments", "Nạp tiền", "/deposit"],
    ["receipt_long", "Hóa đơn", "/invoices"]
  ];
  useEffect(() => {
    if (!user) {
      setLoginSessions([]);
      setAppNotifications([]);
      setUnreadNotifications(0);
      return;
    }

    let cancelled = false;
    const loadTopbarData = () => {
      fetchLoginSessions()
        .then((sessions) => {
          if (!cancelled) setLoginSessions(sessions);
        })
        .catch(() => {
          if (!cancelled) setLoginSessions([]);
        });
      fetchNotifications(8)
        .then((payload) => {
          if (!cancelled) {
            setAppNotifications(payload.notifications);
            setUnreadNotifications(payload.unread_count);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAppNotifications([]);
            setUnreadNotifications(0);
          }
        });
    };

    loadTopbarData();
    const timer = window.setInterval(loadTopbarData, 60000);
    const token = getToken();
    const socket = token ? createSocket(API_BASE_URL.replace(/\/api\/?$/i, ""), {
      path: "/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    }) : null;

    socket?.on("chat:conversation", loadTopbarData);
    socket?.on("chat:conversation_deleted", loadTopbarData);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      socket?.disconnect();
    };
  }, [user?.id]);

  const sessionAlerts = loginSessions
    .filter((session) => !session.current)
    .slice(0, 2)
    .map((session) => ({
      title: "Phiên đăng nhập lạ",
      desc: `${session.device_name} tại ${session.location || "vị trí không rõ"} vừa đăng nhập vào tài khoản.`,
      time: session.last_seen_at || "Vừa xong",
      tone: "red" as const,
      href: "/profile",
      read: false
    }));

  const notifications = [
    ...appNotifications.map((item) => ({
      id: item.id,
      title: item.title,
      desc: item.message,
      time: item.created_at,
      tone: item.tone,
      href: item.action_url,
      read: Boolean(item.read_at)
    })),
    ...sessionAlerts
  ].slice(0, 8);

  const handleMarkNotificationsRead = async () => {
    try {
      await markNotificationsRead();
      setUnreadNotifications(0);
      setAppNotifications((items) => items.map((item) => ({ ...item, read_at: item.read_at || "now" })));
    } catch {
      // The dropdown should stay usable even if the read marker fails.
    }
  };

  useEffect(() => {
    setAccountOpen(false);
    setNotificationOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Node;
      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <header className="topbar">
      <div className="row desktop-title-row">
        <button className="sidebar-toggle" onClick={onToggleSidebar} aria-label={collapsed ? "Mở sidebar" : "Thu gọn sidebar"} type="button">
          <Icon name="menu_open" />
        </button>
        <span className="muted">/ {title}</span>
      </div>
      <Link className="mobile-top-logo" href="/dashboard" aria-label="TechMax">
        <LogoText compact />
      </Link>
      <div className="row">
        <div className="chip">
          <Icon name="account_balance_wallet" size={16} />
          Số dư: <strong style={{ color: "var(--primary)" }}>{mainBalance}</strong>
        </div>
        <Link className="btn btn-red" href="/deposit">
          Nạp tiền ngay
        </Link>
        <div className="notif-menu-wrap" ref={notificationRef}>
          <button
            className="btn btn-secondary icon-top-button"
            aria-expanded={notificationOpen}
            aria-label="Notifications"
            onClick={(event) => {
              event.stopPropagation();
              setNotificationOpen((value) => !value);
              setAccountOpen(false);
            }}
            type="button"
          >
            <Icon name="notifications" />
          </button>
          <div className={notificationOpen ? "notification-dropdown open" : "notification-dropdown"}>
            <div className="dropdown-title-row">
              <div>
                <strong>Thông báo</strong>
                <span>{unreadNotifications} thông báo mới</span>
              </div>
              <button type="button" onClick={handleMarkNotificationsRead}>Đánh dấu đã đọc</button>
            </div>
            <div className="notification-list">
              {notifications.length ? notifications.map((item, index) => (
                <Link
                  className="notification-item"
                  href={item.href || "/activity"}
                  key={`${item.title}-${index}`}
                  onClick={() => setNotificationOpen(false)}
                >
                  <div className={`notification-dot ${item.tone}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.desc}</p>
                    <span>{item.time}</span>
                  </div>
                </Link>
              )) : (
                <div className="notification-empty">
                  <strong>Chưa có thông báo mới</strong>
                  <p>Tài khoản của bạn hiện chưa có cảnh báo cần xử lý.</p>
                </div>
              )}
            </div>
            <Link className="notification-footer" href="/activity">
              Xem tất cả hoạt động
            </Link>
          </div>
        </div>
        <div className="avatar-menu-wrap" ref={accountRef}>
          <button
            className="avatar-button"
            onClick={(event) => {
              event.stopPropagation();
              setAccountOpen((value) => !value);
              setNotificationOpen(false);
            }}
            aria-expanded={accountOpen}
            aria-label="Account menu"
            type="button"
          >
            <UserAvatar name={displayName || displayEmail} src={user?.avatar_url} size={34} />
          </button>
          <div className={accountOpen ? "account-dropdown open" : "account-dropdown"}>
            <div className="account-head">
              <strong className="name-with-badge">
                {displayName}
              </strong>
              <span>{displayEmail}</span>
            </div>
            <div className="account-list">
              {accountMenu.map(([icon, label, href]) => (
                <Link className="account-item" href={href} key={label} onClick={() => setAccountOpen(false)}>
                  <Icon name={icon} size={17} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
            <button
              className="account-item logout-item"
              onClick={async () => {
                await logoutUser();
                setAccountOpen(false);
                router.push("/login");
              }}
              type="button"
            >
              <Icon name="logout" size={17} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function AppFrame({
  active,
  title,
  hideMobileNav = false,
  children
}: {
  active: string;
  title: React.ReactNode;
  hideMobileNav?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { loading } = useAuthUser();
  const [mounted, setMounted] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;

    if (!getToken()) {
      router.replace("/login");
    }
  }, [mounted, loading, router]);

  if (!mounted || loading || !getToken()) {
    return <div className="app-shell" suppressHydrationWarning />;
  }

  return (
    <div className={sidebarCollapsed ? "app-shell sidebar-collapsed" : "app-shell"}>
      <Sidebar active={active} collapsed={sidebarCollapsed} />
      <Topbar title={title} collapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((value) => !value)} />
      <main className="main">
        <div className="page">{children}</div>
      </main>
      {hideMobileNav ? null : <MobileBottomNav active={active} />}
    </div>
  );
}

function MobileBottomNav({ active }: { active: string }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetProgress, setSheetProgress] = useState(0);
  const [navHidden, setNavHidden] = useState(false);
  const [expandedHeight, setExpandedHeight] = useState(620);
  const touchStartRef = useRef<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchDragActiveRef = useRef(false);
  const dragStartProgressRef = useRef(0);
  const navTouchStartRef = useRef<number | null>(null);
  const navTouchStartedOnBottomItemRef = useRef(false);
  const navHiddenRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const lastElementScrollRef = useRef<WeakMap<Element, number>>(new WeakMap());
  const items = [
    ["dashboard", "Tổng quan", "/dashboard"],
    ["shopping_bag", "Gói", "/packages"],
    ["payments", "Nạp", "/deposit"],
    ["message_circle", "Chat", "/chat"],
    ["person_book", "Hồ sơ", "/profile"]
  ];

  useEffect(() => {
    setSheetOpen(false);
    setSheetProgress(0);
    setNavHidden(false);
  }, [pathname]);

  useEffect(() => {
    navHiddenRef.current = navHidden;
  }, [navHidden]);

  useEffect(() => {
    function handleNavCommand(event: Event) {
      const nextHidden = Boolean((event as CustomEvent<{ hidden?: boolean }>).detail?.hidden);
      if (sheetProgressRef.current > 0.02) return;
      setNavHidden(nextHidden);
    }

    window.addEventListener("techmax-mobile-nav", handleNavCommand);
    return () => window.removeEventListener("techmax-mobile-nav", handleNavCommand);
  }, []);

  useEffect(() => {
    function showOrHideByDelta(delta: number) {
      if (sheetProgressRef.current > 0.02) {
        setNavHidden(false);
        return;
      }
      if (Math.abs(delta) < 14) return;
      setNavHidden(delta > 0);
    }

    function handleScroll(event?: Event) {
      const target = event?.target;
      if (target instanceof Element && target !== document.documentElement && target !== document.body) {
        if (target.closest(".chat-workspace")) return;
        const current = target.scrollTop;
        const previous = lastElementScrollRef.current.get(target) ?? current;
        lastElementScrollRef.current.set(target, current);
        if (current <= 8) {
          setNavHidden(false);
          return;
        }
        showOrHideByDelta(current - previous);
        return;
      }

      const current = window.scrollY || document.documentElement.scrollTop || 0;
      const delta = current - lastScrollYRef.current;
      lastScrollYRef.current = current;
      if (current <= 8) {
        setNavHidden(false);
        return;
      }
      showOrHideByDelta(delta);
    }

    function handleTouchStart(event: TouchEvent) {
      navTouchStartRef.current = event.touches[0]?.clientY ?? null;
      const target = event.target;
      navTouchStartedOnBottomItemRef.current = target instanceof Element && Boolean(target.closest(".mobile-bottom-nav a"));
    }

    function handleTouchMove(event: TouchEvent) {
      if (navTouchStartRef.current === null) return;
      if (navTouchStartedOnBottomItemRef.current) return;
      const target = event.target;
      const currentY = event.touches[0]?.clientY ?? navTouchStartRef.current;
      const delta = navTouchStartRef.current - currentY;
      const startedNearBottom = navTouchStartRef.current > window.innerHeight - 92;
      if (startedNearBottom && delta > 18) {
        setNavHidden(false);
      } else if (target instanceof Element && target.closest(".chat-workspace.mobile-room-open")) {
        if (delta > 18) setNavHidden(true);
      } else {
        showOrHideByDelta(delta);
      }
      navTouchStartRef.current = currentY;
    }

    function handleTouchEnd() {
      navTouchStartedOnBottomItemRef.current = false;
      navTouchStartRef.current = null;
    }

    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    function syncHeight() {
      setExpandedHeight(Math.min(window.innerHeight * 0.78, 720));
    }
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, []);

  useEffect(() => {
    if (sheetProgress <= 0.02) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
    };
  }, [sheetProgress]);

  const handleRef = useRef<HTMLButtonElement>(null);
  const navItemsRef = useRef<HTMLDivElement>(null);

  const sheetProgressRef = useRef(sheetProgress);
  const expandedHeightRef = useRef(expandedHeight);
  useEffect(() => { sheetProgressRef.current = sheetProgress; }, [sheetProgress]);
  useEffect(() => { expandedHeightRef.current = expandedHeight; }, [expandedHeight]);

  useEffect(() => {
    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      touchStartRef.current = touch?.clientY ?? null;
      touchStartXRef.current = touch?.clientX ?? null;
      touchDragActiveRef.current = false;
      dragStartProgressRef.current = sheetProgressRef.current;
    }

    function handleTouchMove(event: TouchEvent) {
      if (touchStartRef.current === null) return;
      const touch = event.touches[0];
      const currentY = touch?.clientY ?? touchStartRef.current;
      const currentX = touch?.clientX ?? touchStartXRef.current ?? 0;
      const deltaY = touchStartRef.current - currentY;
      const deltaX = (touchStartXRef.current ?? currentX) - currentX;

      if (!touchDragActiveRef.current) {
        const isVerticalDrag = Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2;
        if (!isVerticalDrag) return;
        touchDragActiveRef.current = true;
      }

      event.preventDefault();
      const travel = Math.max(expandedHeightRef.current - 68, 1);
      const nextProgress = Math.min(1, Math.max(0, dragStartProgressRef.current + deltaY / travel));
      setSheetProgress(nextProgress);
    }

    function handleTouchEnd() {
      if (touchStartRef.current === null) return;
      if (!touchDragActiveRef.current) {
        touchStartRef.current = null;
        touchStartXRef.current = null;
        return;
      }
      const shouldOpen = sheetProgressRef.current >= 0.34;
      setSheetOpen(shouldOpen);
      setSheetProgress(shouldOpen ? 1 : 0);
      touchStartRef.current = null;
      touchStartXRef.current = null;
      touchDragActiveRef.current = false;
    }

    const opts: AddEventListenerOptions = { passive: false };
    const els = [handleRef.current, navItemsRef.current].filter(Boolean) as HTMLElement[];

    for (const el of els) {
      el.addEventListener("touchstart", handleTouchStart, opts);
      el.addEventListener("touchmove", handleTouchMove, opts);
      el.addEventListener("touchend", handleTouchEnd);
      el.addEventListener("touchcancel", handleTouchEnd);
    }

    return () => {
      for (const el of els) {
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
        el.removeEventListener("touchcancel", handleTouchEnd);
      }
    };
  }, []);

  const currentHeight = 68 + (expandedHeight - 68) * sheetProgress;
  const navStyle = {
    maxHeight: `${currentHeight}px`,
    "--sheet-progress": sheetProgress
  } as React.CSSProperties;

  return (
    <nav
      className={`${sheetProgress > 0.02 ? "mobile-bottom-nav expanded" : "mobile-bottom-nav"} ${navHidden ? "hidden" : ""}`}
      style={navStyle}
    >
      <button
        ref={handleRef}
        className="mobile-sheet-handle"
        aria-label={sheetOpen ? "Đóng tiện ích" : "Mở tiện ích"}
        type="button"
      />
      <div className="mobile-sheet-content">
        {navGroups.map((group) => (
          <div className="mobile-sheet-group" key={group.label}>
            <p>{group.label}</p>
            <div className="mobile-sheet-grid">
              {group.items.map(([icon, label, href]) => (
                <Link className={active === href ? "active" : ""} href={href} key={`${group.label}-${label}`}>
                  <NavIcon name={icon} size={19} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mobile-nav-items" ref={navItemsRef}>
        <span className="mobile-nav-swipe-zone" aria-hidden="true" />
        {items.map(([icon, label, href]) => (
          <Link className={active === href ? "active" : ""} href={href} key={href}>
            <NavIcon name={icon} size={20} />
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export function StatCard({
  label,
  value,
  help,
  icon
}: {
  label: string;
  value: string;
  help: string;
  icon: string;
}) {
  return (
    <div className="card metric">
      <div className="between">
        <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>
          {label}
        </span>
        <Icon name={icon} />
      </div>
      <div>
        <strong>{value}</strong>
        <span style={{ fontSize: 12 }}>{help}</span>
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  desc,
  action
}: {
  eyebrow?: string;
  title: React.ReactNode;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="between page-header" style={{ marginBottom: 24 }}>
      <div>
        {eyebrow ? (
          <div className="page-header-eyebrow" style={{ color: "var(--red)", fontSize: 12, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>
            {eyebrow}
          </div>
        ) : null}
        <h1 className="title">{title}</h1>
        {desc ? <p className="subtitle">{desc}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SearchBar({ placeholder = "Tìm kiếm..." }: { placeholder?: string }) {
  return (
    <div className="glass" style={{ padding: 16, display: "flex", gap: 12 }}>
      <div style={{ flex: 1, position: "relative" }}>
        <span style={{ position: "absolute", top: 13, left: 14, color: "var(--dim)" }}>
          <Icon name="search" size={20} />
        </span>
        <input className="input" style={{ paddingLeft: 44 }} placeholder={placeholder} />
      </div>
      <button className="btn btn-secondary">
        <Icon name="filter_list" size={18} />
        Tìm kiếm
      </button>
    </div>
  );
}
