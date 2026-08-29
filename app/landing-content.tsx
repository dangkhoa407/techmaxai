"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import AuthPublicRedirect from "./auth-public-redirect";
import { Icon } from "./components";
import CorporateFooter from "./components/corporate-footer";
import LandingReveal from "./landing-reveal";

type LandingSettings = {
  demo_video_url: string;
  demo_poster_url: string;
};

type PublicServicePlan = {
  id: number;
  code: string;
  name: string;
  price: number;
  cycle: string;
  bots?: string;
  channels?: string;
  messages?: string;
  campaign_usage_limit?: number | null;
  campaign_usage_unlimited?: boolean;
  automation_usage_limit?: number | null;
  automation_usage_unlimited?: boolean;
  support?: string;
  features: { text: string; included: boolean }[];
  popular: boolean;
  is_active: boolean;
};

type PriceItem = {
  name: string;
  price: string;
  popular: boolean;
  features: { text: string; included: boolean }[];
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://project.conkudaden.online/api").replace(/\/$/, "");

async function loadLandingSettings(): Promise<LandingSettings> {
  const response = await fetch(`${apiBaseUrl}/landing-settings`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || "Cannot load landing settings.");
  return payload?.settings || { demo_video_url: "", demo_poster_url: "/dashboard-preview.png" };
}

async function loadServicePlans(): Promise<PriceItem[]> {
  const response = await fetch(`${apiBaseUrl}/packages?_=${Date.now()}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) throw new Error(payload?.message || "Cannot load packages.");
  const plans = Array.isArray(payload?.plans) ? payload.plans as PublicServicePlan[] : [];
  return plans
    .filter((plan) => plan.is_active !== false)
    .map((plan) => ({
      name: plan.name,
      price: `${Number(plan.price || 0).toLocaleString("vi-VN")} đ`,
      popular: Boolean(plan.popular),
      features: planFeatures(plan),
    }));
}

function fallbackPlanFeatures(plan: PublicServicePlan) {
  const campaignUsage = plan.campaign_usage_unlimited
    ? "Không giới hạn lượt chạy chiến dịch"
    : `${Number(plan.campaign_usage_limit || 0).toLocaleString("vi-VN")} lượt chạy chiến dịch`;
  const autoUsage = plan.automation_usage_unlimited
    ? "Không giới hạn lượt dùng Auto Facebook/Threads"
    : `${Number(plan.automation_usage_limit || 0).toLocaleString("vi-VN")} lượt dùng Auto Facebook/Threads`;

  return [
    withUnit(plan.bots, "bot AI"),
    withUnit(plan.channels, "Zalo/Facebook"),
    withUnit(plan.messages, "cuộc hội thoại/ngày"),
    campaignUsage,
    autoUsage,
    plan.support || "",
  ]
    .filter(Boolean)
    .map((text) => ({ text, included: true }));
}

function withUnit(value: string | undefined, unit: string) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.toLowerCase().includes(unit.toLowerCase()) ? text : `${text} ${unit}`;
}

function planFeatures(plan: PublicServicePlan) {
  const features = Array.isArray(plan.features) ? plan.features.filter((feature) => feature.text) : [];
  return features.length ? features : fallbackPlanFeatures(plan);
}

function getYouTubeEmbedUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com" || host === "youtube-nocookie.com") {
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "watch") videoId = url.searchParams.get("v") || "";
      if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") videoId = parts[1] || "";
    }

    if (!videoId) return "";
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      loop: "1",
      playlist: videoId,
      controls: "0",
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
    });
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
  } catch {
    return "";
  }
}

const steps = [
  ["link", "Khởi tạo AI", "Tạo ra bot AI từ thông tin doanh nghiệp của bạn chỉ với vài bước cơ bản và nhanh chóng."],
  ["edit_note", "Đào tạo AI", "Training các thông tin cần thiết, câu trả lời mẫu, kịch bản xử lý cho AI."],
  ["schedule_send", "Kết nối với Mạng Xã Hội", "Kết nối Zalo, Facebook, Instagram với AI của bạn và bắt đầu sử dụng."]
];

const fallbackPrices: PriceItem[] = [
  {
    name: "Gói Starter",
    price: "49.000 đ",
    popular: false,
    features: [
      { text: "1 bot AI", included: true },
      { text: "1 Zalo/Facebook", included: true },
      { text: "500 cuộc hội thoại/ngày", included: true },
      { text: "100 lượt chạy chiến dịch", included: true },
      { text: "100 lượt dùng Auto Facebook/Threads", included: true },
      { text: "Đội ngũ hỗ trợ đào tạo AI", included: false },
      { text: "Gửi tin nhắn hàng loạt", included: false },
      { text: "API & Webhook kết nối CRM", included: false },
      { text: "Hỗ trợ chuyên gia 24/7", included: false }
    ]
  },
  {
    name: "Gói Professional",
    price: "199.000 đ",
    popular: true,
    features: [
      { text: "5 bot AI", included: true },
      { text: "8 Zalo/Facebook", included: true },
      { text: "5.000 cuộc hội thoại/ngày", included: true },
      { text: "500 lượt chạy chiến dịch", included: true },
      { text: "500 lượt dùng Auto Facebook/Threads", included: true },
      { text: "Đội ngũ hỗ trợ đào tạo AI", included: true },
      { text: "Gửi tin nhắn hàng loạt", included: true },
      { text: "API & Webhook kết nối CRM", included: false },
      { text: "Hỗ trợ chuyên gia 24/7", included: false }
    ]
  },
  {
    name: "Gói Enterprise",
    price: "999.000đ",
    popular: false,
    features: [
      { text: "100 bot AI", included: true },
      { text: "Unlimited Zalo/Facebook", included: true },
      { text: "100.000 cuộc hội thoại/ngày", included: true },
      { text: "Không giới hạn lượt chạy chiến dịch", included: true },
      { text: "Không giới hạn lượt dùng Auto Facebook/Threads", included: true },
      { text: "Đội ngũ hỗ trợ đào tạo AI", included: true },
      { text: "Gửi tin nhắn hàng loạt", included: true },
      { text: "API & Webhook kết nối CRM", included: true },
      { text: "Hỗ trợ chuyên gia 24/7", included: true }
    ]
  }
];

const testimonials = [
  ["Nguyễn Minh Anh", "Shop mỹ phẩm Mộc An", "Bot hoạt động rất ổn định, giúp shop mình tiết kiệm được rất nhiều thời gian phản hồi tin nhắn khách hàng mới."],
  ["Trần Hoàng Long", "Long Accessories", "Rất hài lòng với trải nghiệm sử dụng TechMax. Tính năng AI bán hàng hoạt động hiệu quả, giao diện thân thiện và dễ sử dụng."],
  ["Phạm Thu Hà", "Hà Home Decor", "Dịch vụ chăm sóc khách hàng xuất sắc và sản phẩm AI hoạt động mượt mà. Hỗ trợ 24/7 rất nhiệt tình."],
  ["Đặng Ngọc Linh", "Linh House", "Mình tách nhóm khách và tối ưu kịch bản trả lời chỉ trong vài phút, đội sale phản hồi đồng đều hơn hẳn."],
  ["Võ Thanh Tâm", "Agency chăm sóc khách hàng", "Báo cáo rõ ràng theo từng kênh giúp mình biết nên dồn ngân sách vào chiến dịch nào."],
  ["Bùi Khánh Vy", "Mẹ & bé Khánh Vy", "Thiết lập rất nhanh, giao diện dễ hiểu và bot chạy ổn định trong các khung giờ cao điểm."]
];

const aiProviders = [
  { name: "ChatGPT", image: "/providers/chatgpt-logo.svg", tone: "light compact" },
  { name: "Gemini", image: "/providers/gemini-wordmark.svg", tone: "light" },
  { name: "DeepSeek", image: "/providers/deepseek-wordmark.svg", tone: "light" },
  { name: "Claude", image: "/providers/claude-wordmark.svg", tone: "light" },
  { name: "Meta AI", image: "/providers/meta-ai-wordmark.svg", tone: "light" },
  { name: "ChatGPT", image: "/providers/chatgpt-logo.svg", tone: "light compact" },
  { name: "Gemini", image: "/providers/gemini-wordmark.svg", tone: "light" },
  { name: "DeepSeek", image: "/providers/deepseek-wordmark.svg", tone: "light" },
  { name: "Claude", image: "/providers/claude-wordmark.svg", tone: "light" },
  { name: "Meta AI", image: "/providers/meta-ai-wordmark.svg", tone: "light" }
];

const revealDelay = (ms: number) => ({ "--reveal-delay": `${ms}ms` }) as CSSProperties;
const testimonialTrack = [...testimonials, ...testimonials];

export default function LandingPage({ skipAuthRedirect = false }: { skipAuthRedirect?: boolean }) {
  const [landingSettings, setLandingSettings] = useState<LandingSettings>({
    demo_video_url: "",
    demo_poster_url: "/dashboard-preview.png",
  });
  const [prices, setPrices] = useState<PriceItem[]>(fallbackPrices);
  const youtubeEmbedUrl = getYouTubeEmbedUrl(landingSettings.demo_video_url);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([loadLandingSettings(), loadServicePlans()])
      .then(([settingsResult, plansResult]) => {
        if (cancelled) return;
        if (settingsResult.status === "fulfilled") {
          setLandingSettings(settingsResult.value);
        } else {
          setLandingSettings({ demo_video_url: "", demo_poster_url: "/dashboard-preview.png" });
        }
        if (plansResult.status === "fulfilled" && plansResult.value.length) {
          setPrices(plansResult.value);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="landing">
      {skipAuthRedirect ? null : <AuthPublicRedirect />}
      <LandingReveal />
      <header className="landing-header">
        <div className="landing-header-container">
          <Link className="landing-brand" href="/">
            <img src="/logo-text.png" alt="TechMax" width={5669} height={1512} decoding="async" />
          </Link>
          <nav className="landing-nav">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#testimonials">Testimonials</a>
            <a href="#support">Support</a>
          </nav>
          <div className="landing-header-actions">
            <Link className="btn btn-secondary" href="/login">Login</Link>
            <Link className="btn btn-primary" href="/register">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="grid-overlay" data-parallax="-28" />
        <div className="hero-orbit one" data-parallax="34" />
        <div className="hero-orbit two" data-parallax="-42" />
        <div className="hero-orbit three" data-parallax="28" />
        <div className="landing-hero-inner">
          <div className="landing-badge hero-fade hero-fade-1"><span /> Thế hệ Support AI mới nhất 2026</div>
          <h1 className="hero-fade hero-fade-2">NỀN TẢNG THUÊ <span>AI BÁN HÀNG</span> TỰ ĐỘNG HÓA</h1>
          <p className="hero-fade hero-fade-3">
            TechMax giúp bạn tạo ra AI bán hàng tự động để chăm sóc khách hàng, gửi nội dung quảng bá đúng tệp và theo dõi hiệu quả theo thời gian thực.
          </p>
          <div className="landing-actions hero-fade hero-fade-4">
            <Link className="btn btn-primary" href="/register">Bắt đầu ngay</Link>
            <Link className="btn btn-secondary" href="#pricing">Nhận tư vấn</Link>
          </div>
          <div className="dashboard-preview hero-fade hero-fade-5" data-parallax="-26">
            <div className="preview-scanline" />
            {youtubeEmbedUrl ? (
              <iframe
                key={youtubeEmbedUrl}
                src={youtubeEmbedUrl}
                title="TECHMAX dashboard demo"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                key={landingSettings.demo_video_url || "landing-demo-empty"}
                src={landingSettings.demo_video_url || undefined}
                poster={landingSettings.demo_poster_url || "/dashboard-preview.png"}
                aria-label="TECHMAX dashboard demo"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
              />
            )}
          </div>
        </div>
      </section>

      <section className="marquee" data-reveal data-parallax="12">
        <div>
          {aiProviders.map((provider, i) => (
            <span className={`provider-logo provider-logo-${provider.tone}`} key={`${provider.name}-${i}`}>
              <img src={provider.image} alt={provider.name} />
            </span>
          ))}
        </div>
      </section>

      <section className="landing-section" id="features">
        <h2 data-reveal data-parallax="18">Khởi tạo AI bán hàng tự động chỉ trong vài phút</h2>
        <div className="red-line" data-reveal style={revealDelay(80)} />
        <div className="grid-3 landing-grid">
          {steps.map(([icon, title, text], index) => (
            <article className="card pad feature-card" data-reveal data-parallax={String(14 + index * 4)} style={revealDelay(index * 110)} key={title}>
              <div className="feature-icon"><Icon name={icon} /></div>
              <span>Bước {index + 1}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section dark-band" id="pricing">
        <h2 data-reveal data-parallax="18">Các gói thuê AI bán hàng tự động</h2>
        <p className="subtitle" data-reveal data-parallax="14" style={revealDelay(80)}>Tiết kiệm chi phí vận hành với các gói linh hoạt cho mọi quy mô kinh doanh.</p>
        <div className="grid-3 landing-grid">
          {prices.map(({ name, price, features, popular }) => (
            <article className={`card pad price-card no-reveal ${popular ? "popular" : ""}`} key={name}>
              {popular ? <div className="popular-badge">Phổ biến nhất</div> : null}
              <div className="price-card-head">
                <h3>{name}</h3>
                <div className="price">{price}<span>/tháng</span></div>
              </div>
              <div className="price-card-features">
                <ul>
                  {features.map(({ text, included }, idx) => (
                    <li key={idx} className={included ? "" : "excluded"}>
                      <Icon name={included ? "check_circle" : "minus"} size={18} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link className={`btn ${popular ? "btn-red" : "btn-secondary"}`} href="/register">Chọn gói</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section" id="testimonials">
        <h2 data-reveal data-parallax="18">Khách hàng nói gì về chúng tôi?</h2>
        <div className="testimonial-marquee" data-reveal data-parallax="14">
          <div className="testimonial-track">
            {testimonialTrack.map(([name, role, quote], index) => (
              <article className="card pad testimonial" key={`${name}-${index}`}>
                <div className="stars">★★★★★</div>
                <p>“{quote}”</p>
                <div className="row">
                  <div className="avatar-dot">{name.charAt(0)}</div>
                  <div><strong>{name}</strong><span>{role}</span></div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section dark-band" id="support">
        <h2 data-reveal data-parallax="18">Câu hỏi thường gặp</h2>
        <div className="grid-2 landing-grid faq-grid">
          {[
            ["Sử dụng bot có bị khóa tài khoản không?", "Không bị khóa tài khoản, TechMax mô phỏng hành vi người dùng thật và tuân thủ giới hạn an toàn của Zalo."],
            ["Có cần máy tính để chạy bot không?", "Không, hệ thống chạy trên cloud 24/7. Bạn chỉ cần thiết lập một lần trên web."],
            ["Đội ngũ đào tạo AI giúp tôi sẽ có bao nhiêu người?", "Đội ngũ hỗ trợ đào tạo AI gồm 3-5 người, tùy thuộc gói cước và độ uy tín của doanh nghiệp."],
            ["Bot AI có thể tự động kết nối xử lý các dữ liệu từ Server của tôi không?", "Có thể, TechMax hỗ trợ tự động kết nối xử lý các dữ liệu từ Server của bạn."]
          ].map(([q, a], index) => (
            <div className="faq-item" data-reveal data-parallax={String(10 + index * 3)} style={revealDelay(index * 80)} key={q}>
              <h3>{q}</h3>
              <p>{a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div>
          <h2 data-reveal data-parallax="18">Hãy dùng AI để việc bán hàng tối ưu hơn<br />Bắt đầu cùng TechMax.</h2>
          <p data-reveal data-parallax="14" style={revealDelay(100)}>Gia nhập cùng các chủ shop đang tự động hóa quy trình bán hàng bằng AI.</p>
          <div className="landing-actions" data-reveal data-parallax="10" style={revealDelay(180)}>
            <Link className="btn btn-primary" href="/register">Đăng ký ngay</Link>
            <Link className="btn btn-secondary" href="#pricing">Xem bảng giá</Link>
          </div>
        </div>
      </section>

      <CorporateFooter animate={false} />
    </main>
  );
}
