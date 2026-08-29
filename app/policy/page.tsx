"use client";

import Link from "next/link";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Shield, FileText, CreditCard, Search, ArrowLeft, Calendar, Clock, AlertTriangle, CheckCircle, Info } from "lucide-react";
import CorporateFooter from "../components/corporate-footer";

// Types
interface Article {
  id: string;
  title: string;
  content: string[];
  isImportant?: boolean;
}

interface Policy {
  id: string;
  title: string;
  lastUpdated: string;
  icon: any;
  articles: Article[];
}

// Full policy content structured as data
const policies: Policy[] = [
  {
    id: "terms",
    title: "Điều khoản & Điều kiện Sử dụng Dịch vụ TechMax AI",
    lastUpdated: "23/06/2026",
    icon: FileText,
    articles: [
      {
        id: "terms-1",
        title: "ĐIỀU 1. GIỚI THIỆU",
        content: [
          "TechMax là đơn vị cung cấp các giải pháp AI hỗ trợ doanh nghiệp tự động hóa hoạt động bán hàng, chăm sóc khách hàng và vận hành kinh doanh trên các nền tảng trực tuyến.",
          "Bằng việc truy cập, đăng ký, thanh toán hoặc sử dụng bất kỳ dịch vụ nào của TechMax, khách hàng xác nhận đã đọc, hiểu và đồng ý tuân thủ toàn bộ các điều khoản và chính sách được công bố trên website."
        ]
      },
      {
        id: "terms-2",
        title: "ĐIỀU 2. PHẠM VI DỊCH VỤ",
        content: [
          "TechMax cung cấp các dịch vụ bao gồm nhưng không giới hạn:",
          "• AI hỗ trợ bán hàng tự động.",
          "• AI hỗ trợ chăm sóc khách hàng.",
          "• AI hỗ trợ trả lời Messenger.",
          "• AI hỗ trợ Fanpage Facebook.",
          "• AI hỗ trợ Website.",
          "• AI hỗ trợ xử lý dữ liệu.",
          "• AI hỗ trợ tra cứu đơn hàng.",
          "• AI hỗ trợ kiểm tra trạng thái thanh toán.",
          "• AI tích hợp API doanh nghiệp.",
          "• AI đào tạo theo dữ liệu riêng của khách hàng.",
          "• Dashboard quản lý và giám sát hoạt động AI.",
          "TechMax có quyền nâng cấp, thay đổi hoặc bổ sung tính năng nhằm nâng cao chất lượng dịch vụ mà không cần thông báo trước trong trường hợp không ảnh hưởng nghiêm trọng đến quyền lợi khách hàng."
        ]
      },
      {
        id: "terms-3",
        title: "ĐIỀU 3. ĐĂNG KÝ TÀI KHOẢN",
        content: [
          "Khách hàng cam kết: Cung cấp thông tin chính xác; Không sử dụng danh tính giả mạo; Chịu trách nhiệm đối với thông tin đã cung cấp.",
          "Khách hàng chịu trách nhiệm bảo mật: Tài khoản; Mật khẩu; API Key; Access Token; Các thông tin truy cập hệ thống.",
          "Mọi hoạt động phát sinh từ tài khoản khách hàng được xem là do khách hàng thực hiện."
        ]
      },
      {
        id: "terms-4",
        title: "ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA KHÁCH HÀNG",
        content: [
          "Khách hàng có quyền: Sử dụng dịch vụ theo đúng gói đã đăng ký; Được hỗ trợ kỹ thuật theo phạm vi dịch vụ; Được bảo mật thông tin theo chính sách bảo mật.",
          "Khách hàng có nghĩa vụ: Thanh toán đầy đủ và đúng hạn; Cung cấp dữ liệu hợp pháp; Không sử dụng dịch vụ để vi phạm pháp luật; Không sử dụng dịch vụ để phát tán spam hoặc nội dung độc hại; Không sử dụng dịch vụ để lừa đảo hoặc chiếm đoạt tài sản."
        ]
      },
      {
        id: "terms-5",
        title: "ĐIỀU 5. QUYỀN VÀ NGHĨA VỤ CỦA TECHMAX",
        content: [
          "TechMax có quyền: Tạm ngừng hoặc chấm dứt dịch vụ đối với các tài khoản vi phạm; Từ chối xử lý các yêu cầu trái pháp luật; Điều chỉnh hạ tầng kỹ thuật để đảm bảo an toàn hệ thống.",
          "TechMax có nghĩa vụ: Cung cấp dịch vụ theo đúng cam kết; Bảo mật thông tin khách hàng; Hỗ trợ kỹ thuật trong phạm vi gói dịch vụ."
        ]
      },
      {
        id: "terms-6",
        title: "ĐIỀU 6. SỞ HỮU TRÍ TUỆ",
        isImportant: true,
        content: [
          "Toàn bộ: Mã nguồn, thiết kế giao diện, workflow, prompt hệ thống, tài liệu kỹ thuật, thuật toán và hệ thống vận hành đều thuộc quyền sở hữu độc quyền của TechMax.",
          "Khách hàng không được: Sao chép, chuyển nhượng, bán lại, khai thác trái phép, reverse engineering hoặc trích xuất mã nguồn nếu chưa có sự đồng ý bằng văn bản từ TechMax."
        ]
      },
      {
        id: "terms-7",
        title: "ĐIỀU 7. CHẤM DỨT DỊCH VỤ",
        content: [
          "TechMax có quyền tạm ngừng hoặc chấm dứt dịch vụ nếu: Khách hàng vi phạm điều khoản sử dụng; Khách hàng vi phạm pháp luật; Khách hàng chậm thanh toán; Khách hàng gây ảnh hưởng tiêu cực đến an toàn và hiệu suất hệ thống."
        ]
      },
      {
        id: "terms-8",
        title: "ĐIỀU 8. LUẬT ÁP DỤNG",
        content: [
          "Mọi tranh chấp phát sinh sẽ được giải quyết theo quy định của pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.",
          "Tòa án có thẩm quyền tại Việt Nam là cơ quan giải quyết cuối cùng đối với các tranh chấp phát sinh liên quan đến dịch vụ của TechMax."
        ]
      }
    ]
  },
  {
    id: "privacy",
    title: "Chính sách Bảo mật & Xử lý Dữ liệu",
    lastUpdated: "23/06/2026",
    icon: Shield,
    articles: [
      {
        id: "privacy-1",
        title: "ĐIỀU 1. THÔNG TIN THU THẬP",
        content: [
          "TechMax có thể thu thập các thông tin sau khi khách hàng sử dụng dịch vụ:",
          "• Họ tên, Số điện thoại, Email, Địa chỉ liên hệ.",
          "• Thông tin doanh nghiệp, nhật ký truy cập (logs), thông tin thiết bị, địa chỉ IP.",
          "• Dữ liệu hội thoại, nội dung trò chuyện, dữ liệu khách hàng được tải lên hệ thống để đào tạo AI."
        ]
      },
      {
        id: "privacy-2",
        title: "ĐIỀU 2. MỤC ĐÍCH THU THẬP THÔNG TIN",
        content: [
          "Thông tin của khách hàng được sử dụng cho các mục đích hợp pháp bao gồm:",
          "• Cung cấp, vận hành và tối ưu hóa dịch vụ AI.",
          "• Hỗ trợ kỹ thuật, xử lý thanh toán và đối soát hóa đơn.",
          "• Nâng cao chất lượng hệ thống thông qua việc tối ưu mô hình học máy.",
          "• Đảm bảo an toàn, bảo mật thông tin và ngăn ngừa gian lận.",
          "• Liên hệ, thông báo và hỗ trợ khách hàng kịp thời."
        ]
      },
      {
        id: "privacy-3",
        title: "ĐIỀU 3. CAM KẾT BẢO MẬT DỮ LIỆU",
        isImportant: true,
        content: [
          "TechMax cam kết tuyệt đối bảo mật thông tin khách hàng theo các nguyên tắc sau:",
          "• KHÔNG bán dữ liệu khách hàng dưới bất kỳ hình thức nào.",
          "• KHÔNG chia sẻ dữ liệu khách hàng cho bên thứ ba trái phép.",
          "• KHÔNG sử dụng dữ liệu khách hàng ngoài mục đích cung cấp và cải tiến chất lượng dịch vụ."
        ]
      },
      {
        id: "privacy-4",
        title: "ĐIỀU 4. CHIA SẺ THÔNG TIN",
        content: [
          "Thông tin khách hàng chỉ được chia sẻ trong các trường hợp đặc biệt sau:",
          "• Khi có sự đồng ý hoặc xác nhận bằng văn bản/email từ khách hàng.",
          "• Khi có yêu cầu cung cấp thông tin chính thức từ cơ quan nhà nước có thẩm quyền theo quy định pháp luật Việt Nam.",
          "• Cần thiết để cung cấp dịch vụ thông qua các đối tác hạ tầng thiết yếu (ví dụ: Cổng thanh toán, nhà cung cấp Cloud được cam kết bảo mật tương đương)."
        ]
      },
      {
        id: "privacy-5",
        title: "ĐIỀU 5. THỜI GIAN LƯU TRỮ DỮ LIỆU",
        content: [
          "Thông tin được lưu trữ trong suốt thời gian khách hàng sử dụng dịch vụ tại hệ thống TechMax.",
          "Sau khi chấm dứt dịch vụ: Dữ liệu của khách hàng có thể được lưu trữ dự phòng tối đa 30 ngày. Sau thời gian này, toàn bộ dữ liệu (bao gồm cả dữ liệu huấn luyện AI) sẽ bị xóa vĩnh viễn khỏi hệ thống chính thức của TechMax."
        ]
      },
      {
        id: "privacy-6",
        title: "ĐIỀU 6. COOKIE VÀ CÔNG NGHỆ THEO DÕI",
        content: [
          "Website TechMax sử dụng Cookie nhằm: Duy trì trạng thái đăng nhập; Ghi nhớ tùy chọn cá nhân của người dùng; Phân tích hiệu suất website; Nâng cao trải nghiệm sử dụng.",
          "Khách hàng hoàn toàn có thể chủ động từ chối hoặc cấu hình lại việc sử dụng Cookie thông qua cài đặt trên trình duyệt cá nhân của mình."
        ]
      },
      {
        id: "privacy-7",
        title: "ĐIỀU 7. QUYỀN CỦA KHÁCH HÀNG ĐỐI VỚI DỮ LIỆU",
        content: [
          "Khách hàng có toàn quyền thực hiện các yêu cầu sau theo quy định pháp luật:",
          "• Xem, kiểm tra dữ liệu cá nhân đang được lưu trữ.",
          "• Yêu cầu chỉnh sửa, cập nhật thông tin không chính xác.",
          "• Yêu cầu xóa dữ liệu hoặc ngừng xử lý dữ liệu khi không còn nhu cầu sử dụng dịch vụ."
        ]
      },
      {
        id: "privacy-8",
        title: "ĐIỀU 8. TRÁCH NHIỆM BẢO MẬT TÀI KHOẢN",
        content: [
          "Khách hàng chịu trách nhiệm tự bảo mật thông tin đăng nhập của mình, bao gồm: Mật khẩu, API Key, Access Token, Thông tin truy cập hệ thống.",
          "TechMax được miễn trừ mọi trách nhiệm đối với các thiệt hại, rò rỉ thông tin phát sinh từ việc khách hàng để lộ thông tin truy cập ra bên ngoài."
        ]
      }
    ]
  },
  {
    id: "payment",
    title: "Chính sách Thanh toán - Hoàn tiền - Hỗ trợ kỹ thuật & Miễn trừ trách nhiệm AI",
    lastUpdated: "23/06/2026",
    icon: CreditCard,
    articles: [
      {
        id: "payment-1",
        title: "ĐIỀU 1. THANH TOÁN DỊCH VỤ",
        content: [
          "Khách hàng có thể lựa chọn chu kỳ thanh toán linh hoạt theo: Tháng, Quý, Năm.",
          "Dịch vụ AI và các tính năng tương ứng chỉ được hệ thống kích hoạt tự động sau khi giao dịch thanh toán thành công."
        ]
      },
      {
        id: "payment-2",
        title: "ĐIỀU 2. GIA HẠN DỊCH VỤ",
        content: [
          "Khách hàng có trách nhiệm chủ động theo dõi thời hạn gói cước và thực hiện gia hạn trước ngày hết hạn.",
          "TechMax không chịu trách nhiệm đối với các gián đoạn dịch vụ, mất kết nối Zalo/Facebook hoặc gián đoạn chatbot phát sinh do khách hàng không thực hiện gia hạn đúng hạn."
        ]
      },
      {
        id: "payment-3",
        title: "ĐIỀU 3. CHÍNH SÁCH HOÀN TIỀN",
        isImportant: true,
        content: [
          "Do đặc thù của dịch vụ kỹ thuật số (sử dụng tài nguyên cloud, API của bên thứ ba và tài nguyên xử lý dữ liệu ngay sau khi kích hoạt), TechMax KHÔNG hoàn lại phí dịch vụ đối với các trường hợp:",
          "• Dịch vụ đã được kích hoạt trên hệ thống.",
          "• Hệ thống AI đã được bàn giao và hoạt động.",
          "• AI đã được đào tạo hoặc tùy chỉnh dựa trên dữ liệu riêng của khách hàng.",
          "• Khách hàng thay đổi nhu cầu hoặc không còn nhu cầu sử dụng dịch vụ.",
          "Các trường hợp đặc biệt (như lỗi kỹ thuật kéo dài từ phía TechMax mà không thể khắc phục được) sẽ được ban quản trị xem xét và giải quyết theo từng trường hợp cụ thể."
        ]
      },
      {
        id: "payment-4",
        title: "ĐIỀU 4. HỖ TRỢ KỸ THUẬT",
        content: [
          "TechMax hỗ trợ khách hàng thông qua các kênh chính thức sau: Gửi Ticket hỗ trợ trực tiếp trên hệ thống; Gửi Email đến support@techmax.vn; Liên hệ Hotline; Chat qua Fanpage chính thức.",
          "Thời gian phản hồi cam kết (SLA):",
          "• Lỗi nghiêm trọng (Hệ thống sập, ngắt kết nối hoàn toàn): Hỗ trợ tối đa trong 24 giờ.",
          "• Lỗi thông thường (Tính năng chậm, lỗi giao diện nhỏ): Phản hồi tối đa trong 72 giờ.",
          "• Yêu cầu nâng cấp, tích hợp riêng: Xử lý theo lịch trình và thỏa thuận triển khai riêng."
        ]
      },
      {
        id: "payment-5",
        title: "ĐIỀU 5. CHÍNH SÁCH SỬ DỤNG CHẤP NHẬN ĐƯỢC",
        content: [
          "Khách hàng nghiêm cấm sử dụng dịch vụ AI của TechMax để:",
          "• Thực hiện hành vi lừa đảo, giả mạo tổ chức hoặc cá nhân khác.",
          "• Phát tán tin nhắn rác (spam), thông tin sai sự thật hoặc mã độc.",
          "• Tấn công hệ thống mạng, khai thác lỗ hổng bảo mật.",
          "• Kinh doanh, quảng cáo các sản phẩm, hàng hóa và dịch vụ bị pháp luật Việt Nam cấm.",
          "TechMax có toàn quyền khóa tài khoản vĩnh viễn mà không hoàn tiền đối với các trường hợp vi phạm chính sách này."
        ]
      },
      {
        id: "payment-6",
        title: "ĐIỀU 6. MIỄN TRỪ TRÁCH NHIỆM AI",
        isImportant: true,
        content: [
          "Mô hình Trí tuệ nhân tạo (AI) là công cụ hỗ trợ tự động hóa dựa trên dữ liệu huấn luyện. TechMax KHÔNG cam kết:",
          "• AI luôn đưa ra thông tin chính xác 100%.",
          "• AI luôn hiểu đúng 100% ngữ cảnh đàm thoại phức tạp.",
          "• AI luôn đưa ra các quyết định hoặc phương án tư vấn tối ưu nhất.",
          "Khách hàng có trách nhiệm tự kiểm tra, cấu hình bộ lọc dữ liệu huấn luyện và trực tiếp rà soát các nội dung quan trọng liên quan đến: Thông tin thanh toán, Số tài khoản chuyển khoản, Báo giá chính thức, Thỏa thuận hợp đồng và Chính sách bán hàng cốt lõi."
        ]
      },
      {
        id: "payment-7",
        title: "ĐIỀU 7. GIỚI HẠN TRÁCH NHIỆM PHÁP LÝ",
        content: [
          "TechMax không chịu trách nhiệm bồi thường đối với các thiệt hại gián tiếp, mất doanh thu, mất lợi nhuận, mất cơ hội kinh doanh, sai sót dữ liệu do khách hàng cung cấp, hoặc các sự cố phát sinh từ bên thứ ba.",
          "Trong mọi trường hợp phát sinh trách nhiệm bồi thường thiệt hại, tổng giá trị trách nhiệm bồi thường của TechMax sẽ không vượt quá tổng giá trị phí dịch vụ mà khách hàng đã thực tế thanh toán cho TechMax trong vòng ba (03) tháng gần nhất kể từ thời điểm phát sinh sự cố."
        ]
      },
      {
        id: "payment-8",
        title: "ĐIỀU 8. TRƯỜNG HỢP BẤT KHẢ KHÁNG",
        content: [
          "TechMax được miễn trừ mọi trách nhiệm do gián đoạn dịch vụ xuất phát từ các sự kiện bất khả kháng bao gồm: Thiên tai, hỏa hoạn, chiến tranh, mất điện diện rộng, sự cố đường truyền Internet quốc gia.",
          "Hoặc các sự cố gián đoạn API hệ thống từ các nhà cung cấp bên thứ ba ngoài khả năng kiểm soát của TechMax như: Facebook, Messenger, Zalo, OpenAI, Google, Anthropic, hệ thống ngân hàng hoặc cổng thanh toán trực tuyến."
        ]
      }
    ]
  }
];

function PolicyPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("terms");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [scrolledArticleId, setScrolledArticleId] = useState<string>("");
  const contentRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Sync tab from URL search parameters if available
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["terms", "privacy", "payment"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Update URL search parameters when tab changes without full reload
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/policy?tab=${tabId}`, { scroll: false });
    // Scroll content container back to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Filter content based on search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();

    return policies.map(policy => {
      const matchingArticles = policy.articles.filter(article => {
        const titleMatch = article.title.toLowerCase().includes(query);
        const contentMatch = article.content.some(p => p.toLowerCase().includes(query));
        return titleMatch || contentMatch;
      });

      return {
        ...policy,
        articles: matchingArticles
      };
    }).filter(policy => policy.articles.length > 0);
  }, [searchQuery]);

  // Highlight search text helper
  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i} className="search-highlight">{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const scrollToArticle = (articleId: string) => {
    const element = contentRefs.current[articleId];
    if (element) {
      const yOffset = -24;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setScrolledArticleId(articleId);
      setTimeout(() => setScrolledArticleId(""), 2000);
    }
  };

  const activePolicy = useMemo(() => {
    return policies.find(p => p.id === activeTab) || policies[0];
  }, [activeTab]);

  return (
    <div className="landing reveal-ready" style={{ background: "var(--bg)", minHeight: "100vh" }}>
      {/* Premium background effects */}
      <div className="grid-overlay" style={{ opacity: 0.15, pointerEvents: "none" }} />
      <div className="hero-orbit one" style={{ opacity: 0.05, top: "20%", left: "10%" }} />
      <div className="hero-orbit two" style={{ opacity: 0.05, top: "60%", right: "10%" }} />

      <header className="landing-header">
        <div className="landing-header-container">
          <Link className="landing-brand" href="/">
            <img src="/logo-text.png" alt="TechMax" width={5669} height={1512} decoding="async" />
          </Link>
          <nav className="landing-nav">
            <Link href="/#features">Features</Link>
            <Link href="/#pricing">Pricing</Link>
            <Link href="/#testimonials">Testimonials</Link>
            <Link href="/#support">Support</Link>
          </nav>
          <div className="landing-header-actions">
            <Link className="btn btn-secondary" href="/login">Login</Link>
            <Link className="btn btn-primary" href="/register">Get Started</Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <div className="policy-hero" style={{ padding: "32px 24px 36px", textAlign: "center", borderBottom: "1px solid var(--border)", position: "relative" }}>
        <div className="landing-badge" style={{ margin: "0 auto 16px" }}>
          <Shield size={14} style={{ color: "var(--red)" }} /> TRUNG TÂM PHÁP LÝ & CHÍNH SÁCH
        </div>
        <h1 style={{ fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 900, color: "var(--primary)", margin: "0 0 16px" }}>
          Chính sách & Điều khoản Dịch vụ
        </h1>
        <p className="subtitle" style={{ maxWidth: 640, margin: "0 auto", color: "var(--muted)" }}>
          Tìm hiểu các cam kết pháp lý, chính sách bảo vệ quyền lợi người dùng và các điều kiện kỹ thuật khi vận hành hệ thống TechMax AI.
        </p>

        {/* Global Policy Search Bar */}
        <div className="policy-search-wrap" style={{ maxWidth: 540, margin: "32px auto 0", position: "relative" }}>
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--dim)" }}>
            <Search size={18} />
          </span>
          <input
            type="text"
            className="input"
            placeholder="Tìm kiếm nhanh điều khoản (ví dụ: hoàn tiền, bảo mật, AI...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 48, background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid var(--border)", color: "var(--primary)" }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, color: "var(--dim)", fontSize: 13, fontWeight: "bold" }}
            >
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="policy-container" style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 24px 80px" }}>
        {searchQuery.trim() ? (
          /* Search Results View */
          <div className="search-results-section">
            <div className="between" style={{ marginBottom: 24 }}>
              <button className="btn btn-secondary" onClick={() => setSearchQuery("")} style={{ borderRadius: 8 }}>
                <ArrowLeft size={16} /> Quay lại điều khoản chính
              </button>
              <span className="muted" style={{ fontSize: 14 }}>
                Tìm thấy <strong>{searchResults.reduce((acc, curr) => acc + curr.articles.length, 0)}</strong> kết quả khớp từ khóa "{searchQuery}"
              </span>
            </div>

            {searchResults.length > 0 ? (
              <div className="stack" style={{ gap: 24 }}>
                {searchResults.map((policy) => (
                  <div className="card pad" style={{ border: "1px solid var(--border)", background: "var(--card)" }} key={policy.id}>
                    <div className="row" style={{ color: "var(--red)", marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 12 }}>
                      <policy.icon size={20} />
                      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{policy.title}</h3>
                    </div>

                    <div className="stack" style={{ gap: 20 }}>
                      {policy.articles.map((article) => (
                        <div key={article.id} className="search-result-item" style={{ padding: 16, borderRadius: 8, background: "rgba(255,255,255,0.015)", borderLeft: article.isImportant ? "3px solid var(--red)" : "3px solid var(--border)" }}>
                          <h4 style={{ margin: "0 0 10px", color: "var(--primary)", fontSize: 15, fontWeight: 800 }}>{highlightText(article.title, searchQuery)}</h4>
                          {article.content.map((paragraph, index) => (
                            <p key={index} style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.6, margin: "6px 0" }}>
                              {highlightText(paragraph, searchQuery)}
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="card pad" style={{ textAlign: "center", padding: "60px 24px" }}>
                <Info size={40} style={{ color: "var(--dim)", marginBottom: 16 }} />
                <h3 style={{ margin: 0, color: "var(--primary)" }}>Không tìm thấy điều khoản phù hợp</h3>
                <p className="muted" style={{ maxWidth: 420, margin: "8px auto 0" }}>
                  Hãy thử tìm kiếm với các từ khóa ngắn gọn hơn như: "hoàn tiền", "bảo mật", "dữ liệu", "tài khoản", "zalo".
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Standard Documents View */
          <div className="policy-main-grid" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 40 }}>
            
            {/* Desktop Navigation Sidebar */}
            <aside className="policy-sidebar" style={{ position: "sticky", top: 100, height: "fit-content" }}>
              {/* Document Switcher */}
              <div className="policy-tab-group" style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
                {policies.map((p) => {
                  const IconComponent = p.icon;
                  const isActive = p.id === activeTab;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleTabChange(p.id)}
                      className={`policy-tab-btn ${isActive ? "active" : ""}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        borderRadius: "10px",
                        border: isActive ? "1px solid rgba(224, 36, 36, 0.3)" : "1px solid transparent",
                        background: isActive ? "rgba(224, 36, 36, 0.08)" : "transparent",
                        color: isActive ? "var(--primary)" : "var(--dim)",
                        textAlign: "left",
                        fontSize: 14,
                        fontWeight: isActive ? 800 : 600,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <IconComponent size={18} style={{ flexShrink: 0, color: isActive ? "var(--red)" : "inherit" }} />
                      <span className="tab-label">{p.id === "terms" ? "Điều khoản sử dụng" : p.id === "privacy" ? "Chính sách bảo mật" : "Thanh toán & Hoàn tiền"}</span>
                    </button>
                  );
                })}
              </div>

              {/* Table of Contents for Current Document */}
              <div className="policy-toc" style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.3)", display: "block", marginBottom: 12 }}>
                  Mục lục bài viết
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {activePolicy.articles.map((art) => (
                    <button
                      key={art.id}
                      onClick={() => scrollToArticle(art.id)}
                      className="toc-link"
                      style={{
                        border: 0,
                        background: "none",
                        color: "var(--dim)",
                        fontSize: 13,
                        textAlign: "left",
                        padding: "6px 8px",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        transition: "all 0.16s ease"
                      }}
                    >
                      {art.title.replace("ĐIỀU ", "Điều ")}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* Document Content Display */}
            <main className="policy-content" style={{ minWidth: 0 }}>
              {/* Tab Navigation for Mobile Devices */}
              <div className="policy-mobile-tabs" style={{ display: "none", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
                {policies.map((p) => {
                  const isActive = p.id === activeTab;
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleTabChange(p.id)}
                      style={{
                        whiteSpace: "nowrap",
                        padding: "8px 16px",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: isActive ? 800 : 600,
                        border: isActive ? "1px solid var(--red)" : "1px solid var(--border)",
                        background: isActive ? "rgba(224,36,36,0.12)" : "rgba(255,255,255,0.02)",
                        color: isActive ? "var(--primary)" : "var(--muted)",
                        transition: "all 0.2s"
                      }}
                    >
                      {p.id === "terms" ? "Điều khoản" : p.id === "privacy" ? "Bảo mật" : "Thanh toán/Hoàn tiền"}
                    </button>
                  );
                })}
              </div>

              {/* Document Header Metadata */}
              <div className="card pad" style={{ border: "1px solid var(--border)", background: "var(--card)", padding: 32, borderRadius: 16, marginBottom: 32 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", marginBottom: 20 }}>
                  <span className="chip" style={{ background: "rgba(255, 255, 255, 0.04)" }}>
                    <Calendar size={14} style={{ marginRight: 6 }} /> Cập nhật: {activePolicy.lastUpdated}
                  </span>
                  <span className="chip" style={{ background: "rgba(255, 255, 255, 0.04)" }}>
                    <Clock size={14} style={{ marginRight: 6 }} /> Thời gian đọc: 6 phút
                  </span>
                </div>

                <h2 style={{ fontSize: "clamp(22px, 3vw, 28px)", fontWeight: 900, color: "var(--primary)", margin: "0 0 16px" }}>
                  {activePolicy.title}
                </h2>
                
                <p className="muted" style={{ fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                  {activePolicy.id === "terms" 
                    ? "Tài liệu này quy định các điều kiện pháp lý ràng buộc giữa khách hàng và TechMax AI khi truy cập hoặc sử dụng phần mềm, API và các giải pháp đi kèm. Vui lòng đọc kỹ các điều khoản này." 
                    : activePolicy.id === "privacy"
                    ? "Chúng tôi tôn trọng quyền riêng tư của bạn. Chính sách này mô tả chi tiết cách thức chúng tôi thu thập, xử lý, bảo mật và lưu trữ dữ liệu hội thoại cũng như thông tin huấn luyện AI."
                    : "Chính sách quy định quy trình thanh toán gói cước, điều kiện gia hạn, các trường hợp được xem xét hoàn tiền đặc biệt, SLA hỗ trợ kỹ thuật và phạm vi miễn trừ trách nhiệm về chất lượng câu trả lời của AI."
                  }
                </p>
              </div>

              {/* Document Articles List */}
              <div className="stack" style={{ gap: 24 }}>
                {activePolicy.articles.map((article) => (
                  <div
                    key={article.id}
                    ref={(el) => { contentRefs.current[article.id] = el; }}
                    className={`policy-article-card card pad ${scrolledArticleId === article.id ? "highlighted-scroll" : ""} ${article.isImportant ? "important-policy" : ""}`}
                    style={{
                      border: article.isImportant ? "1px solid rgba(224, 36, 36, 0.3)" : "1px solid var(--border)",
                      background: article.isImportant 
                        ? "linear-gradient(135deg, rgba(224, 36, 36, 0.03) 0%, rgba(20, 20, 20, 0.98) 100%)" 
                        : "var(--card)",
                      padding: 28,
                      borderRadius: 12,
                      transition: "all 0.4s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
                      {article.isImportant && (
                        <span style={{ color: "var(--red)", marginTop: 4 }}>
                          <AlertTriangle size={18} />
                        </span>
                      )}
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--primary)", letterSpacing: "0.02em" }}>
                        {article.title}
                      </h3>
                      {article.isImportant && (
                        <span className="chip" style={{ background: "rgba(224, 36, 36, 0.12)", color: "var(--red)", border: "1px solid rgba(224, 36, 36, 0.2)", fontSize: 10, padding: "2px 8px" }}>
                          ĐIỀU KHOẢN QUAN TRỌNG
                        </span>
                      )}
                    </div>

                    <div className="stack" style={{ gap: 12 }}>
                      {article.content.map((paragraph, index) => {
                        const isBullet = paragraph.trim().startsWith("•");
                        return (
                          <p
                            key={index}
                            style={{
                              color: isBullet ? "var(--text)" : "var(--muted)",
                              fontSize: 14.5,
                              lineHeight: 1.7,
                              margin: 0,
                              paddingLeft: isBullet ? 12 : 0,
                              fontWeight: isBullet ? 500 : 400
                            }}
                          >
                            {paragraph}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </main>
          </div>
        )}
      </div>

      <CorporateFooter />
    </div>
  );
}

export default function PolicyPage() {
  return (
    <Suspense fallback={
      <div className="app-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div style={{ color: "var(--muted)", fontSize: 14 }}>Đang tải chính sách...</div>
      </div>
    }>
      <PolicyPageContent />
    </Suspense>
  );
}
