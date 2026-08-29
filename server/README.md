# TechMax Node Backend

Backend NodeJS thay thế PHP.

## Local

```bash
npm run dev:api
npm run dev
```

API chạy tại:

```text
http://localhost:4000/api
```

Frontend dùng:

```text
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
```

## VPS

```bash
npm install
npm run build
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

Biến môi trường cần có:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-domain.com/api
API_PORT=4000
DB_HOST=localhost
DB_USER=your_mysql_user
DB_PASS=your_mysql_password
DB_NAME=techmax_app
```

Nginx nên proxy:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:4000/api/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}

location / {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```
