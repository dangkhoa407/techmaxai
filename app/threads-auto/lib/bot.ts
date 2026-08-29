import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest, type Server } from "node:http";
import { request as httpsRequest } from "node:https";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { tmpdir } from "node:os";
import { Builder, By, Key, WebDriver, WebElement } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";
import { getFacebookAutoHeadlessChrome, getFacebookAutoLowResourceMode } from "../../facebook-auto/lib/database";

export type ThreadsSessionInspection = {
  status: "active" | "checkpoint" | "invalid" | "unknown";
  threadsName: string;
  threadsUserId: string;
};

export type ThreadsAutoPostRunLog = {
  level: "info" | "success" | "warn" | "error";
  message: string;
  createdAt: string;
};

export type ThreadsAutoPostRunConfig = {
  cookie: string;
  proxy?: string | null;
  signal?: AbortSignal;
  enableGroupPost?: boolean;
  enableFeedComment?: boolean;
  enableSearchComment?: boolean;
  randomizeTasks?: boolean;
  topics: string[];
  contents: string[];
  count: number;
  delaySeconds: number;
  feedCommentContents?: string[];
  feedCommentCount?: number;
  feedCommentDelaySeconds?: number;
  searchKeyword?: string;
  searchCommentContents?: string[];
  searchCommentCount?: number;
  searchCommentDelaySeconds?: number;
  skipCompletedActions?: number;
};

export type ThreadsAutoPostRunObserver = {
  onLog?: (entry: ThreadsAutoPostRunLog) => void;
  beforeAction?: () => Promise<void> | void;
  onDelay?: (seconds: number) => Promise<void> | void;
  getCommentedPostUrls?: () => Promise<string[]> | string[];
  onCommentedPost?: (postUrl: string, taskType: "newfeed" | "search") => Promise<void> | void;
};

type ChromeProxySettings = {
  server: string;
  protocol: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  extensionDir?: string;
};

type ChromeProxyCleanup = {
  extensionDir?: string;
  close?: () => Promise<void>;
  requiresVisibleChrome?: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function throwIfThreadsRunStopped(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Đã dừng bot Threads.");
}

function sleepRandom(minMs: number, maxMs: number) {
  const lower = Math.min(minMs, maxMs);
  const upper = Math.max(minMs, maxMs);
  return sleep(lower + Math.floor(Math.random() * (upper - lower + 1)));
}

function randomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function shuffleItems<T>(items: T[]) {
  const output = [...items];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function sanitizeAutomationText(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeThreadsLogText(value: string) {
  return String(value || "")
    .replace(/KhÃ´ng click Ä‘Æ°á»£c nÃºt Post sau khi nháº­p xong ná»™i dung\./g, "Không click được nút Post sau khi nhập xong nội dung.")
    .replace(/KhÃ´ng tÃ¬m tháº¥y Ã´ What's new\./g, "Không tìm thấy ô What's new.")
    .replace(/KhÃ´ng nháº­p Ä‘Æ°á»£c ná»™i dung post pháº§n/g, "Không nhập được nội dung post phần")
    .replace(/KhÃ´ng má»Ÿ Ä‘Æ°á»£c Ã´ Say more pháº§n/g, "Không mở được ô Say more phần")
    .replace(/KhÃ´ng click Ä‘Æ°á»£c Ã´ Say more pháº§n/g, "Không click được ô Say more phần");
}

function addThreadsRunLog(
  logs: ThreadsAutoPostRunLog[],
  level: ThreadsAutoPostRunLog["level"],
  message: string,
  observer?: ThreadsAutoPostRunObserver
) {
  const entry = { level, message: normalizeThreadsLogText(message), createdAt: new Date().toISOString() };
  logs.push(entry);
  observer?.onLog?.(entry);
}

function normalizeThreadsRunItems(items: string[]) {
  return [...new Set(items.map((item) => sanitizeAutomationText(String(item || ""))).filter(Boolean))];
}

const THREADS_POST_CHUNK_LIMIT = 449;

function splitLongSentenceIntoThreadsChunks(sentence: string, maxLength = THREADS_POST_CHUNK_LIMIT) {
  const words = sentence.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      if (countThreadsPostCharacters(word) <= maxLength) {
        current = word;
      } else {
        const chars = Array.from(word);
        for (let index = 0; index < chars.length; index += maxLength) {
          chunks.push(chars.slice(index, index + maxLength).join(""));
        }
      }
      continue;
    }
    const next = `${current} ${word}`;
    if (countThreadsPostCharacters(next) <= maxLength) {
      current = next;
    } else {
      chunks.push(current);
      current = countThreadsPostCharacters(word) <= maxLength ? word : "";
      if (!current) {
        const chars = Array.from(word);
        for (let index = 0; index < chars.length; index += maxLength) {
          chunks.push(chars.slice(index, index + maxLength).join(""));
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function waitThreadsRunDelay(seconds: number, logs: ThreadsAutoPostRunLog[], observer?: ThreadsAutoPostRunObserver) {
  const totalSeconds = Math.max(0, Math.ceil(seconds));
  if (totalSeconds <= 0) return;
  if (observer?.onDelay) {
    await observer.onDelay(totalSeconds);
    return;
  }
  addThreadsRunLog(logs, "info", `Đang đợi ${totalSeconds}s`, observer);
  await sleep(totalSeconds * 1000);
}

function isStaleElementError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /stale element reference|stale element not found|not found in the current frame/i.test(message);
}

async function removeTempDirBestEffort(dir: string) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "");
      if (!/EBUSY|ENOTEMPTY|EPERM|resource busy|locked/i.test(message) || attempt === 5) {
        console.warn(`[threads-auto] Không xoá được thư mục tạm Chrome ${dir}: ${message}`);
        return;
      }
      await sleep(350 * attempt);
    }
  }
}

function isCookieAttributeName(name: string) {
  return new Set([
    "domain",
    "path",
    "expires",
    "max-age",
    "secure",
    "httponly",
    "samesite",
    "priority",
    "sameparty",
    "partitioned"
  ]).has(name.toLowerCase());
}

function decodeCookieValue(value: string) {
  const trimmed = value.trim().replace(/^"(.*)"$/, "$1");
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function parseCookieParts(cookie: string) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const equalsIndex = part.indexOf("=");
      if (equalsIndex <= 0) return null;
      const name = part.slice(0, equalsIndex).trim();
      const value = part.slice(equalsIndex + 1);
      if (!name || name.startsWith("$") || isCookieAttributeName(name)) return null;
      return { name, value: decodeCookieValue(value) };
    })
    .filter((item): item is { name: string; value: string } => Boolean(item));
}

function executeBrowserScript<T>(driver: WebDriver, script: string, ...args: unknown[]) {
  const wrapped = `return (function () {\n${script}\n}).apply(null, arguments);`;
  return driver.executeScript(wrapped, ...args) as Promise<T>;
}

async function executeBrowserAsyncScript<T>(driver: WebDriver, script: string, ...args: unknown[]) {
  const wrapped = `
    const callback = arguments[arguments.length - 1];
    const args = Array.prototype.slice.call(arguments, 0, -1);
    (async function () {
${script}
    }).apply(null, args).then(
      (value) => callback({ ok: true, value }),
      (error) => callback({ ok: false, error: error && error.message ? error.message : String(error) })
    );
  `;
  const result = await driver.executeAsyncScript(wrapped, ...args) as { ok: boolean; value?: T; error?: string };
  if (!result?.ok) throw new Error(result?.error || "Browser async script failed.");
  return result.value as T;
}

function configureSeleniumManager() {
  const binaryName = process.platform === "win32" ? "selenium-manager.exe" : "selenium-manager";
  const platformDir =
    process.platform === "win32" ? "windows" : process.platform === "darwin" ? "macos" : "linux";
  const managerPath = path.join(
    process.cwd(),
    "node_modules",
    "selenium-webdriver",
    "bin",
    platformDir,
    binaryName
  );

  if (existsSync(managerPath)) {
    process.env.SE_MANAGER_PATH = managerPath;
  }
}

function applyLowResourceChromeOptions(options: chrome.Options) {
  options.addArguments("--blink-settings=imagesEnabled=false");
  options.addArguments("--disable-background-networking");
  options.addArguments("--disable-background-timer-throttling");
  options.addArguments("--disable-client-side-phishing-detection");
  options.addArguments("--disable-default-apps");
  options.addArguments("--disable-features=Translate,MediaRouter,OptimizationHints,PreloadMediaEngagementData");
  options.addArguments("--disable-renderer-backgrounding");
  options.addArguments("--disable-sync");
  options.addArguments("--disable-translate");
  options.setUserPreferences({
    credentials_enable_service: false,
    "profile.default_content_setting_values.automatic_downloads": 2,
    "profile.default_content_setting_values.geolocation": 2,
    "profile.default_content_setting_values.images": 2,
    "profile.default_content_setting_values.media_stream": 2,
    "profile.default_content_setting_values.notifications": 2,
    "profile.default_content_setting_values.plugins": 2,
    "profile.default_content_setting_values.popups": 2
  });
}

function parseChromeProxy(proxy: string): ChromeProxySettings | null {
  const value = proxy.trim();
  if (!value) return null;
  const fallbackProtocol = "http";
  let protocol = fallbackProtocol;
  let host = "";
  let port = "";
  let username = "";
  let password = "";

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    const protocolMatch = value.match(/^([a-z][a-z0-9+.-]*):\/\/(.+)$/i);
    protocol = (protocolMatch?.[1] || fallbackProtocol).toLowerCase();
    const rest = protocolMatch?.[2] || "";
    if (rest.includes("@")) {
      const parsed = new URL(value);
      host = parsed.hostname;
      port = parsed.port;
      username = decodeURIComponent(parsed.username || "");
      password = decodeURIComponent(parsed.password || "");
    } else {
      const parts = rest.split(":");
      if (parts.length >= 4) {
        [host, port, username] = parts;
        password = parts.slice(3).join(":");
      } else {
        [host, port] = parts;
      }
    }
  } else {
    const parts = value.split(":");
    if (parts.length >= 4) {
      [host, port, username] = parts;
      password = parts.slice(3).join(":");
    } else {
      [host, port] = parts;
    }
  }

  host = host.trim();
  port = port.trim();
  if (!host || !port) return null;
  if (!/^(https?|socks4|socks5)$/i.test(protocol)) protocol = fallbackProtocol;
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) return null;
  return { server: `${protocol}://${host}:${port}`, protocol, host, port: numericPort, username: username.trim(), password: password.trim() };
}

function createChromeProxyAuthExtension(settings: ChromeProxySettings) {
  if (!settings.username || !settings.password) return "";
  const extensionDir = mkdtempSync(path.join(tmpdir(), "threads-auto-proxy-auth-"));
  const manifest = {
    version: "1.0.0",
    manifest_version: 2,
    name: "Threads Auto Proxy Auth",
    permissions: ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
    background: { scripts: ["background.js"] },
    minimum_chrome_version: "22.0.0"
  };
  const background = `
chrome.proxy.settings.set({
  value: {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: ${JSON.stringify(settings.protocol.replace(/^socks4$/i, "socks4").replace(/^socks5$/i, "socks5"))},
        host: ${JSON.stringify(settings.host)},
        port: ${JSON.stringify(settings.port)}
      },
      bypassList: ["localhost", "127.0.0.1"]
    }
  },
  scope: "regular"
});

chrome.webRequest.onAuthRequired.addListener(
  function() {
    return {
      authCredentials: {
        username: ${JSON.stringify(settings.username)},
        password: ${JSON.stringify(settings.password)}
      }
    };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);
`;
  writeFileSync(path.join(extensionDir, "manifest.json"), JSON.stringify(manifest), "utf8");
  writeFileSync(path.join(extensionDir, "background.js"), background, "utf8");
  return extensionDir;
}

function connectViaUpstreamProxy(upstream: ChromeProxySettings, target: string) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(upstream.port, upstream.host);
    const auth = upstream.username || upstream.password
      ? Buffer.from(`${upstream.username || ""}:${upstream.password || ""}`).toString("base64")
      : "";
    let buffer = "";
    const fail = (error: Error) => {
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(30000, () => fail(new Error("Proxy bridge timeout.")));
    socket.once("error", fail);
    socket.once("connect", () => {
      const lines = [
        `CONNECT ${target} HTTP/1.1`,
        `Host: ${target}`,
        "Proxy-Connection: Keep-Alive",
      ];
      if (auth) lines.push(`Proxy-Authorization: Basic ${auth}`);
      lines.push("", "");
      socket.write(lines.join("\r\n"));
    });
    socket.on("data", function onData(chunk) {
      buffer += chunk.toString("latin1");
      if (!buffer.includes("\r\n\r\n")) return;
      socket.off("data", onData);
      const [headerText, rest] = buffer.split("\r\n\r\n");
      if (!/^HTTP\/1\.[01] 2\d\d\b/i.test(headerText)) {
        fail(new Error(`Upstream proxy refused CONNECT: ${headerText.split("\r\n")[0] || "unknown"}`));
        return;
      }
      socket.setTimeout(0);
      socket.removeListener("error", fail);
      if (rest) socket.unshift(Buffer.from(rest, "latin1"));
      resolve(socket);
    });
  });
}

function closeServer(server: Server) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

async function startLocalProxyBridge(upstream: ChromeProxySettings) {
  if (!upstream.username || !upstream.password || !/^https?$/i.test(upstream.protocol)) return null;
  const server = createServer();
  const auth = Buffer.from(`${upstream.username}:${upstream.password}`).toString("base64");

  server.on("request", (req, res) => {
    const upstreamSocket = net.connect(upstream.port, upstream.host, () => {
      const headers = { ...req.headers, "proxy-authorization": `Basic ${auth}` };
      const headerLines = Object.entries(headers)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
      upstreamSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headerLines.join("\r\n")}\r\n\r\n`);
      req.pipe(upstreamSocket);
    });
    upstreamSocket.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    upstreamSocket.pipe(res.socket!);
  });

  server.on("connect", (req, clientSocket, head) => {
    connectViaUpstreamProxy(upstream, req.url || "")
      .then((upstreamSocket) => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstreamSocket.write(head);
        upstreamSocket.pipe(clientSocket);
        clientSocket.pipe(upstreamSocket);
      })
      .catch(() => {
        clientSocket.write("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        clientSocket.destroy();
      });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    await closeServer(server);
    return null;
  }
  return {
    server: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server)
  };
}

async function applyChromeProxyOptions(options: chrome.Options, proxy: string): Promise<ChromeProxyCleanup> {
  const settings = parseChromeProxy(proxy);
  if (!settings) return {};
  const bridge = await startLocalProxyBridge(settings);
  if (bridge) {
    options.addArguments(`--proxy-server=${bridge.server}`);
    return { close: bridge.close };
  }
  const extensionDir = createChromeProxyAuthExtension(settings);
  if (extensionDir) {
    options.addArguments(`--load-extension=${extensionDir}`);
    options.addArguments(`--disable-extensions-except=${extensionDir}`);
    return { extensionDir, requiresVisibleChrome: true };
  }
  options.addArguments(`--proxy-server=${settings.server}`);
  return {};
}

function attachChromeTempCleanup(driver: WebDriver, dirs: string[], closeProxy?: () => Promise<void>) {
  const originalQuit = driver.quit.bind(driver);
  driver.quit = async () => {
    try {
      return await originalQuit();
    } finally {
      await sleep(500);
      await closeProxy?.().catch(() => undefined);
      await Promise.all(dirs.filter(Boolean).map((dir) => removeTempDirBestEffort(dir)));
    }
  };
}

function maskProxyForLog(proxy: string) {
  const value = proxy.trim();
  if (!value) return "";
  const parsed = parseChromeProxy(value);
  if (!parsed) return value;
  if (!parsed.username) return parsed.server;
  return `${parsed.protocol}://${parsed.host}:${parsed.port}:${parsed.username}:***`;
}

function extractPublicIpFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const candidate = parsed.ip || parsed.IP || parsed.query || parsed.address;
    if (candidate) return String(candidate).trim();
  } catch {
    // Some IP services return plain text instead of JSON.
  }
  return trimmed.match(/[0-9a-fA-F:.]{7,}/)?.[0] || "";
}

function samePublicIp(left?: string, right?: string) {
  return Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase());
}

function cleanIpInfoValue(value: unknown) {
  return String(value || "").trim();
}

function ipInfoTextFromPayload(payload: Record<string, unknown>, fallbackIp = "") {
  const city = cleanIpInfoValue(payload.city);
  const region = cleanIpInfoValue(payload.region_name || payload.region || payload.state || payload.province);
  const country = cleanIpInfoValue(payload.country_name || payload.country || payload.country_iso || payload.country_code);
  const timezone = cleanIpInfoValue(payload.time_zone || payload.timezone);
  return [city, region, country].filter(Boolean).join(", ") || timezone || fallbackIp;
}

async function fetchText(url: string, options: { proxyServer?: string; timeoutMs?: number } = {}) {
  const timeoutMs = options.timeoutMs ?? 12000;
  return new Promise<string>((resolve, reject) => {
    const target = new URL(url);
    const proxy = options.proxyServer ? new URL(options.proxyServer) : null;
    const isHttpsTarget = target.protocol === "https:";
    const transport = proxy ? httpRequest : isHttpsTarget ? httpsRequest : httpRequest;
    const requestOptions = proxy
      ? {
          protocol: proxy.protocol,
          hostname: proxy.hostname,
          port: proxy.port,
          method: "GET",
          path: url,
          headers: { Host: target.host, "User-Agent": "TechMax-ThreadsAuto/1.0" }
        }
      : {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          method: "GET",
          path: `${target.pathname}${target.search}`,
          headers: { "User-Agent": "TechMax-ThreadsAuto/1.0" }
        };
    const req = transport(requestOptions, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
        if (body.length > 1024 * 64) {
          req.destroy(new Error("Phản hồi kiểm tra IP quá lớn."));
        }
      });
      res.on("end", () => resolve(body));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error("Timeout kiểm tra IP.")));
    req.on("error", reject);
    req.end();
  });
}

async function fetchTextViaProxyConnect(url: string, proxy: ChromeProxySettings, timeoutMs = 12000) {
  const target = new URL(url);
  if (target.protocol !== "https:") {
    return fetchText(url, { proxyServer: proxy.server, timeoutMs });
  }

  const startedAt = Date.now();
  const targetPort = target.port || (target.protocol === "https:" ? "443" : "80");
  const proxySocket = await connectViaUpstreamProxy(proxy, `${target.hostname}:${targetPort}`);
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let raw = "";
    const secureSocket = tls.connect({
      socket: proxySocket,
      servername: target.hostname,
      rejectUnauthorized: true
    });
    const finish = (error?: Error, body = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      secureSocket.destroy();
      if (error) reject(error);
      else resolve(body);
    };
    const timer = setTimeout(
      () => finish(new Error("Timeout kiểm tra IP qua proxy.")),
      Math.max(1000, timeoutMs - (Date.now() - startedAt))
    );
    secureSocket.once("secureConnect", () => {
      secureSocket.write([
        `GET ${target.pathname}${target.search} HTTP/1.1`,
        `Host: ${target.host}`,
        "User-Agent: TechMax-ThreadsAuto/1.0",
        "Accept: application/json,text/plain,*/*",
        "Connection: close",
        "",
        ""
      ].join("\r\n"));
    });
    secureSocket.setEncoding("utf8");
    secureSocket.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 64) {
        finish(new Error("Phản hồi kiểm tra IP qua proxy quá lớn."));
      }
    });
    secureSocket.on("end", () => {
      const [headerText, ...bodyParts] = raw.split("\r\n\r\n");
      const status = headerText.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/i)?.[1];
      if (status && Number(status) >= 400) {
        finish(new Error(`HTTP ${status}`));
        return;
      }
      finish(undefined, bodyParts.join("\r\n\r\n") || raw);
    });
    secureSocket.on("error", (error) => finish(error));
  });
}

const ipLocationCache = new Map<string, { location: string; expiresAt: number }>();

async function lookupIpLocation(ip: string) {
  const normalized = ip.trim();
  if (!normalized) return "";
  const cached = ipLocationCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.location;

  const targets = [
    `https://ipconfig.io/json?ip=${encodeURIComponent(normalized)}`,
    `https://ipwho.is/${encodeURIComponent(normalized)}`
  ];
  for (const target of targets) {
    try {
      const text = await fetchText(target, { timeoutMs: 8000 });
      const payload = JSON.parse(text) as Record<string, unknown>;
      const location = ipInfoTextFromPayload(payload, normalized);
      if (location) {
        ipLocationCache.set(normalized, { location, expiresAt: Date.now() + 10 * 60 * 1000 });
        return location;
      }
    } catch {
      // Try the next lookup service.
    }
  }
  return "";
}

let directPublicIpCache: { ip: string; expiresAt: number } | null = null;

async function getDirectPublicIp() {
  if (directPublicIpCache && directPublicIpCache.expiresAt > Date.now()) {
    return directPublicIpCache.ip;
  }
  const targets = [
    "https://ipconfig.io/json",
    "https://api.ipify.org?format=json",
    "https://ifconfig.co/json"
  ];
  for (const target of targets) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(target, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      const ip = extractPublicIpFromText(await response.text());
      if (ip) {
        directPublicIpCache = { ip, expiresAt: Date.now() + 5 * 60 * 1000 };
        return ip;
      }
    } catch {
      // Try the next service.
    }
  }
  return "";
}

async function getProxyPublicIp(proxy: string) {
  const settings = parseChromeProxy(proxy);
  if (!settings) return { ip: "", error: "Proxy không hợp lệ." };
  if (!/^https?$/i.test(settings.protocol)) {
    return { ip: "", error: "Chưa hỗ trợ xác nhận IP backend cho SOCKS proxy." };
  }

  const targets = [
    "https://ipconfig.io/json",
    "https://api.ipify.org?format=json",
    "https://ifconfig.co/json"
  ];
  let lastError = "";
  for (const target of targets) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const text = await fetchTextViaProxyConnect(target, settings, 15000);
        const ip = extractPublicIpFromText(text);
        if (ip) return { ip, source: new URL(target).hostname };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Không kiểm tra được IP proxy.";
        await sleep(400 * attempt);
      }
    }
  }
  return { ip: "", error: lastError || "Không đọc được IP proxy." };
}

async function checkChromeProxyUsage(driver: WebDriver, proxy: string) {
  const startedAt = Date.now();
  const previousTimeouts = await driver.manage().getTimeouts().catch(() => null);
  try {
    await driver.manage().setTimeouts({ pageLoad: 15000, script: 15000, implicit: 0 });
    const target = "https://ipconfig.io/json";
    await driver.get(target);
    const bodyText = String(await driver.executeScript("return document.body ? document.body.innerText : ''")).trim();
    const ip = extractPublicIpFromText(bodyText);
    if (!ip) throw new Error("Không đọc được IP từ trang kiểm tra.");
    const [directIp, proxyIpResult] = await Promise.all([
      getDirectPublicIp(),
      getProxyPublicIp(proxy)
    ]);
    const proxyIp = proxyIpResult.ip || "";
    const verifiedExactProxy = samePublicIp(ip, proxyIp);
    const bypassedProxy = Boolean(directIp && samePublicIp(ip, directIp));
    const proxyLocation = await lookupIpLocation(proxyIp || ip);
    return {
      ok: Boolean(ip),
      ip,
      directIp,
      proxyIp,
      proxyLocation,
      proxyIpError: proxyIpResult.error || "",
      verifiedExactProxy,
      bypassedProxy,
      verifiedProxy: verifiedExactProxy,
      source: new URL(target).hostname,
      latencyMs: Date.now() - startedAt,
      proxy: maskProxyForLog(proxy)
    };
  } catch (error) {
    return {
      ok: false,
      ip: "",
      latencyMs: Date.now() - startedAt,
      proxy: maskProxyForLog(proxy),
      error: error instanceof Error ? error.message : "Không kiểm tra được proxy."
    };
  } finally {
    if (previousTimeouts) {
      await driver.manage().setTimeouts(previousTimeouts).catch(() => undefined);
    }
  }
}

type ChromeProxyCheckResult = Awaited<ReturnType<typeof checkChromeProxyUsage>>;

function proxyCheckLogLevel(result: ChromeProxyCheckResult): ThreadsAutoPostRunLog["level"] {
  if (!result.ok) return "error";
  if (result.verifiedExactProxy) return "success";
  return "warn";
}

function formatProxyCheckMessage(prefix: string, result: ChromeProxyCheckResult) {
  if (!result.ok) {
    return `${prefix} proxy lỗi: ${result.proxy} - ping ${result.latencyMs}ms - ${result.error || "Không kết nối được."}`;
  }

  const details = [
    `${prefix}: ${result.proxy}`,
    `IP Chrome ${result.ip}`,
    result.proxyIp ? `IP proxy ${result.proxyIp}` : "",
    result.proxyLocation ? `Vị trí proxy ${result.proxyLocation}` : "",
    result.directIp ? `IP máy chủ ${result.directIp}` : "",
    `ping ${result.latencyMs}ms`
  ].filter(Boolean).join(" - ");

  if (result.verifiedExactProxy) {
    return `${details} - IP ipconfig.io trùng IP proxy, xác nhận Chrome đang dùng proxy.`;
  }
  if (result.bypassedProxy) {
    return `${details} - cảnh báo: IP Chrome trùng IP máy chủ, Chrome chưa dùng proxy.`;
  }
  if (result.proxyIp) {
    return `${details} - cảnh báo: IP ipconfig.io của Chrome không trùng IP proxy, chưa duyệt là đã dùng proxy.`;
  }
  return `${details}${result.proxyIpError ? ` - không kiểm tra được IP proxy qua ipconfig.io (${result.proxyIpError})` : ""} - chưa duyệt là đã dùng proxy.`;
}

async function buildThreadsDriver(proxy = "", profilePrefix = "threads-auto-run-") {
  configureSeleniumManager();
  const options = new chrome.Options();
  const tempProfileDir = mkdtempSync(path.join(tmpdir(), profilePrefix));
  options.addArguments("--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage");
  options.addArguments("--disable-notifications", "--mute-audio");
  options.addArguments("--window-size=1280,900", "--lang=en-US");
  options.addArguments(`--user-data-dir=${tempProfileDir}`);
  options.excludeSwitches("enable-automation", "enable-logging");
  options.setUserPreferences({ credentials_enable_service: false });

  const tempDirs = [tempProfileDir];
  const proxyCleanup = await applyChromeProxyOptions(options, proxy);
  if (proxyCleanup.extensionDir) tempDirs.push(proxyCleanup.extensionDir);
  const runHeadless = (await getFacebookAutoHeadlessChrome()) && !proxyCleanup.requiresVisibleChrome;
  if (runHeadless) {
    options.addArguments("--headless=new");
  } else {
    options.addArguments("--start-maximized");
    options.addArguments("--disable-backgrounding-occluded-windows");
  }
  if (await getFacebookAutoLowResourceMode()) {
    applyLowResourceChromeOptions(options);
  }
  const bundledChrome = path.join(process.cwd(), "chrome", "chrome.exe");
  if (process.platform === "win32" && existsSync(bundledChrome)) options.setChromeBinaryPath(bundledChrome);

  const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
  attachChromeTempCleanup(driver, tempDirs, proxyCleanup.close);
  await driver.manage().setTimeouts({ pageLoad: 30000, script: 30000, implicit: 0 });
  if (!runHeadless) {
    await driver.manage().window().setRect({ x: 40, y: 40, width: 1280, height: 900 }).catch(() => undefined);
  }
  return driver;
}

async function clickElement(driver: WebDriver, element: WebElement) {
  try {
    await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant', block:'center', inline:'center'});", element);
    await sleep(150);
    await element.click();
  } catch {
    try {
      await driver.actions({ async: true }).move({ origin: element }).click().perform();
    } catch {
      await driver.executeScript(`
        const element = arguments[0];
        element.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const target = document.elementFromPoint(x, y) || element;
        for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
          target.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: x,
            clientY: y,
            button: 0
          }));
        }
      `, element);
    }
  }
}

async function loadThreadsCookieIntoDriver(driver: WebDriver, cookie: string) {
  await driver.get("https://www.threads.com/?h=en");
  await sleep(800);

  for (const part of parseCookieParts(cookie)) {
    try {
      await driver.manage().addCookie({
        name: part.name,
        value: part.value,
        domain: ".threads.com",
        path: "/"
      });
    } catch {
      try {
        await driver.manage().addCookie({
          name: part.name,
          value: part.value,
          path: "/"
        });
      } catch {
        // Ignore individual cookie failures; page checks decide live or die.
      }
    }
  }
}

async function waitForThreadsReady(driver: WebDriver) {
  await driver.wait(async () => {
    const ready = await driver.executeScript("return document.readyState === 'complete'").catch(() => false);
    const hasBody = await driver.executeScript("return Boolean(document.body && document.body.innerText && document.body.innerText.trim().length > 0)").catch(() => false);
    return Boolean(ready && hasBody);
  }, 15000).catch(() => undefined);

  const status = await executeBrowserScript<{ loginWall: boolean; checkpoint: boolean }>(driver, `
    const text = String(document.body?.innerText || '').toLowerCase();
    const url = String(location.href || '').toLowerCase();
    return {
      loginWall: /log in|sign up|continue with instagram|forgot password|create an account/.test(text),
      checkpoint: /checkpoint|challenge|security check/.test(text + ' ' + url)
    };
  `);
  if (status.checkpoint) throw new Error("Checkpoint");
  if (status.loginWall) throw new Error("Đăng nhập thất bại");
}

export async function inspectThreadsCookieWithChrome(cookie: string, proxy = ""): Promise<ThreadsSessionInspection> {
  let driver: WebDriver | undefined;
  try {
    driver = await buildThreadsDriver(proxy, "threads-auto-checklive-");
    await loadThreadsCookieIntoDriver(driver, cookie);
    await driver.get("https://www.threads.com/?h=en");
    await driver.wait(async () => {
      const ready = await driver!.executeScript("return document.readyState === 'complete'").catch(() => false);
      const hasBody = await driver!.executeScript("return Boolean(document.body && document.body.innerText && document.body.innerText.trim().length > 0)").catch(() => false);
      return Boolean(ready && hasBody);
    }, 12000).catch(() => undefined);

    let profileInfo: { found: boolean; clicked: boolean; href: string; loginWall: boolean } = {
      found: false,
      clicked: false,
      href: "",
      loginWall: false
    };
    const profileDeadline = Date.now() + 30000;
    while (Date.now() < profileDeadline) {
      profileInfo = await executeBrowserScript<{ found: boolean; clicked: boolean; href: string; loginWall: boolean }>(driver, `
        const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
        const isVisible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const markerText = (link) => [
          link.getAttribute('aria-label') || '',
          link.innerText || '',
          link.textContent || '',
          Array.from(link.querySelectorAll('svg[aria-label], title')).map((node) => node.getAttribute('aria-label') || node.textContent || '').join(' ')
        ].join(' ').toLowerCase();
        const scoreLink = (link) => {
          const href = link.getAttribute('href') || '';
          if (!href.startsWith('/@')) return -1;
          if (!isVisible(link)) return -1;
          const text = markerText(link);
          let score = 0;
          if (text.includes('profile')) score += 100;
          if (link.querySelector('svg[aria-label="Profile"], title')) score += 40;
          const scope = link.closest('a, [role="link"], [role="button"]') || link.parentElement || link;
          if (clean(scope.textContent || '').toLowerCase().includes('profile')) score += 20;
          const rect = link.getBoundingClientRect();
          if (rect.left < window.innerWidth * 0.45) score += 8;
          return score;
        };
        const candidates = Array.from(document.querySelectorAll('a[role="link"][href^="/@"], a[href^="/@"]'))
          .map((link) => ({ link, href: link.getAttribute('href') || '', score: scoreLink(link) }))
          .filter((item) => item.score >= 0)
          .sort((a, b) => b.score - a.score);
        const picked = candidates[0]?.link || null;
        const bodyText = clean(document.body?.innerText || '').toLowerCase();
        const loginWall = /log in|sign up|continue with instagram|forgot password|create an account/.test(bodyText);
        if (!picked) return { found: false, clicked: false, href: '', loginWall };
        picked.scrollIntoView({ block: 'center', inline: 'center' });
        for (const eventName of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
          picked.dispatchEvent(new MouseEvent(eventName, { bubbles: true, cancelable: true, view: window }));
        }
        return { found: true, clicked: true, href: picked.getAttribute('href') || '', loginWall };
      `);

      if (profileInfo.clicked) {
        await sleep(1200);
        const currentUrl = await driver.getCurrentUrl().catch(() => "");
        if (/threads\.com\/@[^/?#]+/i.test(currentUrl)) break;
        if (profileInfo.href) {
          const target = profileInfo.href.startsWith("http") ? profileInfo.href : `https://www.threads.com${profileInfo.href}`;
          await driver.get(target).catch(() => undefined);
          await sleep(1200);
          const nextUrl = await driver.getCurrentUrl().catch(() => "");
          if (/threads\.com\/@[^/?#]+/i.test(nextUrl)) break;
        }
      }

      if (profileInfo.loginWall) break;
      await sleep(1000);
    }

    if (!profileInfo.found) {
      return { status: profileInfo.loginWall ? "invalid" : "unknown", threadsName: "", threadsUserId: "" };
    }

    await driver.wait(async () => {
      const url = await driver!.getCurrentUrl().catch(() => "");
      const hasHeading = await driver!.executeScript("return Boolean(document.querySelector('h1'))").catch(() => false);
      return hasHeading || /threads\.com\/@[^/?#]+/i.test(url);
    }, 12000).catch(() => undefined);

    const account = await executeBrowserScript<{ name: string; username: string; bodyText: string; title: string }>(driver, `
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const scopeCandidates = Array.from(document.querySelectorAll('div'))
        .filter((node) => isVisible(node))
        .filter((node) => node.querySelector('h1'))
        .map((node) => ({
          node,
          score:
            (node.querySelector('img[alt*="profile picture" i]') ? 40 : 0) +
            (/followers/i.test(node.textContent || '') ? 20 : 0) +
            (node.querySelector('span[translate="no"]') ? 20 : 0),
          size: (node.textContent || '').length
        }))
        .sort((a, b) => b.score - a.score || a.size - b.size);
      const scope = scopeCandidates[0]?.node || document.body;
      const name = clean(scope.querySelector('h1')?.textContent || '');
      const urlMatch = location.pathname.match(/^\\/@([^/?#]+)/);
      const textCandidates = Array.from(scope.querySelectorAll('span[translate="no"], span[dir="auto"] span'))
        .map((node) => clean(node.textContent || ''))
        .filter(Boolean);
      const username = clean(
        (urlMatch && urlMatch[1]) ||
        textCandidates.find((value) => /^[A-Za-z0-9._]{2,60}$/.test(value) && value !== name) ||
        ''
      ).replace(/^@/, '');
      return {
        name,
        username,
        bodyText: clean(document.body?.innerText || '').slice(0, 3000),
        title: clean(document.title || '')
      };
    `);

    const currentUrl = (await driver.getCurrentUrl().catch(() => "")).toLowerCase();
    const text = `${account.title} ${account.bodyText}`.toLowerCase();
    if (/log in|sign up|continue with instagram|forgot password|create an account/.test(text) && !account.username) {
      return { status: "invalid", threadsName: "", threadsUserId: "" };
    }
    if (/checkpoint|challenge|security check/.test(currentUrl + " " + text)) {
      return { status: "checkpoint", threadsName: account.name || "", threadsUserId: account.username || "" };
    }
    if (account.username) {
      return { status: "active", threadsName: account.name || account.username, threadsUserId: account.username };
    }
    return { status: "unknown", threadsName: account.name || "", threadsUserId: "" };
  } catch {
    return { status: "invalid", threadsName: "", threadsUserId: "" };
  } finally {
    await driver?.quit().catch(() => undefined);
  }
}

async function clickThreadsNewThreadButton(driver: WebDriver, timeoutMs = 15000) {
  const findScript = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const findNavScopes = () => {
      const scopes = [];
      const logo = document.querySelector('svg[aria-label="Threads"]');
      let node = logo?.parentElement || null;
      for (let hop = 0; hop < 10 && node; hop += 1) {
        const text = clean(node.innerText || node.textContent || '');
        const rect = node.getBoundingClientRect();
        if (/new thread/i.test(text) && /(profile|more|messages|activity|search|danh cho ban|dang theo doi)/i.test(text) && rect.width > 120) {
          scopes.push(node);
          break;
        }
        node = node.parentElement;
      }
      for (const candidate of document.querySelectorAll('nav, aside, [role="navigation"], [aria-label*="navigation" i]')) {
        if (isVisible(candidate) && /new thread/i.test(clean(candidate.innerText || candidate.textContent || ''))) scopes.push(candidate);
      }
      return scopes.length ? scopes : [document.body];
    };
    const candidates = [];
    for (const label of Array.from(document.querySelectorAll('span, div')).filter(isVisible)) {
      const text = clean(label.innerText || label.textContent || '');
      if (!/^new thread$/i.test(text)) continue;
      const button = label.closest('[role="button"], button');
      if (!button || !isVisible(button)) continue;
      const rect = button.getBoundingClientRect();
      candidates.push({ element: button, score: 260, top: rect.top });
    }
    for (const scope of findNavScopes()) {
      for (const element of scope.querySelectorAll('[role="button"], button')) {
        if (!isVisible(element)) continue;
        const text = clean(element.innerText || element.textContent || element.getAttribute('aria-label') || '');
        const rect = element.getBoundingClientRect();
        let score = 0;
        if (/^new thread$/i.test(text)) score += 200;
        if (/new thread/i.test(text)) score += 120;
        if (element.querySelector('svg path[d^="M12 2C12.5523"]')) score += 30;
        if (rect.left < window.innerWidth * 0.5) score += 10;
        if (score > 0) candidates.push({ element, score, top: rect.top });
      }
    }
    candidates.sort((a, b) => b.score - a.score || a.top - b.top);
    const picked = candidates[0]?.element || null;
    if (!picked) return null;
    picked.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    return picked;
  `;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, findScript).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (button) {
      await clickElement(driver, button);
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function clickThreadsNewThreadButtonByXpath(driver: WebDriver) {
  const candidates = await driver.findElements(By.xpath("//span[normalize-space(.)='New thread']/ancestor::*[@role='button'][1] | //div[normalize-space(.)='New thread']/ancestor::*[@role='button'][1]"));
  for (const candidate of candidates) {
    const displayed = await candidate.isDisplayed().catch(() => false);
    if (!displayed) continue;
    await clickElement(driver, candidate);
    return true;
  }
  return false;
}

async function waitForThreadsComposerWithTopic(driver: WebDriver, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const hasComposer = await executeBrowserScript<boolean>(driver, `
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const topic = Array.from(document.querySelectorAll('input[placeholder="Community or topic"], input[type="search"]')).some(isVisible);
      const editor = Array.from(document.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"]')).some(isVisible);
      const postButton = Array.from(document.querySelectorAll('[role="button"], button')).some((button) => isVisible(button) && /^post$/i.test(clean(button.innerText || button.textContent || button.getAttribute('aria-label') || '')));
      return topic && editor && postButton;
    `).catch(() => false);
    if (hasComposer) return true;
    await sleep(350);
  }
  return false;
}

async function openThreadsComposer(driver: WebDriver, logs: ThreadsAutoPostRunLog[], observer?: ThreadsAutoPostRunObserver) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (await waitForThreadsComposerWithTopic(driver, 800)) return true;
    const clickedByXpath = await clickThreadsNewThreadButtonByXpath(driver).catch((error) => {
      if (isStaleElementError(error)) return false;
      throw error;
    });
    await sleep(1200);
    if (clickedByXpath && await waitForThreadsComposerWithTopic(driver, 5000)) {
      return true;
    }
    const clickedByScript = await clickThreadsNewThreadButton(driver, 5000).catch((error) => {
      if (isStaleElementError(error)) return false;
      throw error;
    });
    await sleep(1200);
    if (clickedByScript && await waitForThreadsComposerWithTopic(driver, 5000)) {
      return true;
    }
  }
  return false;
}

async function findThreadsComposerScope(driver: WebDriver, timeoutMs = 15000) {
  const script = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const candidates = [];
    for (const element of document.querySelectorAll('[role="dialog"], div')) {
      if (!isVisible(element)) continue;
      const text = clean(element.innerText || element.textContent || '');
      if (!/new thread/i.test(text)) continue;
      const hasTopic = Boolean(element.querySelector('input[placeholder="Community or topic"], input[type="search"]'));
      const hasEditor = Boolean(element.querySelector('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"]'));
      const hasPost = /\\bPost\\b/.test(text);
      const rect = element.getBoundingClientRect();
      let score = 0;
      if (hasTopic) score += 80;
      if (hasEditor) score += 120;
      if (hasPost) score += 80;
      if (element.getAttribute('role') === 'dialog') score += 50;
      if (rect.width > 350 && rect.height > 250) score += 20;
      if (score > 0) candidates.push({ element, score, area: rect.width * rect.height });
    }
    candidates.sort((a, b) => b.score - a.score || a.area - b.area);
    return candidates[0]?.element || null;
  `;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const scope = await executeBrowserScript<WebElement | null>(driver, script);
    if (scope) return scope;
    await sleep(400);
  }
  return null;
}

async function findThreadsTopicInput(driver: WebDriver, scope: WebElement, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const input = await executeBrowserScript<WebElement | null>(driver, `
      const scope = arguments[0];
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const inScope = Array.from(scope.querySelectorAll('input[placeholder="Community or topic"], input[type="search"]')).filter(isVisible)[0];
      if (inScope) return inScope;
      return Array.from(document.querySelectorAll('input[placeholder="Community or topic"], input[type="search"]')).filter(isVisible)[0] || null;
    `, scope).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (input) return input;
    await sleep(300);
  }
  return null;
}

async function findThreadsPostTextboxByIndex(driver: WebDriver, scope: WebElement, textboxIndex = 0, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const textbox = await executeBrowserScript<WebElement | null>(driver, `
      const scope = arguments[0];
      const textboxIndex = Number(arguments[1] || 0);
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const candidates = Array.from(scope.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
        .filter(isVisible)
        .filter((element) => {
          const label = String(element.getAttribute('aria-label') || element.getAttribute('aria-placeholder') || element.textContent || '').toLowerCase();
          return !/community or topic|comment|reply/.test(label);
        });
      const best = candidates[textboxIndex] || null;
      best?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      best?.focus?.();
      return best;
    `, scope, textboxIndex).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (textbox) return textbox;
    await sleep(300);
  }
  return null;
}

async function findThreadsPostTextbox(driver: WebDriver, scope: WebElement, timeoutMs = 10000) {
  return findThreadsPostTextboxByIndex(driver, scope, 0, timeoutMs);
}

async function findThreadsSayMoreTextbox(driver: WebDriver, scope: WebElement, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const textbox = await executeBrowserScript<WebElement | null>(driver, `
      const scope = arguments[0];
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const candidates = Array.from(scope.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
        .filter(isVisible)
        .map((element) => {
          const placeholder = clean(element.getAttribute('aria-placeholder'));
          const label = clean(element.getAttribute('aria-label'));
          const text = clean(element.innerText || element.textContent || '');
          const rect = element.getBoundingClientRect();
          return { element, placeholder, label, text, top: rect.top };
        })
        .filter((candidate) => {
          if (!/say more/.test(candidate.placeholder)) return false;
          return !/community or topic|comment|reply|what's new/.test([candidate.label, candidate.text].join(' '));
        });
      candidates.sort((a, b) => {
        const emptyA = a.text ? 0 : 1;
        const emptyB = b.text ? 0 : 1;
        return emptyB - emptyA || b.top - a.top;
      });
      const best = candidates[0]?.element || null;
      best?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      best?.focus?.();
      return best;
    `, scope).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (textbox) return textbox;
    await sleep(300);
  }
  return null;
}

async function focusThreadsTextbox(driver: WebDriver, textbox: WebElement) {
  await driver.executeScript(`
    const element = arguments[0];
    element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    element.focus?.();
    const selection = window.getSelection();
    if (selection && element.isContentEditable) {
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    element.focus?.();
  `, textbox);
  await sleep(150);
}

async function fillThreadsTextbox(driver: WebDriver, textbox: WebElement, content: string) {
  await focusThreadsTextbox(driver, textbox);
  await textbox.sendKeys(Key.chord(Key.CONTROL, "a"), Key.BACK_SPACE);
  await sleep(250);
  await focusThreadsTextbox(driver, textbox);
  await textbox.sendKeys(content);
  await sleep(900);
  return executeBrowserScript<boolean>(driver, `
    const element = arguments[0];
    const content = arguments[1];
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const expected = clean(content);
    const current = clean(element.innerText || element.textContent || element.value);
    if (current === expected) return true;
    element.focus?.();
    if ('value' in element) {
      element.value = content;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return clean(element.value) === expected;
    }
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('delete', false);
    const inserted = document.execCommand('insertText', false, content);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: content }));
    return inserted || clean(element.innerText || element.textContent) === expected;
  `, textbox, content);
}

async function pasteThreadsTextbox(driver: WebDriver, textbox: WebElement, content: string) {
  await focusThreadsTextbox(driver, textbox);
  await textbox.sendKeys(Key.chord(Key.CONTROL, "a"), Key.BACK_SPACE);
  await sleep(250);
  await focusThreadsTextbox(driver, textbox);
  const pasted = await executeBrowserScript<boolean>(driver, `
    const element = arguments[0];
    const content = arguments[1];
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const expected = clean(content);
    element.focus?.();

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    let dataTransfer = null;
    try {
      dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', content);
      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dataTransfer
      });
      element.dispatchEvent(pasteEvent);
    } catch {
      dataTransfer = null;
    }

    const currentAfterPasteEvent = clean(element.innerText || element.textContent || element.value);
    if (currentAfterPasteEvent === expected) return true;

    document.execCommand('insertText', false, content);
    element.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertFromPaste',
      data: content
    }));
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertFromPaste',
      data: content
    }));

    if (clean(element.innerText || element.textContent || element.value) === expected) return true;

    if ('value' in element) {
      element.value = content;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return clean(element.value) === expected;
    }

    return false;
  `, textbox, content);
  await sleep(900);
  return pasted;
}

async function fillThreadsPostChunkInDom(driver: WebDriver, chunkIndex: number, content: string) {
  const filled = await executeBrowserScript<boolean>(driver, `
    const chunkIndex = Number(arguments[0] || 0);
    const content = String(arguments[1] || '');
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const focusEditor = (element) => {
      element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      element.focus?.();
      const selection = window.getSelection();
      if (selection && element.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      element.focus?.();
    };
    const allEditors = Array.from(document.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
      .filter(isVisible)
      .map((element) => {
        const placeholder = clean(element.getAttribute('aria-placeholder')).toLowerCase();
        const label = clean(element.getAttribute('aria-label')).toLowerCase();
        const text = clean(element.innerText || element.textContent || element.value);
        const rect = element.getBoundingClientRect();
        return { element, placeholder, label, text, top: rect.top };
      })
      .filter((candidate) => !/community or topic|comment|reply/.test([candidate.placeholder, candidate.label].join(' ')));
    const candidates = chunkIndex === 0
      ? allEditors.filter((candidate) => !/say more/.test(candidate.placeholder))
      : allEditors.filter((candidate) => /say more/.test(candidate.placeholder));
    candidates.sort((a, b) => {
      const emptyA = a.text ? 0 : 1;
      const emptyB = b.text ? 0 : 1;
      return emptyB - emptyA || b.top - a.top;
    });
    const target = candidates[0]?.element || null;
    if (!target) return false;

    focusEditor(target);
    document.execCommand('selectAll', false);
    document.execCommand('delete', false);
    focusEditor(target);

    if (chunkIndex > 0) {
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.setData('text/plain', content);
        target.dispatchEvent(new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer
        }));
      } catch {
        // Fall through to insertText below.
      }
    }

    if (clean(target.innerText || target.textContent || target.value) !== clean(content)) {
      document.execCommand('insertText', false, content);
      target.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        cancelable: true,
        inputType: chunkIndex > 0 ? 'insertFromPaste' : 'insertText',
        data: content
      }));
      target.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: chunkIndex > 0 ? 'insertFromPaste' : 'insertText',
        data: content
      }));
    }

    if ('value' in target && clean(target.value) !== clean(content)) {
      target.value = content;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return clean(target.innerText || target.textContent || target.value) === clean(content);
  `, chunkIndex, content).catch((error) => {
    if (isStaleElementError(error)) return false;
    throw error;
  });
  await sleep(900);
  return filled;
}

async function clickThreadsAddToThreadButtonInDom(driver: WebDriver, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, `
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const candidates = [];
      for (const element of document.querySelectorAll('[role="button"], button')) {
        if (!isVisible(element)) continue;
        const label = clean(element.innerText || element.textContent || element.getAttribute('aria-label'));
        const disabled = element.getAttribute('aria-disabled') === 'true' || element.getAttribute('disabled') !== null || element.closest('[aria-disabled="true"]') || element.getAttribute('tabindex') === '-1';
        let score = 0;
        if (/^add to thread$/i.test(label)) score += 200;
        if (/add to thread/i.test(label)) score += 90;
        if (/post options|post$|cancel|draft/i.test(label)) score -= 120;
        if (disabled) score -= 500;
        if (score > 0) candidates.push({ element, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      const button = candidates[0]?.element || null;
      button?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      return button;
    `).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (button) {
      await clickElement(driver, button).catch((error) => {
        if (!isStaleElementError(error)) throw error;
      });
      await sleep(700);
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function clickThreadsPostButtonInDom(driver: WebDriver, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const clicked = await executeBrowserScript<boolean>(driver, `
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const candidates = [];
      for (const element of document.querySelectorAll('[role="button"], button')) {
        if (!isVisible(element)) continue;
        const label = clean([element.getAttribute('aria-label'), element.innerText, element.textContent].filter(Boolean).join(' '));
        const disabled = element.getAttribute('aria-disabled') === 'true' || element.getAttribute('disabled') !== null || element.closest('[aria-disabled="true"]') || element.getAttribute('tabindex') === '-1';
        let score = 0;
        if (/^post$/i.test(label)) score += 200;
        if (/\\bpost\\b/i.test(label)) score += 80;
        if (/cancel|draft|more|post options|add to thread/i.test(label)) score -= 160;
        if (disabled) score -= 500;
        if (score > 0) candidates.push({ element, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      const button = candidates[0]?.element || null;
      if (!button) return false;
      button.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const target = document.elementFromPoint(x, y)?.closest?.('[role="button"], button') || button;
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        target.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0
        }));
      }
      return true;
    `).catch((error) => {
      if (isStaleElementError(error)) return false;
      throw error;
    });
    if (clicked) return true;
    await sleep(500);
  }
  return false;
}

function countThreadsPostCharacters(content: string) {
  return Array.from(content).length;
}

function normalizeThreadsPostContent(content: string) {
  return String(content || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u2028\u2029]/g, " ")
    .trim();
}

function splitThreadsPostIntoSentenceChunks(content: string, maxLength = THREADS_POST_CHUNK_LIMIT) {
  const normalized = normalizeThreadsPostContent(content);
  if (!normalized) return [];

  const sentenceParts = normalized
    .split(/\n+/u)
    .flatMap((line) => line.match(/[^.!?\u3002\uFF01\uFF1F]+[.!?\u3002\uFF01\uFF1F]*/gu) || [line])
    .map((item) => item.trim())
    .filter(Boolean);
  const parts = sentenceParts.length ? sentenceParts : [normalized];
  const chunks: string[] = [];
  let current = "";

  const pushPart = (part: string) => {
    if (!current) {
      current = part;
      return;
    }
    const next = `${current} ${part}`;
    if (countThreadsPostCharacters(next) <= maxLength) {
      current = next;
      return;
    }
    chunks.push(current);
    current = part;
  };

  for (const sentence of parts) {
    if (countThreadsPostCharacters(sentence) <= maxLength) {
      pushPart(sentence);
      continue;
    }

    for (const subChunk of splitLongSentenceIntoThreadsChunks(sentence, maxLength)) {
      pushPart(subChunk);
    }
  }

  if (current) chunks.push(current);
  return chunks.filter((chunk) => countThreadsPostCharacters(chunk) <= maxLength);
}

async function findThreadsTextboxByPlaceholder(driver: WebDriver, placeholderText: string, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const textbox = await executeBrowserScript<WebElement | null>(driver, `
      const placeholderText = String(arguments[0] || '').toLowerCase();
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const candidates = Array.from(document.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
        .filter(isVisible)
        .map((element) => {
          const placeholder = clean(element.getAttribute('aria-placeholder'));
          const label = clean(element.getAttribute('aria-label'));
          const text = clean(element.innerText || element.textContent || element.value);
          const rect = element.getBoundingClientRect();
          return { element, placeholder, label, text, top: rect.top };
        })
        .filter((candidate) => candidate.placeholder === placeholderText && !/community or topic|comment|reply/.test(candidate.label));
      candidates.sort((a, b) => {
        const emptyA = a.text ? 0 : 1;
        const emptyB = b.text ? 0 : 1;
        return emptyB - emptyA || b.top - a.top;
      });
      const target = candidates[0]?.element || null;
      target?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      target?.focus?.();
      return target;
    `, placeholderText).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (textbox) return textbox;
    await sleep(300);
  }
  return null;
}

async function focusThreadsTextboxByPlaceholderInDom(driver: WebDriver, placeholderText: string, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const focused = await executeBrowserScript<boolean>(driver, `
      const placeholderText = String(arguments[0] || '').toLowerCase();
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const candidates = Array.from(document.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
        .filter(isVisible)
        .map((element) => {
          const placeholder = clean(element.getAttribute('aria-placeholder'));
          const label = clean(element.getAttribute('aria-label'));
          const text = clean(element.innerText || element.textContent || element.value);
          const rect = element.getBoundingClientRect();
          return { element, placeholder, label, text, top: rect.top };
        })
        .filter((candidate) => candidate.placeholder === placeholderText && !/community or topic|comment|reply/.test(candidate.label));
      candidates.sort((a, b) => {
        const emptyA = a.text ? 0 : 1;
        const emptyB = b.text ? 0 : 1;
        return emptyB - emptyA || b.top - a.top;
      });
      const target = candidates[0]?.element || null;
      if (!target) return false;

      target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      const rect = target.getBoundingClientRect();
      const x = Math.min(Math.max(rect.left + Math.min(24, Math.max(4, rect.width / 2)), 0), window.innerWidth - 1);
      const y = Math.min(Math.max(rect.top + Math.min(16, Math.max(4, rect.height / 2)), 0), window.innerHeight - 1);
      const clickTarget = document.elementFromPoint(x, y) || target;
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        clickTarget.dispatchEvent(new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0
        }));
      }
      target.focus?.();
      const selection = window.getSelection();
      if (selection && target.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return document.activeElement === target || target.contains(document.activeElement);
    `, placeholderText).catch((error) => {
      if (isStaleElementError(error)) return false;
      throw error;
    });
    if (focused) return true;
    await sleep(300);
  }
  return false;
}

async function countThreadsTextboxesByPlaceholderInDom(driver: WebDriver, placeholderText: string) {
  return executeBrowserScript<number>(driver, `
    const placeholderText = String(arguments[0] || '').toLowerCase();
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return Array.from(document.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
      .filter(isVisible)
      .filter((element) => {
        const placeholder = clean(element.getAttribute('aria-placeholder'));
        const label = clean(element.getAttribute('aria-label'));
        return placeholder === placeholderText && !/community or topic|comment|reply/.test(label);
      }).length;
  `, placeholderText).catch((error) => {
    if (isStaleElementError(error)) return 0;
    throw error;
  });
}

async function findNewestThreadsTextboxByPlaceholderInDom(
  driver: WebDriver,
  placeholderText: string,
  minCount = 1,
  timeoutMs = 10000
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const textbox = await executeBrowserScript<WebElement | null>(driver, `
      const placeholderText = String(arguments[0] || '').toLowerCase();
      const minCount = Number(arguments[1] || 1);
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const candidates = Array.from(document.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
        .filter(isVisible)
        .map((element) => {
          const placeholder = clean(element.getAttribute('aria-placeholder'));
          const label = clean(element.getAttribute('aria-label'));
          const text = clean(element.innerText || element.textContent || element.value);
          const rect = element.getBoundingClientRect();
          return { element, placeholder, label, text, top: rect.top };
        })
        .filter((candidate) => candidate.placeholder === placeholderText && !/community or topic|comment|reply/.test(candidate.label));
      if (candidates.length < minCount) return null;
      candidates.sort((a, b) => {
        const emptyA = a.text ? 0 : 1;
        const emptyB = b.text ? 0 : 1;
        return emptyB - emptyA || b.top - a.top;
      });
      const target = candidates[0]?.element || null;
      target?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      return target;
    `, placeholderText, minCount).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (textbox) return textbox;
    await sleep(300);
  }
  return null;
}

async function findThreadsPostEditorByPositionInDom(driver: WebDriver, position: "first" | "last", minCount = 1, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const editor = await executeBrowserScript<WebElement | null>(driver, `
      const position = String(arguments[0] || 'last');
      const minCount = Number(arguments[1] || 1);
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const editors = Array.from(document.querySelectorAll('div[data-lexical-editor="true"][contenteditable="true"], [data-lexical-editor="true"][contenteditable="true"], [contenteditable="true"][role="textbox"]'))
        .filter(isVisible)
        .filter((element) => {
          const placeholder = clean(element.getAttribute('aria-placeholder'));
          const label = clean(element.getAttribute('aria-label'));
          return !/community or topic|comment|reply/.test(placeholder + ' ' + label);
        })
        .sort((a, b) => {
          const rectA = a.getBoundingClientRect();
          const rectB = b.getBoundingClientRect();
          return rectA.top - rectB.top;
        });
      if (editors.length < minCount) return null;
      const target = position === 'first' ? editors[0] : editors[editors.length - 1];
      target?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      return target || null;
    `, position, minCount).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (editor) return editor;
    await sleep(300);
  }
  return null;
}

async function countThreadsPostEditorsInDom(driver: WebDriver) {
  return executeBrowserScript<number>(driver, `
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim().toLowerCase();
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return Array.from(document.querySelectorAll('div[data-lexical-editor="true"][contenteditable="true"], [data-lexical-editor="true"][contenteditable="true"], [contenteditable="true"][role="textbox"]'))
      .filter(isVisible)
      .filter((element) => {
        const placeholder = clean(element.getAttribute('aria-placeholder'));
        const label = clean(element.getAttribute('aria-label'));
        return !/community or topic|comment|reply/.test(placeholder + ' ' + label);
      }).length;
  `).catch((error) => {
    if (isStaleElementError(error)) return 0;
    throw error;
  });
}

async function clickThreadsAddToThreadAndFindNewTextbox(driver: WebDriver, timeoutMs = 12000) {
  const beforeCount = await countThreadsPostEditorsInDom(driver);
  const clickedAddToThread = await clickThreadsAddToThreadButtonInDom(driver, timeoutMs);
  if (!clickedAddToThread) return null;
  await sleep(900);
  return findThreadsPostEditorByPositionInDom(driver, "last", beforeCount + 1, timeoutMs);
}

async function fillThreadsTextboxElementInDom(driver: WebDriver, textbox: WebElement, content: string, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const filled = await executeBrowserScript<boolean>(driver, `
      const target = arguments[0];
      const content = String(arguments[1] || '');
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      if (!target) return false;

      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus?.();
      let inserted = false;
      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(target);
        selection.removeAllRanges();
        selection.addRange(range);

        document.execCommand('delete', false);
        document.execCommand('insertText', false, content);
        inserted = true;
      } catch {
        inserted = false;
      }

      if (!inserted || clean(target.innerText || target.textContent || target.value) !== clean(content)) {
        target.textContent = '';
        target.dispatchEvent(new InputEvent('input', { bubbles: true }));
        target.textContent = content;
        target.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: content
        }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if ('value' in target && clean(target.value) !== clean(content)) {
        target.value = content;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
      target.focus?.();
      return clean(target.innerText || target.textContent || target.value) === clean(content);
    `, textbox, content).catch((error) => {
      if (isStaleElementError(error)) return false;
      throw error;
    });
    if (filled) {
      await sleep(900);
      return true;
    }
    await sleep(400);
  }
  return false;
}

async function fillThreadsTextboxByPlaceholderInDom(driver: WebDriver, placeholderText: string, content: string, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const filled = await executeBrowserScript<boolean>(driver, `
      const placeholderText = String(arguments[0] || '').toLowerCase();
      const content = String(arguments[1] || '');
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const focusEditor = (element) => {
        element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        element.focus?.();
        const selection = window.getSelection();
        if (selection && element.isContentEditable) {
          const range = document.createRange();
          range.selectNodeContents(element);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        element.focus?.();
      };
      const editors = Array.from(document.querySelectorAll('[data-lexical-editor="true"], [contenteditable="true"][role="textbox"], [contenteditable="true"], [role="textbox"]'))
        .filter(isVisible)
        .map((element) => {
          const placeholder = clean(element.getAttribute('aria-placeholder')).toLowerCase();
          const label = clean(element.getAttribute('aria-label')).toLowerCase();
          const text = clean(element.innerText || element.textContent || element.value);
          const rect = element.getBoundingClientRect();
          return { element, placeholder, label, text, top: rect.top };
        })
        .filter((candidate) => candidate.placeholder === placeholderText && !/community or topic|comment|reply/.test(candidate.label));
      editors.sort((a, b) => {
        const emptyA = a.text ? 0 : 1;
        const emptyB = b.text ? 0 : 1;
        return emptyB - emptyA || b.top - a.top;
      });
      const target = editors[0]?.element || null;
      if (!target) return false;

      focusEditor(target);
      const selectionForDelete = window.getSelection();
      if (selectionForDelete && target.isContentEditable) {
        const deleteRange = document.createRange();
        deleteRange.selectNodeContents(target);
        selectionForDelete.removeAllRanges();
        selectionForDelete.addRange(deleteRange);
      }
      document.execCommand('delete', false);
      focusEditor(target);
      document.execCommand('insertText', false, content);
      target.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: null
      }));
      if ('value' in target && clean(target.value) !== clean(content)) {
        target.value = content;
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return clean(target.innerText || target.textContent || target.value) === clean(content);
    `, placeholderText, content).catch((error) => {
      if (isStaleElementError(error)) return false;
      throw error;
    });
    if (filled) {
      await sleep(900);
      return true;
    }
    await sleep(400);
  }
  return false;
}

async function getThreadsTextboxText(driver: WebDriver, textbox: WebElement) {
  return executeBrowserScript<string>(driver, `
    const element = arguments[0];
    return String(element.innerText || element.textContent || element.value || '').replace(/\\s+/g, ' ').trim();
  `, textbox);
}

async function clearThreadsTextbox(driver: WebDriver, textbox: WebElement) {
  await textbox.click();
  await driver.actions({ async: true }).keyDown(Key.CONTROL).sendKeys("a").keyUp(Key.CONTROL).sendKeys(Key.BACK_SPACE).perform();
  await sleep(250);
}

async function fillThreadsCommentTextboxLikeFacebook(driver: WebDriver, textbox: WebElement, content: string) {
  const safeContent = sanitizeAutomationText(content);
  const expected = safeContent.replace(/\s+/g, " ").trim();
  await driver.executeScript("arguments[0].scrollIntoView({behavior:'instant', block:'center', inline:'center'});", textbox);
  await clearThreadsTextbox(driver, textbox);

  await textbox.sendKeys(safeContent);
  await sleep(700);
  let current = await getThreadsTextboxText(driver, textbox);
  if (current === expected) return true;

  await clearThreadsTextbox(driver, textbox);
  await textbox.sendKeys(safeContent);
  await sleep(700);
  current = await getThreadsTextboxText(driver, textbox);
  return current === expected;
}

async function findThreadsEnabledPostButton(driver: WebDriver, scope: WebElement, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, `
      const scope = arguments[0];
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const candidates = [];
      for (const element of scope.querySelectorAll('[role="button"], button')) {
        if (!isVisible(element)) continue;
        const label = clean([element.getAttribute('aria-label'), element.innerText, element.textContent].filter(Boolean).join(' '));
        const disabled = element.getAttribute('aria-disabled') === 'true' || element.getAttribute('disabled') !== null || element.closest('[aria-disabled="true"]');
        let score = 0;
        if (/^post$/i.test(label)) score += 200;
        if (/\\bpost\\b/i.test(label)) score += 80;
        if (/cancel|draft|more|post options|add to thread/i.test(label)) score -= 160;
        if (disabled) score -= 500;
        if (score > 0) candidates.push({ element, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0]?.element || null;
      best?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      return best;
    `, scope).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (button) return button;
    await sleep(500);
  }
  return null;
}

async function findThreadsEnabledAddToThreadButton(driver: WebDriver, scope: WebElement, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, `
      const scope = arguments[0];
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
      const candidates = [];
      for (const element of scope.querySelectorAll('[role="button"], button')) {
        if (!isVisible(element)) continue;
        const label = clean([element.getAttribute('aria-label'), element.innerText, element.textContent].filter(Boolean).join(' '));
        const disabled = element.getAttribute('aria-disabled') === 'true' || element.getAttribute('disabled') !== null || element.closest('[aria-disabled="true"]') || element.getAttribute('tabindex') === '-1';
        let score = 0;
        if (/^add to thread$/i.test(label)) score += 200;
        if (/add to thread/i.test(label)) score += 90;
        if (/post options|post$|cancel|draft/i.test(label)) score -= 120;
        if (disabled) score -= 500;
        if (score > 0) candidates.push({ element, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      const best = candidates[0]?.element || null;
      best?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      return best;
    `, scope).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (button) return button;
    await sleep(500);
  }
  return null;
}

async function clickVisibleThreadsPostButtonWithSelenium(driver: WebDriver, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = await executeBrowserScript<WebElement | null>(driver, `
      const isVisible = (element) => {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const visibleOverlay = Array.from(document.querySelectorAll('[aria-hidden="false"]'))
        .find((element) => isVisible(element) && String(element.innerText || element.textContent || '').includes('New thread'));
      const root = visibleOverlay || document;
      const candidates = Array.from(root.querySelectorAll('div[role="button"], button'))
        .filter((element) => isVisible(element))
        .filter((element) => String(element.innerText || element.textContent || '').trim() === 'Post')
        .filter((element) => element.getAttribute('aria-disabled') !== 'true'
          && element.getAttribute('disabled') === null
          && !element.closest('[aria-disabled="true"]'));
      candidates.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return rectB.top - rectA.top || rectB.left - rectA.left;
      });
      const target = candidates[0] || null;
      target?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      return target;
    `).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (button) {
      await clickElement(driver, button).catch((error) => {
        if (!isStaleElementError(error)) throw error;
      });
      await sleep(2000);
      const stillOpen = await executeBrowserScript<boolean>(driver, `
        const isVisible = (element) => {
          if (!element) return false;
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        };
        return Boolean(Array.from(document.querySelectorAll('[aria-hidden="false"]'))
          .find((element) => isVisible(element) && String(element.innerText || element.textContent || '').includes('New thread')));
      `).catch((error) => {
        if (isStaleElementError(error)) return false;
        throw error;
      });
      if (!stillOpen) return true;
    }
    await sleep(500);
  }
  return false;
}

async function runOneThreadsPostConsoleFlow(driver: WebDriver, topic: string, content: string, logs: ThreadsAutoPostRunLog[], observer?: ThreadsAutoPostRunObserver) {
  await driver.get("https://www.threads.com/?hl=en");
  await waitForThreadsReady(driver);

  const result = await executeBrowserAsyncScript<{ chunksCount: number; topic: string; posted: boolean }>(driver, `
    const NOI_DUNG = String(arguments[0] || '');
    const TOPIC = String(arguments[1] || '');
    const MAX_CHUNK = Number(arguments[2] || 440);

    function sleep(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function clickElement(el) {
      if (!el) throw new Error('Không tìm thấy element');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.click();
    }

    async function setInputValue(input, text) {
      input.focus();
      await sleep(150);

      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;

      nativeInputValueSetter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      await sleep(100);
    }

    async function setLexicalText(editor, text) {
      if (!editor) throw new Error('Editor không tồn tại');
      editor.focus();
      await sleep(150);

      try {
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        selection.removeAllRanges();
        selection.addRange(range);
        document.execCommand('delete', false, null);
        await sleep(80);
        document.execCommand('insertText', false, text);
      } catch (error) {
        console.warn('Cách 1 lỗi, chuyển sang cách 2');
      }

      await sleep(100);
      if (String(editor.innerText || '').trim() !== String(text || '').trim()) {
        editor.textContent = '';
        editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
        await sleep(50);
        editor.textContent = text;
        editor.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: 'insertText',
          data: text
        }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
      }

      editor.focus();
    }

    function chiaChunkTheoCau(text, maxLen = MAX_CHUNK) {
      const cleanText = String(text || '')
        .replace(/\\r\\n/g, '\\n')
        .replace(/\\n{2,}/g, '\\n')
        .trim();

      let cauList = cleanText
        .split(/(?<=[.!?…])\\s+/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (cauList.length <= 1) {
        cauList = cleanText.split(/\\n+/).map((item) => item.trim()).filter(Boolean);
      }

      console.log('Danh sách câu:', cauList);

      const chunks = [];
      let current = '';
      for (let cau of cauList) {
        while (cau.length > maxLen) {
          if (current) {
            chunks.push(current);
            current = '';
          }
          chunks.push(cau.slice(0, maxLen).trim());
          cau = cau.slice(maxLen).trim();
        }

        const next = current ? current + ' ' + cau : cau;
        if (next.length <= maxLen) {
          current = next;
        } else {
          if (current) chunks.push(current);
          current = cau;
        }
      }
      if (current) chunks.push(current);
      console.log('Tổng cộng ' + chunks.length + ' chunk:', chunks);
      return chunks;
    }

    async function waitFor(getter, timeoutMs, intervalMs = 300) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const value = getter();
        if (value) return value;
        await sleep(intervalMs);
      }
      return null;
    }

    const newThreadBtn = await waitFor(() => Array.from(document.querySelectorAll('div[role="button"], button'))
      .find((el) => String(el.innerText || el.textContent || '').includes('New thread')), 15000);
    if (!newThreadBtn) throw new Error('Không tìm thấy nút New thread');
    clickElement(newThreadBtn);
    await sleep(1800);

    const communityInput = await waitFor(() => document.querySelector('input[placeholder="Community or topic"]'), 10000);
    if (!communityInput) throw new Error('Không tìm thấy ô Community');
    clickElement(communityInput);
    await sleep(500);
    if (TOPIC) {
      await setInputValue(communityInput, TOPIC);
      await sleep(1200);
    }

    const chunks = chiaChunkTheoCau(NOI_DUNG, MAX_CHUNK);
    if (!chunks.length) throw new Error('Không có chunk');

    await sleep(800);
    let editors = Array.from(document.querySelectorAll('div[data-lexical-editor="true"][contenteditable="true"]'));
    let editor = editors[0] || document.querySelector('[contenteditable="true"]');
    if (!editor) throw new Error('Không tìm thấy editor đầu tiên');
    await setLexicalText(editor, chunks[0]);
    await sleep(1200);

    for (let i = 1; i < chunks.length; i += 1) {
      const addBtn = await waitFor(() => Array.from(document.querySelectorAll('div[role="button"], button'))
        .find((el) => String(el.innerText || el.textContent || '').trim() === 'Add to thread'), 12000);
      if (!addBtn) throw new Error('Không tìm thấy nút Add to thread');
      clickElement(addBtn);
      await sleep(1600);

      editors = Array.from(document.querySelectorAll('div[data-lexical-editor="true"][contenteditable="true"]'));
      const lastEditor = editors[editors.length - 1];
      if (!lastEditor) throw new Error('Không tìm thấy editor chunk ' + (i + 1));
      await setLexicalText(lastEditor, chunks[i]);
      await sleep(1200);
    }

    console.log('Xong tất cả chunk! Không tự Post trong script.');
    return { chunksCount: chunks.length, topic: TOPIC, posted: false };
  `, sanitizeAutomationText(content), sanitizeAutomationText(topic), 440);

  if (!result?.posted) {
    const clickedPost = await clickVisibleThreadsPostButtonWithSelenium(driver, 12000);
    if (!clickedPost) throw new Error("Không click được nút Post sau khi nhập xong nội dung.");
  }
  await sleepRandom(2500, 5000);
}

async function runOneThreadsPost(driver: WebDriver, topic: string, content: string, logs: ThreadsAutoPostRunLog[], observer?: ThreadsAutoPostRunObserver) {
  await driver.get("https://www.threads.com/?hl=en");
  await waitForThreadsReady(driver);

  const openedComposer = await openThreadsComposer(driver, logs, observer);
  if (!openedComposer) throw new Error("Không tìm thấy nút New thread trong menu Threads.");
  await sleep(900);

  let scope = await findThreadsComposerScope(driver);
  if (!scope) throw new Error("Không tìm thấy khung New thread.");

  const topicText = sanitizeAutomationText(topic);
  if (topicText) {
    let topicInput = await findThreadsTopicInput(driver, scope, 10000);
    if (!topicInput) {
      const reopened = await openThreadsComposer(driver, logs, observer);
      if (reopened) {
        await sleep(700);
        scope = await findThreadsComposerScope(driver) || scope;
        topicInput = await findThreadsTopicInput(driver, scope, 8000);
      }
    }
    if (!topicInput) throw new Error("Không tìm thấy ô Community or topic.");

    await clickElement(driver, topicInput).catch(async (error) => {
      if (!isStaleElementError(error)) throw error;
      const freshScope = await findThreadsComposerScope(driver);
      if (!freshScope) throw error;
      scope = freshScope;
      const freshTopicInput = await findThreadsTopicInput(driver, freshScope, 5000);
      if (!freshTopicInput) throw error;
      topicInput = freshTopicInput;
      await clickElement(driver, freshTopicInput);
    });
    await topicInput.sendKeys(Key.chord(Key.CONTROL, "a"), Key.BACK_SPACE);
    await sleep(200);
    await topicInput.sendKeys(topicText);
    await sleep(900);
    await driver.actions({ async: true }).sendKeys(Key.ENTER).perform();
    await sleep(1300);
  }

  const chunks = splitThreadsPostIntoSentenceChunks(content, THREADS_POST_CHUNK_LIMIT);
  if (!chunks.length) throw new Error("Không có nội dung post Threads.");
  if (chunks.length > 1) {
    addThreadsRunLog(logs, "info", `Nội dung dài, tự chia thành ${chunks.length} phần dưới 450 ký tự.`, observer);
  }

  const firstTextbox = await findThreadsPostEditorByPositionInDom(driver, "first", 1, 12000);
  if (!firstTextbox) throw new Error("Không tìm thấy ô What's new.");

  const typedFirstChunk = await fillThreadsTextboxElementInDom(driver, firstTextbox, chunks[0], 12000);
  if (!typedFirstChunk) throw new Error("Không nhập được nội dung post phần 1.");

  for (let chunkIndex = 1; chunkIndex < chunks.length; chunkIndex += 1) {
    const nextTextbox = await clickThreadsAddToThreadAndFindNewTextbox(driver, 12000);
    if (!nextTextbox) throw new Error(`Không mở được ô Say more phần ${chunkIndex + 1}.`);
    await clickElement(driver, nextTextbox).catch((error) => {
      if (!isStaleElementError(error)) throw error;
    });
    await sleep(300);
    const typedChunk = await fillThreadsTextboxElementInDom(driver, nextTextbox, chunks[chunkIndex], 12000);
    if (!typedChunk) throw new Error(`Không nhập được nội dung post phần ${chunkIndex + 1}.`);
  }

  for (let chunkIndex = chunks.length; chunkIndex < chunks.length; chunkIndex += 1) {
    const placeholder = chunkIndex === 0 ? "what's new?" : "say more...";
    if (chunkIndex > 0) {
      const focusedSayMore = await focusThreadsTextboxByPlaceholderInDom(driver, placeholder, 12000);
      if (!focusedSayMore) throw new Error(`Không click được ô Say more phần ${chunkIndex + 1}.`);
      await sleep(300);
    }
    const typed = await fillThreadsTextboxByPlaceholderInDom(driver, placeholder, chunks[chunkIndex], 12000);
    if (!typed) throw new Error(`Không nhập được nội dung post phần ${chunkIndex + 1}.`);

    if (chunkIndex >= chunks.length - 1) continue;

    const clickedAddToThread = await clickThreadsAddToThreadButtonInDom(driver, 12000);
    if (!clickedAddToThread) throw new Error("Không tìm thấy nút Add to thread đã bật.");
    await sleep(700);
  }

  const clickedPost = await clickThreadsPostButtonInDom(driver, 12000);
  if (!clickedPost) throw new Error("Không tìm thấy nút Post đã bật.");
  await sleepRandom(4500, 8000);
}

type ThreadsFeedReplyTarget = {
  postUrl: string;
  author: string;
};

async function clickThreadsFeedReplyTarget(driver: WebDriver, usedPostUrls: string[], timeoutMs = 25000) {
  const clickScript = `
    const usedPostUrls = new Set(arguments[0] || []);
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const clean = (value) => String(value || '').replace(/\\s+/g, ' ').trim();
    const makeUrl = (href) => {
      try { return href ? new URL(href, location.origin).href : ''; } catch { return ''; }
    };
    const postSet = new Set();
    for (const pagelet of document.querySelectorAll('[data-pagelet^="threads_feed_"]')) {
      for (const post of pagelet.querySelectorAll('[data-pressable-container="true"]')) postSet.add(post);
    }
    if (!postSet.size) {
      for (const svg of document.querySelectorAll('svg[aria-label="Reply"]')) {
        const post = svg.closest('[data-pressable-container="true"]');
        if (post) postSet.add(post);
      }
    }
    const candidates = [];
    for (const post of postSet) {
      if (!isVisible(post)) continue;
      const replySvg = Array.from(post.querySelectorAll('svg[aria-label="Reply"]')).find(isVisible);
      if (!replySvg) continue;
      const button = replySvg.closest('[role="button"], button');
      if (!button || !isVisible(button)) continue;
      const link = post.querySelector('a[href*="/post/"]');
      const postUrl = makeUrl(link?.getAttribute('href') || '');
      if (postUrl && usedPostUrls.has(postUrl)) continue;
      const authorLink = post.querySelector('a[href^="/@"]:not([href*="/post/"])');
      const author = clean(authorLink?.innerText || authorLink?.textContent || '');
      const rect = button.getBoundingClientRect();
      const postRect = post.getBoundingClientRect();
      const inViewport = postRect.bottom > 80 && postRect.top < window.innerHeight - 80;
      const score = (inViewport ? 100 : 0) + Math.max(0, 80 - Math.abs(postRect.top - 160) / 10);
      candidates.push({ button, postUrl: postUrl || location.href, author, score, top: rect.top });
    }
    const visibleCandidates = candidates.filter((candidate) => candidate.score >= 100);
    const pool = visibleCandidates.length ? visibleCandidates : candidates;
    const picked = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    if (!picked) return null;
    picked.button.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    const rect = picked.button.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const target = document.elementFromPoint(x, y)?.closest?.('[role="button"], button') || picked.button;
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        button: 0
      }));
    }
    return { postUrl: picked.postUrl, author: picked.author };
  `;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const target = await executeBrowserScript<ThreadsFeedReplyTarget | null>(driver, clickScript, usedPostUrls).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (target?.postUrl) return target;
    await driver.executeScript("window.scrollBy({ top: Math.max(window.innerHeight * 0.85, 650), behavior: 'instant' });").catch(() => undefined);
    await sleep(1200);
  }
  return null;
}

async function findThreadsReplyTextbox(driver: WebDriver, timeoutMs = 12000) {
  const findScript = `
    const isVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const candidates = [];
    for (const element of document.querySelectorAll('[contenteditable="true"][role="textbox"], [data-lexical-editor="true"], [contenteditable="true"]')) {
      if (!isVisible(element)) continue;
      const label = String(element.getAttribute('aria-placeholder') || element.getAttribute('aria-label') || '').toLowerCase();
      const text = String(element.innerText || element.textContent || '').toLowerCase();
      const dialog = element.closest('[role="dialog"]');
      let score = 0;
      if (label.includes('reply to')) score += 200;
      if (label.includes('empty text field')) score += 80;
      if (dialog) score += 40;
      if (label.includes("what's new") || text.includes("what's new")) score -= 200;
      if (score > 0) candidates.push({ element, score });
    }
    candidates.sort((a, b) => b.score - a.score);
    const picked = candidates[0]?.element || null;
    picked?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
    picked?.focus?.();
    return picked;
  `;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const textbox = await executeBrowserScript<WebElement | null>(driver, findScript).catch((error) => {
      if (isStaleElementError(error)) return null;
      throw error;
    });
    if (textbox) return textbox;
    await sleep(350);
  }
  return null;
}

async function runOneThreadsFeedComment(
  driver: WebDriver,
  content: string,
  usedPostUrls: Set<string>,
  logs: ThreadsAutoPostRunLog[],
  observer?: ThreadsAutoPostRunObserver,
  pageUrl = "https://www.threads.com/?hl=en",
  notFoundMessage = "Kh\u00f4ng t\u00ecm th\u1ea5y n\u00fat comment newfeed Threads.",
  randomScrollBeforePick = false,
  taskType: "newfeed" | "search" = "newfeed"
) {
  await driver.get(pageUrl);
  await waitForThreadsReady(driver);
  await sleep(1500);
  if (randomScrollBeforePick) {
    const scrollCount = Math.floor(Math.random() * 4);
    for (let index = 0; index < scrollCount; index += 1) {
      await driver.executeScript("window.scrollBy({ top: Math.max(window.innerHeight * (0.55 + Math.random() * 0.75), 450), behavior: 'instant' });").catch(() => undefined);
      await sleepRandom(700, 1300);
    }
  }

  const rememberedPostUrls = await Promise.resolve(observer?.getCommentedPostUrls?.() || []).catch(() => []);
  for (const postUrl of rememberedPostUrls) {
    if (postUrl) usedPostUrls.add(postUrl);
  }

  let target = await clickThreadsFeedReplyTarget(driver, [...usedPostUrls]);
  if (!target) throw new Error(notFoundMessage);

  addThreadsRunLog(logs, "info", `\u0110ang comment post Threads: ${target.postUrl}`, observer);
  await sleep(900);

  let textbox = await findThreadsReplyTextbox(driver);
  if (!textbox) throw new Error("Kh\u00f4ng t\u00ecm th\u1ea5y \u00f4 nh\u1eadp reply Threads.");
  const typed = await fillThreadsCommentTextboxLikeFacebook(driver, textbox, content).catch(async (error) => {
    if (!isStaleElementError(error)) throw error;
    const freshTextbox = await findThreadsReplyTextbox(driver, 6000);
    if (!freshTextbox) throw error;
    textbox = freshTextbox;
    return fillThreadsCommentTextboxLikeFacebook(driver, freshTextbox, content);
  });
  if (!typed) throw new Error("Kh\u00f4ng nh\u1eadp \u0111\u01b0\u1ee3c n\u1ed9i dung comment.");
  await sleep(500);
  await textbox.sendKeys(Key.ENTER);
  usedPostUrls.add(target.postUrl);
  await Promise.resolve(observer?.onCommentedPost?.(target.postUrl, taskType)).catch(() => undefined);
  await sleepRandom(3500, 6500);
  return target.postUrl;
}

export async function runThreadsAutoPostActions(config: ThreadsAutoPostRunConfig, observer?: ThreadsAutoPostRunObserver) {
  const logs: ThreadsAutoPostRunLog[] = [];
  const enableGroupPost = config.enableGroupPost !== false;
  const enableFeedComment = config.enableFeedComment === true;
  const enableSearchComment = config.enableSearchComment === true;
  const topics = normalizeThreadsRunItems(config.topics);
  const contents = normalizeThreadsRunItems(config.contents);
  const feedCommentContents = normalizeThreadsRunItems(config.feedCommentContents || []);
  const searchKeywords = normalizeThreadsRunItems(String(config.searchKeyword || "").split(/\r?\n/))
    .map((keyword) => sanitizeAutomationText(keyword))
    .filter((keyword) => keyword.length >= 2);
  const searchCommentContents = normalizeThreadsRunItems(config.searchCommentContents || []);
  const count = Math.max(1, Math.min(500, Math.floor(Number(config.count) || 1)));
  const delaySeconds = Math.max(0, Math.min(3600, Math.floor(Number(config.delaySeconds) || 0)));
  const feedCommentCount = Math.max(1, Math.min(500, Math.floor(Number(config.feedCommentCount) || 1)));
  const feedCommentDelaySeconds = Math.max(0, Math.min(3600, Math.floor(Number(config.feedCommentDelaySeconds) || 0)));
  const searchCommentCount = Math.max(1, Math.min(500, Math.floor(Number(config.searchCommentCount) || 1)));
  const searchCommentDelaySeconds = Math.max(0, Math.min(3600, Math.floor(Number(config.searchCommentDelaySeconds) || 0)));
  const skipCompletedActions = Math.max(0, Math.floor(Number(config.skipCompletedActions) || 0));
  const initialCommentedPostUrls = await Promise.resolve(observer?.getCommentedPostUrls?.() || []).catch(() => []);
  const usedPostUrls = new Set<string>(initialCommentedPostUrls);
  let actionOrdinal = 0;

  async function prepareAction() {
    actionOrdinal += 1;
    if (actionOrdinal <= skipCompletedActions) return false;
    await Promise.resolve(observer?.beforeAction?.());
    throwIfThreadsRunStopped(config.signal);
    return true;
  }

  async function checkThreadsLiveAfterTaskFailures(taskLabel: string) {
    addThreadsRunLog(logs, "warn", `${taskLabel} thất bại 3 lần. Đang check live tài khoản Threads.`, observer);
    const liveInfo = await inspectThreadsCookieWithChrome(config.cookie, config.proxy || "");
    addThreadsRunLog(logs, "info", `Check live Threads: ${liveInfo.status}.`, observer);
    if (liveInfo.status === "active") {
      addThreadsRunLog(logs, "success", "Check live Threads còn hoạt động, bỏ qua tác vụ lỗi và chạy tiếp.", observer);
      return "skipped" as const;
    }
    const statusLabel = liveInfo.status === "checkpoint" ? "checkpoint" : liveInfo.status === "invalid" ? "die" : "không xác định";
    addThreadsRunLog(logs, "error", `Check live Threads: tài khoản ${statusLabel}. Dừng luồng tài khoản này.`, observer);
    return "stop" as const;
  }

  async function runThreadsTaskWithRetry(taskLabel: string, action: () => Promise<void>) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      throwIfThreadsRunStopped(config.signal);
      try {
        await action();
        return "completed" as const;
      } catch (error) {
        throwIfThreadsRunStopped(config.signal);
        const reason = error instanceof Error ? error.message : "Lỗi không xác định";
        addThreadsRunLog(logs, "warn", `${taskLabel} thất bại lần ${attempt}/3: ${reason}`, observer);
        if (attempt < 3) {
          await sleep(1500);
        }
      }
    }
    return checkThreadsLiveAfterTaskFailures(taskLabel);
  }

  if (!config.cookie?.trim()) throw new Error("Thi\u1ebfu cookie Threads.");
  if (!enableGroupPost && !enableFeedComment && !enableSearchComment) throw new Error("B\u1eadt \u00edt nh\u1ea5t m\u1ed9t t\u00e1c v\u1ee5 Threads.");
  if (enableGroupPost && !contents.length) throw new Error("\u0110\u0103ng Post c\u1ea7n \u00edt nh\u1ea5t m\u1ed9t n\u1ed9i dung.");
  if (enableFeedComment && !feedCommentContents.length) throw new Error("Comment newfeed c\u1ea7n \u00edt nh\u1ea5t m\u1ed9t n\u1ed9i dung.");
  if (enableSearchComment && !searchKeywords.length) throw new Error("Comment search c\u1ea7n \u00edt nh\u1ea5t 1 keyword t\u1eeb 2 k\u00fd t\u1ef1.");
  if (enableSearchComment && !searchCommentContents.length) throw new Error("Comment search c\u1ea7n \u00edt nh\u1ea5t m\u1ed9t n\u1ed9i dung.");

  const driver = await buildThreadsDriver(config.proxy || "");
  const abortHandler = () => {
    void driver.quit().catch(() => undefined);
  };
  config.signal?.addEventListener("abort", abortHandler, { once: true });
  try {
    throwIfThreadsRunStopped(config.signal);
    if (config.proxy?.trim()) {
      const proxyCheck = await checkChromeProxyUsage(driver, config.proxy);
      addThreadsRunLog(logs, proxyCheckLogLevel(proxyCheck), formatProxyCheckMessage("Proxy đang dùng", proxyCheck), observer);
      await driver.get("about:blank").catch(() => undefined);
    } else {
      addThreadsRunLog(logs, "info", "Tài khoản này không dùng proxy.", observer);
    }
    throwIfThreadsRunStopped(config.signal);
    addThreadsRunLog(logs, "info", "\u0110ang n\u1ea1p cookie Threads.", observer);
    await loadThreadsCookieIntoDriver(driver, config.cookie);
    throwIfThreadsRunStopped(config.signal);
    await driver.get("https://www.threads.com/?hl=en");
    await waitForThreadsReady(driver);
    throwIfThreadsRunStopped(config.signal);
    addThreadsRunLog(logs, "success", "\u0110\u0103ng nh\u1eadp Threads th\u00e0nh c\u00f4ng.", observer);

    if (config.randomizeTasks) {
      type RunnableThreadsTask =
        | { kind: "post"; index: number; total: number }
        | { kind: "feed-comment"; index: number; total: number }
        | { kind: "search-comment"; index: number; total: number };

      const orderedTasks: RunnableThreadsTask[] = [];
      if (enableGroupPost) {
        for (let index = 0; index < count; index += 1) {
          orderedTasks.push({ kind: "post", index, total: count });
        }
      }
      if (enableFeedComment) {
        for (let index = 0; index < feedCommentCount; index += 1) {
          orderedTasks.push({ kind: "feed-comment", index, total: feedCommentCount });
        }
      }
      if (enableSearchComment) {
        for (let index = 0; index < searchCommentCount; index += 1) {
          orderedTasks.push({ kind: "search-comment", index, total: searchCommentCount });
        }
      }

      const runnableTasks = shuffleItems(orderedTasks);
      let shouldStopAccount = false;
      for (let taskPosition = 0; taskPosition < runnableTasks.length; taskPosition += 1) {
        const task = runnableTasks[taskPosition];
        const hasMoreTasks = taskPosition < runnableTasks.length - 1;
        throwIfThreadsRunStopped(config.signal);
        if (!(await prepareAction())) continue;

        if (task.kind === "post") {
          const topic = topics.length ? randomItem(topics) : "";
          const content = randomItem(contents);
          const taskLabel = `Đăng post Threads ${task.index + 1}/${task.total}`;
          addThreadsRunLog(logs, "info", `Thực hiện tác vụ ${taskLabel}`, observer);
          const result = await runThreadsTaskWithRetry(taskLabel, () => runOneThreadsPostConsoleFlow(driver, topic, content, logs, observer));
          if (result === "stop") {
            shouldStopAccount = true;
          } else if (result === "completed") {
            addThreadsRunLog(logs, "success", `Đã đăng post ${task.index + 1}/${task.total}.`, observer);
          }
          if (!shouldStopAccount && hasMoreTasks && delaySeconds > 0) {
            await waitThreadsRunDelay(delaySeconds, logs, observer);
          }
        } else if (task.kind === "feed-comment") {
          const content = randomItem(feedCommentContents);
          const taskLabel = `Comment newfeed Threads ${task.index + 1}/${task.total}`;
          addThreadsRunLog(logs, "info", `Thực hiện tác vụ ${taskLabel}`, observer);
          const result = await runThreadsTaskWithRetry(taskLabel, () => runOneThreadsFeedComment(driver, content, usedPostUrls, logs, observer, "https://www.threads.com/?hl=en", "Không tìm thấy nút comment newfeed Threads.", false, "newfeed").then(() => undefined));
          if (result === "stop") {
            shouldStopAccount = true;
          } else if (result === "completed") {
            addThreadsRunLog(logs, "success", `Đã comment newfeed ${task.index + 1}/${task.total}.`, observer);
          }
          if (!shouldStopAccount && hasMoreTasks && feedCommentDelaySeconds > 0) {
            await waitThreadsRunDelay(feedCommentDelaySeconds, logs, observer);
          }
        } else {
          const content = randomItem(searchCommentContents);
          const searchKeyword = randomItem(searchKeywords);
          const searchUrl = `https://www.threads.com/search?q=${encodeURIComponent(searchKeyword)}&serp_type=default&hl=en`;
          const taskLabel = `Comment search Threads ${task.index + 1}/${task.total}`;
          addThreadsRunLog(logs, "info", `Thực hiện tác vụ ${taskLabel}`, observer);
          const result = await runThreadsTaskWithRetry(taskLabel, () => runOneThreadsFeedComment(
            driver,
            content,
            usedPostUrls,
            logs,
            observer,
            searchUrl,
            "Không tìm thấy nút comment search Threads.",
            true,
            "search"
          ).then(() => undefined));
          if (result === "stop") {
            shouldStopAccount = true;
          } else if (result === "completed") {
            addThreadsRunLog(logs, "success", `Đã comment search ${task.index + 1}/${task.total}.`, observer);
          }
          if (!shouldStopAccount && hasMoreTasks && searchCommentDelaySeconds > 0) {
            await waitThreadsRunDelay(searchCommentDelaySeconds, logs, observer);
          }
        }

        if (shouldStopAccount) break;
      }

      return { ok: true, logs };
    }

    if (enableGroupPost) {
      for (let index = 0; index < count; index += 1) {
        throwIfThreadsRunStopped(config.signal);
        if (!(await prepareAction())) continue;
        const topic = topics.length ? randomItem(topics) : "";
        const content = randomItem(contents);
        const taskLabel = `Đăng post Threads ${index + 1}/${count}`;
        addThreadsRunLog(logs, "info", `Thực hiện tác vụ ${taskLabel}`, observer);
        const result = await runThreadsTaskWithRetry(taskLabel, () => runOneThreadsPostConsoleFlow(driver, topic, content, logs, observer));
        if (result === "stop") break;
        if (result === "completed") addThreadsRunLog(logs, "success", `Đã đăng post ${index + 1}/${count}.`, observer);
        if (index < count - 1 && delaySeconds > 0) {
          await waitThreadsRunDelay(delaySeconds, logs, observer);
        }
      }
    }

    if (enableFeedComment) {
      for (let index = 0; index < feedCommentCount; index += 1) {
        throwIfThreadsRunStopped(config.signal);
        if (!(await prepareAction())) continue;
        const content = randomItem(feedCommentContents);
        const taskLabel = `Comment newfeed Threads ${index + 1}/${feedCommentCount}`;
        addThreadsRunLog(logs, "info", `Thực hiện tác vụ ${taskLabel}`, observer);
        const result = await runThreadsTaskWithRetry(taskLabel, () => runOneThreadsFeedComment(driver, content, usedPostUrls, logs, observer, "https://www.threads.com/?hl=en", "Không tìm thấy nút comment newfeed Threads.", false, "newfeed").then(() => undefined));
        if (result === "stop") break;
        if (result === "completed") addThreadsRunLog(logs, "success", `Đã comment newfeed ${index + 1}/${feedCommentCount}.`, observer);
        if (index < feedCommentCount - 1 && feedCommentDelaySeconds > 0) {
          await waitThreadsRunDelay(feedCommentDelaySeconds, logs, observer);
        }
      }
    }

    if (enableSearchComment) {
      for (let index = 0; index < searchCommentCount; index += 1) {
        throwIfThreadsRunStopped(config.signal);
        if (!(await prepareAction())) continue;
        const content = randomItem(searchCommentContents);
        const searchKeyword = randomItem(searchKeywords);
        const searchUrl = `https://www.threads.com/search?q=${encodeURIComponent(searchKeyword)}&serp_type=default&hl=en`;
        const taskLabel = `Comment search Threads ${index + 1}/${searchCommentCount}`;
        addThreadsRunLog(logs, "info", `Thực hiện tác vụ ${taskLabel}`, observer);
        const result = await runThreadsTaskWithRetry(taskLabel, () => runOneThreadsFeedComment(
          driver,
          content,
          usedPostUrls,
          logs,
          observer,
          searchUrl,
          "Không tìm thấy nút comment search Threads.",
          true,
          "search"
        ).then(() => undefined));
        if (result === "stop") break;
        if (result === "completed") addThreadsRunLog(logs, "success", `Đã comment search ${index + 1}/${searchCommentCount}.`, observer);
        if (index < searchCommentCount - 1 && searchCommentDelaySeconds > 0) {
          await waitThreadsRunDelay(searchCommentDelaySeconds, logs, observer);
        }
      }
    }

    return { ok: true, logs };
  } finally {
    config.signal?.removeEventListener("abort", abortHandler);
    await driver.quit().catch(() => undefined);
  }
}
