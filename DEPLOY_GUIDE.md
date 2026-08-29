# Hướng Dẫn Deploy Dự Án TechMax lên VPS Windows Production (Sử dụng Cloudflare Tunnel)

Tài liệu này hướng dẫn chi tiết cách cài đặt, cấu hình và chạy dự án **TechMax** (Next.js Frontend và Node.js API Backend) trên môi trường **VPS Windows Server** (2019, 2022, v.v.) kết hợp với **Cloudflare Tunnel** để chạy production ổn định mà không cần cài đặt Nginx hay Certbot.

---

## 1. Yêu Cầu Chuẩn Bị & Các Công Cụ Cần Tải
Trước khi bắt đầu, hãy tải sẵn các bộ cài đặt sau về VPS Windows của bạn:
1.  **Node.js LTS (v20 hoặc v18)**: Tải file cài đặt `.msi` từ [nodejs.org](https://nodejs.org/).
2.  **Git cho Windows**: Tải file `.exe` từ [git-scm.com](https://git-scm.com/) để tải source code (nếu cần).
3.  **Database (MySQL/MariaDB)**: Có 2 lựa chọn:
    *   *Cách 1 (Khuyên dùng cho Windows):* Cài đặt **Laragon** hoặc **XAMPP** để có sẵn MySQL và giao diện đồ họa quản lý (phpMyAdmin, database).
    *   *Cách 2:* Cài đặt **MySQL Community Server Installer** chính chủ từ trang web của MySQL.

---

## 2. Các Bước Thực Hiện Chi Tiết

### Bước 1: Cài đặt Node.js, Git & Database
1.  Chạy file cài đặt **Node.js (.msi)** và **Git (.exe)**. Nhấn *Next* liên tục cho đến khi hoàn thành.
2.  Cài đặt **Laragon** hoặc **XAMPP**:
    *   Nếu dùng **Laragon** (Khuyên dùng vì nhẹ và tối ưu hơn): Mở Laragon -> Nhấn **Start All** để khởi chạy MySQL.
    *   Nếu dùng **XAMPP**: Mở XAMPP Control Panel -> Nhấn **Start** ở dòng **MySQL**.
3.  Truy cập vào phpMyAdmin (thường là `http://localhost/phpmyadmin` hoặc qua giao diện Database của Laragon) để tạo cơ sở dữ liệu:
    *   Tên cơ sở dữ liệu: `techmax_app`
    *   Bảng mã (Collation): `utf8mb4_vietnamese_ci`
    *   *Lưu ý:* Backend khi chạy lần đầu tiên sẽ tự động khởi tạo cấu trúc bảng (`ensureSchema()`), bạn không nhất thiết phải tự import file SQL.

---

### Bước 2: Cấu hình tệp tin môi trường `.env`
1.  Di chuyển vào thư mục code dự án trên VPS (Ví dụ: `C:\projects\techmax`).
2.  Tạo tệp tin `.env` (hoặc `.env.local`) tại thư mục gốc và điền các cấu hình production sau:
    ```env
    # API Configuration
    API_PORT=4000
    PUBLIC_API_BASE_URL=https://api.domain-cua-ban.com/api
    NEXT_PUBLIC_API_BASE_URL=https://api.domain-cua-ban.com/api

    # Database Configuration (Cấu hình theo MySQL của Laragon/XAMPP)
    DB_HOST=localhost
    DB_USER=root
    DB_PASS=
    DB_NAME=techmax_app

    # Zalo API / MultiZlogin Integration (nếu có)
    MULTIZLOGIN_API_BASE_URL=http://localhost:3001/api
    MULTIZLOGIN_API_KEY=your_key_here
    ```

---

### Bước 3: Cài đặt thư viện Node và Biên dịch Frontend (Build)
1.  Mở công cụ **PowerShell** hoặc **Command Prompt** dưới quyền Quản trị viên (**Run as Administrator**).
2.  Di chuyển đến thư mục dự án:
    ```powershell
    cd C:\projects\techmax
    ```
3.  Cài đặt thư viện và build dự án:
    ```powershell
    npm install
    npm run build
    ```

---

### Bước 4: Chạy ứng dụng bằng PM2 dạng Windows Service

Để ứng dụng tự động khởi chạy ngầm và tự bật lên khi Windows Server khởi động lại, chúng ta sử dụng PM2 cùng công cụ tích hợp Service của Windows.

1.  Trong cửa sổ PowerShell (Admin), cài đặt PM2 toàn cục:
    ```powershell
    npm install -g pm2
    ```
2.  Cài đặt công cụ giúp PM2 đăng ký làm Windows Service:
    ```powershell
    npm install -g pm2-windows-startup
    ```
3.  Đăng ký service khởi động cùng Windows:
    ```powershell
    pm2-startup install
    ```
4.  Khởi chạy các tiến trình của TechMax (sử dụng tệp tin cấu hình `ecosystem.config.cjs` đã có sẵn):
    ```powershell
    pm2 start ecosystem.config.cjs
    ```
5.  Lưu lại cấu hình tiến trình đang chạy của PM2 để nó tự khôi phục sau này:
    ```powershell
    pm2 save
    ```

---

### Bước 5: Cấu hình Cloudflare Tunnel trên Windows VPS

Cloudflare Tunnel sẽ định tuyến trực tiếp các yêu cầu từ internet vào các cổng `3000` (Next.js Frontend) và `4000` (Node.js API) trên VPS mà không cần mở cổng trên modem/firewall hay cấu hình Nginx.

#### 1. Cấu hình trên Dashboard Cloudflare Zero Trust:
1.  Truy cập trang quản trị Cloudflare -> Vào mục **Zero Trust** ở menu bên trái.
2.  Vào **Networks** -> **Tunnels** -> Nhấn **Create a Tunnel**.
3.  Đặt tên Tunnel (ví dụ: `techmax-windows-vps`) -> Nhấn **Save tunnel**.
4.  Tại trang cài đặt môi trường, chọn hệ điều hành **Windows**.
5.  Chọn phiên bản phù hợp với VPS của bạn (thường là **64-bit**) và nhấn vào link để tải file bộ cài đặt `.msi` (hoặc tải trực tiếp từ link Cloudflare cung cấp).

#### 2. Cài đặt và kích hoạt trên Windows VPS:
1.  Chạy file `.msi` của Cloudflare vừa tải về VPS để cài đặt dịch vụ `cloudflared`.
2.  Quay lại trang Cloudflare Zero Trust, copy dòng lệnh đăng ký service dưới phần **Choose your architecture** (dòng lệnh chứa Token dài). Lệnh có dạng:
    ```powershell
    cloudflared.exe service install eyJhIjoi... (Token của bạn)
    ```
3.  Mở **PowerShell (Admin)** trên VPS và dán lệnh đó vào rồi nhấn Enter.
4.  Kiểm tra trên trang Cloudflare thấy trạng thái Tunnel chuyển sang màu xanh **Active** là thành công.

#### 3. Định tuyến tên miền (Public Hostnames):
Chuyển qua tab **Public Hostnames** trong cài đặt Tunnel để định tuyến dịch vụ:

*   **Định tuyến cho Frontend (Next.js):**
    *   **Subdomain:** (Để trống hoặc điền `www` tùy nhu cầu)
    *   **Domain:** Chọn tên miền của bạn (ví dụ: `domain-cua-ban.com`).
    *   **Type:** `HTTP`
    *   **URL:** `localhost:3000`
    *   Nhấn **Save hostname**.

*   **Định tuyến cho Backend API (Node Express):**
    *   Nhấn **Add a public hostname**.
    *   **Subdomain:** `api`
    *   **Domain:** Chọn tên miền của bạn (để có `api.domain-cua-ban.com`).
    *   **Type:** `HTTP`
    *   **URL:** `localhost:4000`
    *   Nhấn **Save hostname**.

*Sau khi cấu hình, Cloudflare sẽ tự động cập nhật bản ghi DNS và kích hoạt chứng chỉ SSL (HTTPS) cho cả 2 địa chỉ trên.*

---

## 3. Cấu hình Tường lửa (Windows Defender Firewall) an toàn

Vì Cloudflare Tunnel chỉ gửi kết nối đi (outbound) từ VPS lên Cloudflare, bạn có thể khóa toàn bộ cổng kết nối đi vào (inbound) để bảo mật:
1.  Mở ứng dụng **Windows Defender Firewall with Advanced Security**.
2.  Bạn chỉ cần giữ lại cổng kết nối cho **Remote Desktop (RDP)** để điều khiển VPS từ xa.
3.  Các cổng như **80, 443, 3000, 4000, 3306** đều **không cần mở** ra ngoài internet, đảm bảo VPS của bạn không bị dò quét lỗ hổng từ hacker.
