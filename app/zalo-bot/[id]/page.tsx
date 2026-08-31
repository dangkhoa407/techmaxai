"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, Clock, Copy, FileText, Image, Music, Pencil, Plus, Save, Settings2, Trash2, Video } from "lucide-react";
import { AppFrame, Icon, PageHeader, StatCard } from "../../components";
import {
  fetchZaloAccounts,
  fetchZaloBotCommands,
  fetchZaloBotSpecialSettings,
  saveZaloBotCommands,
  saveZaloBotSpecialSettings,
  type ZaloAccount,
  type ZaloBotSpecialSettings
} from "../../lib/auth";
import { showError, showToast } from "../../lib/swal";

type ZaloBotFormat = "text" | "audio" | "image" | "video";

type ZaloBotSendItem = {
  id: string;
  format: ZaloBotFormat;
  content: string;
  waitForRequest?: boolean;
  textStyles?: ZaloBotTextStyleRange[];
};

type ZaloBotTextStyle = "b" | "i" | "u" | "s" | "c_db342e" | "c_f27806" | "c_f7b503" | "c_15a85f" | "f_13" | "f_18" | "lst_1" | "lst_2";

type ZaloBotTextStyleRange = {
  start: number;
  len: number;
  st: ZaloBotTextStyle;
};

type SummernoteWindow = Window & {
  jQuery?: any;
  $?: any;
};

type SpecialTokenTarget =
  | "awayText"
  | "awayImageUrl"
  | "welcomeText"
  | "welcomeImageUrl"
  | "goodbyeText"
  | "goodbyeImageUrl"
  | "antiSpamWarningText"
  | "antiLinkWarningText";

type ZaloBotCommand = {
  id: string;
  commandText: string;
  argName: string;
  argType?: "text" | "request";
  requestEnabled?: boolean;
  requestEndpoint?: string;
  missingArgsMessage?: string;
  missingArgsMessageStyles?: ZaloBotTextStyleRange[];
  responseFormat?: ZaloBotFormat;
  responseFormats: ZaloBotFormat[];
  responsePayloads: Partial<Record<ZaloBotFormat, string>>;
  responseItems: ZaloBotSendItem[];
  responseTemplate: string;
  enabled: boolean;
};

type SpecialModalType = "away" | "welcome" | "spam" | "link" | "autojoin";

function commandStorageKey(accountId: number | string) {
  return `techmax:zalo-bot:commands:v1:${accountId}`;
}

const defaultUserTokens = [
  ["@user", "Tag người gửi trong tin nhắn Zalo"],
  ["@user_id", "ID người gửi lệnh"],
  ["@user_name", "Tên hiển thị người gửi"],
  ["@user_phone", "Số điện thoại nếu có"],
  ["@user_avatar", "Avatar người gửi nếu có"],
  ["@message_id", "ID tin nhắn gọi lệnh"],
  ["@message_text", "Toàn bộ nội dung tin nhắn"],
  ["@zalo_account_id", "ID tài khoản Zalo đang chạy bot"]
] as const;

const defaultGroupTokens = [
  ["@group_id", "ID nhóm Zalo"],
  ["@group_name", "Tên nhóm Zalo"],
  ["@group_member_count", "Số thành viên nhóm"],
  ["@group_owner_id", "ID chủ nhóm nếu có"],
  ["@group_role", "Vai trò người gửi trong nhóm"]
] as const;

const defaultRequestTokens = [
  ["@request", "Dữ liệu JSON trả về từ request"]
] as const;

const awaySpecialTokens = [
  ["@user", "Tag người gửi tin nhắn"],
  ["@user_name", "Tên người gửi tin nhắn"],
  ["@user_id", "ID người gửi tin nhắn"],
  ["@message_id", "ID tin nhắn"],
  ["@message_text", "Nội dung tin nhắn"]
] as const;

const groupLifecycleTokens = [
  ["@user", "Tag thành viên"],
  ["@user_name", "Tên thành viên"],
  ["@user_id", "ID thành viên"],
  ["@group_name", "Tên nhóm"],
  ["@group_id", "ID nhóm"]
] as const;

const spamWarningTokens = [
  ...groupLifecycleTokens,
  ["@violation_count", "Số lần vi phạm"],
  ["@violation_type", "Loại vi phạm"]
] as const;

const linkWarningTokens = [
  ...groupLifecycleTokens,
  ["@violation_count", "Số lần vi phạm"],
  ["@blocked_url", "Link vừa bị chặn"],
  ["@blocked_urls", "Danh sách link bị chặn"]
] as const;

const defaultCommands: ZaloBotCommand[] = [];
const pageSizeOptions = [5, 10, 20, 50];

const defaultSpecialSettings: ZaloBotSpecialSettings = {
  awayEnabled: false,
  awayText: "",
  awayTextStyles: [],
  awayImageUrl: "",
  awayImageCaption: "",
  awayImageCaptionStyles: [],
  awayCooldownMinutes: 60,
  welcomeEnabled: false,
  welcomeText: "",
  welcomeTextStyles: [],
  welcomeImageUrl: "",
  welcomeImageCaption: "",
  welcomeImageCaptionStyles: [],
  goodbyeEnabled: false,
  goodbyeText: "",
  goodbyeTextStyles: [],
  goodbyeImageUrl: "",
  goodbyeImageCaption: "",
  goodbyeImageCaptionStyles: [],
  antiSpamEnabled: false,
  antiSpamLimit: 5,
  antiSpamWindowSeconds: 60,
  antiSpamKickEnabled: false,
  antiSpamKickAfter: 3,
  antiSpamWarningEnabled: false,
  antiSpamWarningText: "",
  antiSpamWarningTextStyles: [],
  antiLinkEnabled: false,
  antiLinkAllowedText: "",
  antiLinkKickEnabled: false,
  antiLinkKickAfter: 3,
  antiLinkWarningEnabled: false,
  antiLinkWarningText: "",
  antiLinkWarningTextStyles: [],
  autoJoinGroupsEnabled: false,
  autoLeaveRestrictedGroupsEnabled: false
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyCommand(): ZaloBotCommand {
  return {
    id: createId(),
    commandText: "",
    argName: "",
    requestEnabled: false,
    requestEndpoint: "",
    missingArgsMessage: "",
    missingArgsMessageStyles: [],
    responseFormats: ["text"],
    responsePayloads: { text: "" },
    responseItems: [{ id: createId(), format: "text", content: "" }],
    responseTemplate: "",
    enabled: true
  };
}

function formatLabel(format: ZaloBotFormat) {
  if (format === "audio") return "Audio";
  if (format === "image") return "Hình ảnh";
  if (format === "video") return "Video";
  return "Text";
}

function FormatIcon({ format }: { format: ZaloBotFormat }) {
  if (format === "audio") return <Music size={15} />;
  if (format === "image") return <Image size={15} />;
  if (format === "video") return <Video size={15} />;
  return <FileText size={15} />;
}

function formatPayloadPlaceholder(format: ZaloBotFormat) {
  if (format === "audio") return "https://cdn.example.com/audio.mp3 hoặc @request.audio_url";
  if (format === "image") return "https://cdn.example.com/image.jpg hoặc @request.image_url";
  if (format === "video") return "https://cdn.example.com/video.mp4 hoặc @request.video_url";
  return "Ví dụ: Sản phẩm @request.name có giá @request.price";
}

function createSendItem(format: ZaloBotFormat): ZaloBotSendItem {
  return { id: createId(), format, content: "" };
}

const allowedTextStyles: ZaloBotTextStyle[] = ["b", "i", "u", "s", "c_db342e", "c_f27806", "c_f7b503", "c_15a85f", "f_13", "f_18", "lst_1", "lst_2"];

function normalizeTextStyles(styles: unknown, textLength: number): ZaloBotTextStyleRange[] {
  const allowed = new Set(allowedTextStyles);
  if (!Array.isArray(styles)) return [];
  return styles
    .map((style) => ({
      start: Math.max(0, Number((style as ZaloBotTextStyleRange)?.start || 0)),
      len: Math.max(0, Number((style as ZaloBotTextStyleRange)?.len || 0)),
      st: (style as ZaloBotTextStyleRange)?.st
    }))
    .filter((style): style is ZaloBotTextStyleRange => allowed.has(style.st) && style.len > 0 && style.start < textLength)
    .map((style) => ({ ...style, len: Math.min(style.len, textLength - style.start) }));
}

function loadCss(id: string, href: string) {
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(id: string, src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing?.dataset.loaded === "true") return resolve();
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Không tải được ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error(`Không tải được ${src}`));
    document.body.appendChild(script);
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function styleTextToHtml(text: string, styles: ZaloBotTextStyleRange[] = []) {
  const normalized = normalizeTextStyles(styles, text.length);
  if (!text) return "";
  const perChar = Array.from({ length: text.length }, () => new Set<ZaloBotTextStyle>());
  for (const style of normalized) {
    for (let index = style.start; index < style.start + style.len && index < text.length; index += 1) {
      perChar[index].add(style.st);
    }
  }
  let html = "";
  let currentKey = "";
  let buffer = "";
  const flush = () => {
    if (!buffer) return;
    const attrs = currentKey.split("|").filter(Boolean).reduce<{ tags: string[]; css: string[] }>((acc, style) => {
      if (style === "b") acc.tags.push("strong");
      else if (style === "i") acc.tags.push("em");
      else if (style === "u") acc.tags.push("u");
      else if (style === "s") acc.tags.push("s");
      else if (style.startsWith("c_")) {
        const color = colorHexFromZaloStyle(style);
        if (color) acc.css.push(`color:${color}`);
      }
      else if (style === "f_13") acc.css.push("font-size:13px");
      else if (style === "f_18") acc.css.push("font-size:18px");
      return acc;
    }, { tags: [], css: [] });
    let chunk = escapeHtml(buffer).replace(/\n/g, "<br>");
    if (attrs.css.length) chunk = `<span style="${attrs.css.join(";")}">${chunk}</span>`;
    for (const tag of attrs.tags.reverse()) chunk = `<${tag}>${chunk}</${tag}>`;
    html += chunk;
    buffer = "";
  };
  for (let index = 0; index < text.length; index += 1) {
    const key = Array.from(perChar[index]).sort().join("|");
    if (key !== currentKey) {
      flush();
      currentKey = key;
    }
    buffer += text[index];
  }
  flush();
  return html;
}

const zaloTextColorMap: Record<Extract<ZaloBotTextStyle, `c_${string}`>, [number, number, number]> = {
  c_db342e: [219, 52, 46],
  c_f27806: [242, 120, 6],
  c_f7b503: [247, 181, 3],
  c_15a85f: [21, 168, 95]
};

function parseCssColor(value: string): [number, number, number] | null {
  const compact = value.toLowerCase().replace(/\s+/g, "");
  const hex = compact.match(/color:#([0-9a-f]{3}|[0-9a-f]{6})/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map((char) => `${char}${char}`).join("") : hex;
    return [
      Number.parseInt(full.slice(0, 2), 16),
      Number.parseInt(full.slice(2, 4), 16),
      Number.parseInt(full.slice(4, 6), 16)
    ];
  }
  const rgb = compact.match(/color:rgba?\((\d+),(\d+),(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function colorStyleFromCss(value: string): ZaloBotTextStyle | null {
  const rgb = parseCssColor(value);
  if (!rgb) return null;
  let bestStyle: ZaloBotTextStyle | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [style, target] of Object.entries(zaloTextColorMap) as [ZaloBotTextStyle, [number, number, number]][]) {
    const distance = target.reduce((sum, channel, index) => sum + Math.pow(channel - rgb[index], 2), 0);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestStyle = style;
    }
  }
  if (bestDistance > 22000) return null;
  return bestStyle;
}

function colorHexFromZaloStyle(style: string) {
  if (style === "c_db342e") return "#db342e";
  if (style === "c_f27806") return "#f27806";
  if (style === "c_f7b503") return "#f7b503";
  if (style === "c_15a85f") return "#15a85f";
  return null;
}

function summernoteHtmlToZaloText(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html || "";
  let text = "";
  const ranges: ZaloBotTextStyleRange[] = [];
  const addRange = (start: number, len: number, styles: ZaloBotTextStyle[]) => {
    for (const st of styles) {
      if (len > 0) ranges.push({ start, len, st });
    }
  };
  const walk = (node: Node, active: ZaloBotTextStyle[] = []) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.textContent || "";
      const start = text.length;
      text += value;
      addRange(start, value.length, active);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const tag = element.tagName.toLowerCase();
    const next = [...active];
    if (tag === "b" || tag === "strong") next.push("b");
    if (tag === "i" || tag === "em") next.push("i");
    if (tag === "u") next.push("u");
    if (tag === "s" || tag === "strike" || tag === "del") next.push("s");
    if (tag === "ul") next.push("lst_1");
    if (tag === "ol") next.push("lst_2");
    const colorStyle = colorStyleFromCss(`${element.getAttribute("style") || ""};color:${element.getAttribute("color") || ""}`);
    if (colorStyle) next.push(colorStyle);
    const fontSize = (element.getAttribute("style") || "").toLowerCase();
    if (/font-size:\s*13px/.test(fontSize)) next.push("f_13");
    if (/font-size:\s*18px/.test(fontSize)) next.push("f_18");
    const block = ["p", "div", "li", "h1", "h2", "h3"].includes(tag);
    if (tag === "br") {
      text += "\n";
      return;
    }
    if (block && text && !text.endsWith("\n")) text += "\n";
    Array.from(element.childNodes).forEach((child) => walk(child, next));
    if (block && text && !text.endsWith("\n")) text += "\n";
  };
  Array.from(container.childNodes).forEach((node) => walk(node, []));
  text = text.replace(/\n{3,}/g, "\n\n").replace(/\s+$/g, "");
  return { text, styles: normalizeTextStyles(ranges, text.length) };
}

function usesRequestToken(value: string) {
  return /@requests?(?:\.|$)/i.test(value);
}

function parseArgNames(value: string) {
  return value
    .split(",")
    .map((item) => item.trim().replace(/^@/, ""))
    .filter(Boolean);
}

function filterTokenOptions(value: string, tokens: readonly (readonly [string, string])[], cursor = value.length) {
  const beforeCursor = value.slice(0, Math.max(0, Math.min(cursor, value.length)));
  const lastAt = beforeCursor.lastIndexOf("@");
  if (lastAt < 0) return [];
  const afterAt = beforeCursor.slice(lastAt + 1);
  if (!/^[a-zA-Z0-9_.]*$/.test(afterAt)) return [];
  const query = afterAt.toLowerCase();
  const uniqueTokens = Array.from(new Map(tokens.map((item) => [item[0], item])).values());
  if (uniqueTokens.some(([token]) => token.slice(1).toLowerCase() === query)) return [];
  return uniqueTokens.filter(([token]) => token.slice(1).toLowerCase().includes(query)).slice(0, 8);
}

function shouldOpenTokenSuggest(value: string, tokens: readonly (readonly [string, string])[], cursor = value.length) {
  return filterTokenOptions(value, tokens, cursor).length > 0;
}

function replaceTokenAtCursor(value: string, token: string, cursor = value.length) {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const beforeCursor = value.slice(0, safeCursor);
  const lastAt = beforeCursor.lastIndexOf("@");
  if (lastAt < 0) return value ? `${value}${token}` : token;
  const afterAt = beforeCursor.slice(lastAt + 1);
  if (!/^[a-zA-Z0-9_.]*$/.test(afterAt)) return value ? `${value}${token}` : token;
  const afterCursor = value.slice(safeCursor);
  const suffix = afterCursor.match(/^[a-zA-Z0-9_.]*/)?.[0] || "";
  const end = safeCursor + suffix.length;
  return `${value.slice(0, lastAt)}${token}${value.slice(end)}`;
}

function activeTokenRange(value: string, cursor = value.length) {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const beforeCursor = value.slice(0, safeCursor);
  const lastAt = beforeCursor.lastIndexOf("@");
  if (lastAt < 0) return null;
  const afterAt = beforeCursor.slice(lastAt + 1);
  if (!/^[a-zA-Z0-9_.]*$/.test(afterAt)) return null;
  const afterCursor = value.slice(safeCursor);
  const suffix = afterCursor.match(/^[a-zA-Z0-9_.]*/)?.[0] || "";
  return { start: lastAt, cursor: safeCursor, end: safeCursor + suffix.length };
}

function replaceTokenRange(value: string, token: string, range: { start: number; end: number } | null | undefined, fallbackCursor = value.length) {
  if (!range) return replaceTokenAtCursor(value, token, fallbackCursor);
  return `${value.slice(0, range.start)}${token}${value.slice(range.end)}`;
}

function summernoteCursorOffset($: any, editor: HTMLTextAreaElement | null, fallback = 0) {
  if (!editor || typeof window === "undefined") return fallback;
  const editable = $(editor).next(".note-editor").find(".note-editable").get(0) as HTMLElement | undefined;
  const selection = window.getSelection();
  if (!editable || !selection || selection.rangeCount === 0) return fallback;
  const range = selection.getRangeAt(0);
  if (!editable.contains(range.startContainer)) return fallback;
  const beforeRange = range.cloneRange();
  beforeRange.selectNodeContents(editable);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  return Math.max(0, beforeRange.toString().length);
}

function commandContentPreview(command: ZaloBotCommand) {
  if (command.requestEnabled || command.argType === "request") {
    const endpoint = command.requestEndpoint || "";
    if (endpoint.trim()) return endpoint;
  }
  if (Array.isArray(command.responseItems) && command.responseItems.length) {
    const item = command.responseItems.find((entry) => entry.content.trim());
    if (item) return item.content;
  }
  const formats = command.responseFormats?.length ? command.responseFormats : [command.responseFormat || "text"];
  const payloads = command.responsePayloads || {};
  const preview = formats
    .map((format) => payloads[format] || (format === "text" ? command.responseTemplate : ""))
    .find((value) => String(value || "").trim());
  return preview || "Chưa có nội dung";
}

function ZaloSummernoteEditor({
  id,
  value,
  textStyles,
  placeholder,
  onChange,
  onCursorChange,
  onFocus,
  onBlur
}: {
  id: string;
  value: string;
  textStyles?: ZaloBotTextStyleRange[];
  placeholder: string;
  onChange: (value: string, styles: ZaloBotTextStyleRange[], cursor?: number) => void;
  onCursorChange?: (value: string, cursor: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const latestRef = useRef({ value, textStyles: textStyles || [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    latestRef.current = { value, textStyles: textStyles || [] };
  }, [value, textStyles]);

  useEffect(() => {
    let disposed = false;
    async function setupEditor() {
      try {
        loadCss("summernote-lite-css", "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.css");
        await loadScript("jquery-3-7-1", "https://code.jquery.com/jquery-3.7.1.min.js");
        await loadScript("summernote-lite-js", "https://cdn.jsdelivr.net/npm/summernote@0.8.20/dist/summernote-lite.min.js");
        if (disposed || !editorRef.current) return;
        const win = window as SummernoteWindow;
        const $ = win.jQuery || win.$;
        if (!$?.fn?.summernote) throw new Error("Summernote chưa sẵn sàng.");
        const $editor = $(editorRef.current);
        const emitCursor = (contents?: string) => {
          const html = typeof contents === "string" ? contents : $editor.summernote("code");
          const parsed = summernoteHtmlToZaloText(html);
          const cursor = Math.min(parsed.text.length, summernoteCursorOffset($, editorRef.current, parsed.text.length));
          onCursorChange?.(parsed.text, cursor);
          return { ...parsed, cursor };
        };
        $editor.summernote({
          height: 150,
          placeholder,
          toolbar: [
            ["font", ["bold", "italic", "underline", "strikethrough", "clear"]],
            ["fontsize", ["fontsize"]],
            ["color", ["forecolor"]],
            ["para", ["ul", "ol"]],
            ["view", ["codeview"]]
          ],
          fontSizes: ["13", "16", "18"],
          colors: [
            ["#db342e", "#f27806", "#f7b503", "#15a85f"]
          ],
          colorsName: [
            ["Đỏ", "Cam", "Vàng", "Xanh"]
          ],
          callbacks: {
            onChange: (contents: string) => {
              const parsed = emitCursor(contents);
              latestRef.current = { value: parsed.text, textStyles: parsed.styles };
              onChange(parsed.text, parsed.styles, parsed.cursor);
            },
            onKeyup: () => {
              emitCursor();
            },
            onMouseup: () => {
              emitCursor();
            },
            onFocus,
            onBlur
          }
        });
        $editor.summernote("code", styleTextToHtml(latestRef.current.value, latestRef.current.textStyles));
        setReady(true);
      } catch (error) {
        setReady(false);
        showError(error instanceof Error ? error.message : "Không thể tải Summernote.");
      }
    }
    setupEditor();
    return () => {
      disposed = true;
      const win = window as SummernoteWindow;
      const $ = win.jQuery || win.$;
      if (editorRef.current && $?.fn?.summernote) {
        try {
          $(editorRef.current).summernote("destroy");
        } catch {
          // Summernote can throw if it was not initialized yet.
        }
      }
    };
  }, [id]);

  useEffect(() => {
    if (!ready || !editorRef.current) return;
    const current = latestRef.current;
    if (current.value === value && JSON.stringify(current.textStyles || []) === JSON.stringify(textStyles || [])) return;
    const win = window as SummernoteWindow;
    const $ = win.jQuery || win.$;
    if ($?.fn?.summernote) {
      $(editorRef.current).summernote("code", styleTextToHtml(value, textStyles || []));
      latestRef.current = { value, textStyles: textStyles || [] };
    }
  }, [ready, value, textStyles]);

  return (
    <div className="zalo-bot-summernote">
      <textarea id={id} ref={editorRef} defaultValue={value} />
      {!ready ? <small className="zalo-bot-field-help">Đang tải Summernote...</small> : null}
    </div>
  );
}

function migrateCommand(command: Partial<ZaloBotCommand>): ZaloBotCommand {
  const legacyFormats = Array.isArray(command.responseFormats) && command.responseFormats.length
    ? command.responseFormats
    : [command.responseFormat || "text"];
  const responseFormats = Array.from(new Set(legacyFormats.filter((format): format is ZaloBotFormat =>
    format === "text" || format === "audio" || format === "image" || format === "video"
  )));
  const responsePayloads = command.responsePayloads || { text: command.responseTemplate || "" };
  const legacyItems = Array.isArray(command.responseItems) && command.responseItems.length
    ? command.responseItems
    : responseFormats.map((format) => ({
      id: createId(),
      format,
      content: responsePayloads[format] || (format === "text" ? command.responseTemplate || "" : ""),
      waitForRequest: usesRequestToken(responsePayloads[format] || (format === "text" ? command.responseTemplate || "" : ""))
    }));

  return {
    id: command.id || createId(),
    commandText: command.commandText || "",
    argName: command.argName || "",
    argType: command.argType,
    requestEnabled: Boolean(command.requestEnabled || command.argType === "request" || legacyFormats.includes("request" as ZaloBotFormat)),
    requestEndpoint: command.requestEndpoint || (command.responsePayloads as Record<string, string> | undefined)?.request || "",
    missingArgsMessage: command.missingArgsMessage || "",
    missingArgsMessageStyles: normalizeTextStyles(command.missingArgsMessageStyles, (command.missingArgsMessage || "").length),
    responseFormat: command.responseFormat,
    responseFormats: responseFormats.length ? responseFormats : ["text"],
    responsePayloads,
    responseItems: (legacyItems.length ? legacyItems : [createSendItem("text")]).map((item: ZaloBotSendItem) => ({
      ...item,
      textStyles: item.format === "text" ? normalizeTextStyles(item.textStyles, item.content.length) : [],
      waitForRequest: Boolean(item.waitForRequest || usesRequestToken(item.content))
    })),
    responseTemplate: command.responseTemplate || "",
    enabled: command.enabled !== false
  };
}

export default function ZaloBotPage() {
  const params = useParams<{ id: string }>();
  const accountId = String(params?.id || "");
  const requestTokenCursorRef = useRef<number | null>(null);
  const requestTokenRangeRef = useRef<{ start: number; end: number } | null>(null);
  const payloadTokenCursorRef = useRef<number | null>(null);
  const payloadTokenRangeRef = useRef<{ start: number; end: number } | null>(null);
  const specialTokenCursorRef = useRef<number | null>(null);
  const specialTokenRangeRef = useRef<{ start: number; end: number } | null>(null);
  const [accounts, setAccounts] = useState<ZaloAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(accountId);
  const [commands, setCommands] = useState<ZaloBotCommand[]>(defaultCommands);
  const [draft, setDraft] = useState<ZaloBotCommand>(() => emptyCommand());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [commandPage, setCommandPage] = useState(1);
  const [commandPageSize, setCommandPageSize] = useState(10);
  const [formatPickerOpen, setFormatPickerOpen] = useState(false);
  const [requestTokenOpen, setRequestTokenOpen] = useState(false);
  const [requestTokenCursor, setRequestTokenCursor] = useState<number | null>(null);
  const [payloadTokenItemId, setPayloadTokenItemId] = useState<string | null>(null);
  const [payloadTokenCursor, setPayloadTokenCursor] = useState<number | null>(null);
  const [specialTokenTarget, setSpecialTokenTarget] = useState<SpecialTokenTarget | null>(null);
  const [specialTokenCursor, setSpecialTokenCursor] = useState<number | null>(null);
  const [commandFormOpen, setCommandFormOpen] = useState(false);
  const [commandsLoaded, setCommandsLoaded] = useState(false);
  const [viewingCommand, setViewingCommand] = useState<ZaloBotCommand | null>(null);
  const [specialSettings, setSpecialSettings] = useState<ZaloBotSpecialSettings>(defaultSpecialSettings);
  const [specialSaving, setSpecialSaving] = useState(false);
  const [specialModalOpen, setSpecialModalOpen] = useState<SpecialModalType | null>(null);

  const selectedAccount = accounts.find((account) => String(account.id) === selectedAccountId);
  const activeCommands = commands.filter((command) => command.enabled).length;
  const requestCommands = commands.filter((command) => command.requestEnabled || command.argType === "request").length;
  const draftArgNames = useMemo(() => parseArgNames(draft.argName), [draft.argName]);
  const draftArgTokens = draftArgNames.map((name) => `@${name}`);
  const draftArgToken = draftArgTokens[0] || "@ten_args";
  const draftArgHelp = draftArgTokens.length ? draftArgTokens.join(", ") : "@ten_args";
  const baseTokenOptions = useMemo(() => [
    ...(draftArgTokens.length ? draftArgTokens.map((token) => [token, "Dữ liệu args người dùng gửi sau lệnh"] as const) : [[draftArgToken, "Dữ liệu người dùng gửi sau lệnh"] as const]),
    ...defaultUserTokens,
    ...defaultGroupTokens
  ], [draftArgToken, draftArgTokens.join("|")]);
  const requestTokenOptions = useMemo(() => {
    return filterTokenOptions(draft.requestEndpoint || "", baseTokenOptions, requestTokenCursor ?? (draft.requestEndpoint || "").length);
  }, [draft.requestEndpoint, baseTokenOptions, requestTokenCursor]);
  const payloadTokenOptions = useMemo(() => {
    if (!payloadTokenItemId) return [];
    const item = draft.responseItems.find((entry) => entry.id === payloadTokenItemId);
    return filterTokenOptions(item?.content || "", [...baseTokenOptions, ...defaultRequestTokens], payloadTokenCursor ?? (item?.content || "").length);
  }, [payloadTokenItemId, payloadTokenCursor, draft.responseItems, baseTokenOptions]);
  const specialTokenMap = useMemo<Record<SpecialTokenTarget, readonly (readonly [string, string])[]>>(() => ({
    awayText: awaySpecialTokens,
    awayImageUrl: awaySpecialTokens,
    welcomeText: groupLifecycleTokens,
    welcomeImageUrl: groupLifecycleTokens,
    goodbyeText: groupLifecycleTokens,
    goodbyeImageUrl: groupLifecycleTokens,
    antiSpamWarningText: spamWarningTokens,
    antiLinkWarningText: linkWarningTokens
  }), []);
  const specialTokenValueMap = {
    awayText: specialSettings.awayText,
    awayImageUrl: specialSettings.awayImageUrl,
    welcomeText: specialSettings.welcomeText,
    welcomeImageUrl: specialSettings.welcomeImageUrl,
    goodbyeText: specialSettings.goodbyeText,
    goodbyeImageUrl: specialSettings.goodbyeImageUrl,
    antiSpamWarningText: specialSettings.antiSpamWarningText || "",
    antiLinkWarningText: specialSettings.antiLinkWarningText || ""
  } satisfies Record<SpecialTokenTarget, string>;
  const specialTokenOptions = useMemo(() => {
    if (!specialTokenTarget) return [];
    return filterTokenOptions(
      specialTokenValueMap[specialTokenTarget] || "",
      specialTokenMap[specialTokenTarget] || [],
      specialTokenCursor ?? (specialTokenValueMap[specialTokenTarget] || "").length
    );
  }, [specialTokenTarget, specialTokenCursor, specialSettings, specialTokenMap]);

  const filteredCommands = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return commands;
    return commands.filter((command) =>
      [
        command.commandText,
        command.argName,
        command.requestEndpoint || "",
        command.responseTemplate,
        (command.responseItems || []).map((item) => item.content).join(" "),
        Object.values(command.responsePayloads || {}).join(" "),
        (command.responseFormats || [command.responseFormat || "text"]).join(", ")
      ]
        .some((value) => value.toLowerCase().includes(keyword))
    );
  }, [commands, search]);
  const commandTotalPages = Math.max(1, Math.ceil(filteredCommands.length / commandPageSize));
  const safeCommandPage = Math.min(Math.max(1, commandPage), commandTotalPages);
  const paginatedCommands = useMemo(() => {
    const start = (safeCommandPage - 1) * commandPageSize;
    return filteredCommands.slice(start, start + commandPageSize);
  }, [filteredCommands, safeCommandPage, commandPageSize]);
  const commandPageFrom = filteredCommands.length ? (safeCommandPage - 1) * commandPageSize + 1 : 0;
  const commandPageTo = Math.min(filteredCommands.length, safeCommandPage * commandPageSize);

  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    setCommandsLoaded(false);
    async function loadBotCommands() {
      try {
        const serverCommands = await fetchZaloBotCommands(selectedAccountId);
        if (cancelled) return;
        if (serverCommands.length) {
          setCommands(serverCommands.map((command) => migrateCommand(command)));
        } else {
          const saved = window.localStorage.getItem(commandStorageKey(selectedAccountId));
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              const migratedCommands = Array.isArray(parsed) ? parsed.map((command) => migrateCommand(command)) : defaultCommands;
              setCommands(migratedCommands);
              if (migratedCommands.length) {
                saveZaloBotCommands(selectedAccountId, migratedCommands).catch(() => undefined);
              }
            } catch {
              window.localStorage.removeItem(commandStorageKey(selectedAccountId));
              setCommands(defaultCommands);
            }
          } else {
            setCommands(defaultCommands);
          }
        }
      } catch (error) {
        if (!cancelled) {
          showError(error instanceof Error ? error.message : "Không thể tải lệnh BOT Zalo.");
          setCommands(defaultCommands);
        }
      } finally {
        if (!cancelled) setCommandsLoaded(true);
      }
    }
    loadBotCommands();
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  useEffect(() => {
    setCommandPage(1);
  }, [search, commandPageSize, selectedAccountId]);

  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    async function loadSpecialSettings() {
      try {
        const settings = await fetchZaloBotSpecialSettings(selectedAccountId);
        if (!cancelled) setSpecialSettings({ ...defaultSpecialSettings, ...settings });
      } catch (error) {
        if (!cancelled) {
          setSpecialSettings(defaultSpecialSettings);
          showError(error instanceof Error ? error.message : "Không thể tải lệnh đặc biệt BOT Zalo.");
        }
      }
    }
    loadSpecialSettings();
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (!selectedAccountId || !commandsLoaded) return;
    window.localStorage.setItem(commandStorageKey(selectedAccountId), JSON.stringify(commands));
  }, [commands, selectedAccountId, commandsLoaded]);

  async function loadAccounts() {
    setLoading(true);
    try {
      const data = await fetchZaloAccounts();
      setAccounts(data);
      setSelectedAccountId(accountId);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể tải danh sách tài khoản Zalo.");
    } finally {
      setLoading(false);
    }
  }

  async function persistCommands(nextCommands: ZaloBotCommand[]) {
    if (!selectedAccountId) return;
    window.localStorage.setItem(commandStorageKey(selectedAccountId), JSON.stringify(nextCommands));
    const savedCommands = await saveZaloBotCommands(selectedAccountId, nextCommands);
    setCommands(savedCommands.map((command) => migrateCommand(command)));
  }

  async function saveSpecialSettings() {
    if (!selectedAccountId) return;
    if (specialSettings.awayEnabled && !specialSettings.awayText.trim() && !specialSettings.awayImageUrl.trim()) {
      showError("Vui lòng nhập nội dung text hoặc link ảnh cho tự động reply khi vắng mặt.");
      return;
    }
    setSpecialSaving(true);
    try {
      const saved = await saveZaloBotSpecialSettings(selectedAccountId, {
        ...specialSettings,
        awayCooldownMinutes: Math.max(1, Number(specialSettings.awayCooldownMinutes || 60))
      });
      setSpecialSettings({ ...defaultSpecialSettings, ...saved });
      setSpecialModalOpen(null);
      showToast("Đã lưu lệnh đặc biệt BOT Zalo.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu lệnh đặc biệt BOT Zalo.");
    } finally {
      setSpecialSaving(false);
    }
  }

  async function toggleAwayEnabled(awayEnabled: boolean) {
    if (!selectedAccountId || specialSaving) return;
    const previous = specialSettings;
    const nextSettings = { ...specialSettings, awayEnabled };
    setSpecialSettings(nextSettings);
    setSpecialSaving(true);
    try {
      const saved = await saveZaloBotSpecialSettings(selectedAccountId, {
        ...nextSettings,
        awayCooldownMinutes: Math.max(1, Number(nextSettings.awayCooldownMinutes || 60))
      });
      setSpecialSettings({ ...defaultSpecialSettings, ...saved });
      showToast(awayEnabled ? "Đã bật tự động reply khi vắng mặt." : "Đã tắt tự động reply khi vắng mặt.");
    } catch (error) {
      setSpecialSettings(previous);
      showError(error instanceof Error ? error.message : "Không thể lưu trạng thái tự động reply.");
    } finally {
      setSpecialSaving(false);
    }
  }

  async function saveSpecialSettingsQuick(nextSettings: ZaloBotSpecialSettings, message: string) {
    if (!selectedAccountId || specialSaving) return;
    const previous = specialSettings;
    setSpecialSettings(nextSettings);
    setSpecialSaving(true);
    try {
      const saved = await saveZaloBotSpecialSettings(selectedAccountId, {
        ...nextSettings,
        awayCooldownMinutes: Math.max(1, Number(nextSettings.awayCooldownMinutes || 60)),
        antiSpamLimit: Math.max(2, Number(nextSettings.antiSpamLimit || 5)),
        antiSpamWindowSeconds: Math.max(5, Number(nextSettings.antiSpamWindowSeconds || 60)),
        antiSpamKickAfter: Math.max(1, Number(nextSettings.antiSpamKickAfter || 3)),
        antiLinkKickAfter: Math.max(1, Number(nextSettings.antiLinkKickAfter || 3)),
      });
      setSpecialSettings({ ...defaultSpecialSettings, ...saved });
      showToast(message);
    } catch (error) {
      setSpecialSettings(previous);
      showError(error instanceof Error ? error.message : "Không thể lưu lệnh đặc biệt.");
    } finally {
      setSpecialSaving(false);
    }
  }

  async function saveDraft() {
    const commandText = draft.commandText.trim();
    if (!commandText) {
      showError("Vui lòng nhập text gọi lệnh, ví dụ /gia hoặc /menu.");
      return;
    }
    if (draft.requestEnabled && !draft.requestEndpoint?.trim()) {
      showError("Bạn cần nhập endpoint request sau khi bật gọi request.");
      return;
    }
    if (!draft.responseItems.length) {
      showError("Vui lòng thêm ít nhất một tài liệu gửi.");
      return;
    }
    if (!draft.requestEnabled && draft.responseItems.some((item) => usesRequestToken(item.content))) {
      showError("Tài liệu đang dùng @request nên cần bật gọi request trước khi gửi tin nhắn.");
      return;
    }

    const nextCommand: ZaloBotCommand = {
      ...draft,
      commandText,
      argName: draft.argName.trim(),
      argType: draft.requestEnabled ? "request" : "text",
      requestEnabled: Boolean(draft.requestEnabled),
      requestEndpoint: draft.requestEndpoint?.trim() || "",
      missingArgsMessage: draft.missingArgsMessage || "",
      missingArgsMessageStyles: normalizeTextStyles(draft.missingArgsMessageStyles, (draft.missingArgsMessage || "").length),
      responseFormats: Array.from(new Set(draft.responseItems.map((item) => item.format))),
      responsePayloads: {
        ...draft.responseItems.reduce<Partial<Record<ZaloBotFormat, string>>>((payloads, item) => {
          payloads[item.format] = [payloads[item.format], item.content].filter(Boolean).join("\n");
          return payloads;
        }, {})
      },
      responseItems: draft.responseItems.map((item) => ({
        ...item,
        textStyles: item.format === "text" ? normalizeTextStyles(item.textStyles, item.content.length) : [],
        waitForRequest: Boolean(draft.requestEnabled && (item.waitForRequest || usesRequestToken(item.content)))
      })),
      responseTemplate: draft.responseItems.filter((item) => item.format === "text").map((item) => item.content).join("\n").trim()
    };

    const nextCommands = editingId ? commands.map((item) => (item.id === editingId ? nextCommand : item)) : [nextCommand, ...commands];
    setCommands(nextCommands);
    try {
      await persistCommands(nextCommands);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu lệnh BOT Zalo lên server.");
      return;
    }
    setDraft(emptyCommand());
    setEditingId(null);
    setCommandFormOpen(false);
    showToast(editingId ? "Đã cập nhật lệnh BOT Zalo." : "Đã thêm lệnh BOT Zalo.");
  }

  function editCommand(command: ZaloBotCommand) {
    setDraft(migrateCommand(command));
    setEditingId(command.id);
    setFormatPickerOpen(false);
    setCommandFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function duplicateCommand(command: ZaloBotCommand) {
    const nextCommands = [{ ...command, id: createId(), commandText: `${command.commandText}-copy` }, ...commands];
    setCommands(nextCommands);
    try {
      await persistCommands(nextCommands);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể lưu lệnh đã nhân bản.");
      return;
    }
    showToast("Đã nhân bản lệnh.");
  }

  async function removeCommand(id: string) {
    const nextCommands = commands.filter((command) => command.id !== id);
    setCommands(nextCommands);
    try {
      await persistCommands(nextCommands);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa lệnh trên server.");
    }
    if (editingId === id) {
      setDraft(emptyCommand());
      setEditingId(null);
    }
  }

  async function toggleCommand(id: string) {
    const nextCommands = commands.map((command) => command.id === id ? { ...command, enabled: !command.enabled } : command);
    setCommands(nextCommands);
    try {
      await persistCommands(nextCommands);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đổi trạng thái lệnh.");
    }
  }

  function addResponseFormat(format: ZaloBotFormat) {
    setDraft((current) => {
      const count = current.responseItems.filter((item) => item.format === format).length;
      if (count >= 3) {
        showToast(`Mỗi loại ${formatLabel(format)} tối đa 3 tài liệu gửi.`, "warning");
        return current;
      }
      const nextItems = [...current.responseItems, createSendItem(format)];
      return {
        ...current,
        responseItems: nextItems,
        responseFormats: Array.from(new Set(nextItems.map((item) => item.format)))
      };
    });
    setFormatPickerOpen(false);
  }

  function removeResponseItem(id: string) {
    setDraft((current) => ({
      ...current,
      responseItems: current.responseItems.filter((item) => item.id !== id),
      responseFormats: Array.from(new Set(current.responseItems.filter((item) => item.id !== id).map((item) => item.format)))
    }));
  }

  function updateResponseItem(id: string, value: string, textStyles?: ZaloBotTextStyleRange[], cursor = value.length) {
    setDraft((current) => ({
      ...current,
      responseTemplate: current.responseItems.some((item) => item.id === id && item.format === "text") ? value : current.responseTemplate,
      responseItems: current.responseItems.map((item) => item.id === id ? {
        ...item,
        content: value,
        textStyles: item.format === "text" ? normalizeTextStyles(textStyles ?? item.textStyles, value.length) : item.textStyles,
        waitForRequest: item.waitForRequest || usesRequestToken(value)
      } : item)
    }));
    const range = activeTokenRange(value, cursor);
    const nextCursor = range?.cursor ?? null;
    const shouldOpen = range !== null && shouldOpenTokenSuggest(value, [...baseTokenOptions, ...defaultRequestTokens], nextCursor ?? value.length);
    payloadTokenCursorRef.current = nextCursor;
    payloadTokenRangeRef.current = range ? { start: range.start, end: range.end } : null;
    setPayloadTokenCursor(nextCursor);
    setPayloadTokenItemId(shouldOpen ? id : null);
  }

  function updateResponseItemWait(id: string, waitForRequest: boolean) {
    setDraft((current) => ({
      ...current,
      responseItems: current.responseItems.map((item) => item.id === id ? { ...item, waitForRequest } : item)
    }));
  }

  function updateRequestEndpoint(value: string, cursor = value.length) {
    setDraft((current) => ({ ...current, requestEndpoint: value }));
    const range = activeTokenRange(value, cursor);
    const nextCursor = range?.cursor ?? null;
    requestTokenCursorRef.current = nextCursor;
    requestTokenRangeRef.current = range ? { start: range.start, end: range.end } : null;
    setRequestTokenCursor(nextCursor);
    setRequestTokenOpen(range !== null && shouldOpenTokenSuggest(value, baseTokenOptions, nextCursor ?? value.length));
  }

  function applyRequestToken(token: string) {
    setDraft((current) => {
      const value = current.requestEndpoint || "";
      const nextValue = replaceTokenRange(value, token, requestTokenRangeRef.current, requestTokenCursorRef.current ?? requestTokenCursor ?? value.length);
      return {
        ...current,
        requestEndpoint: nextValue
      };
    });
    requestTokenCursorRef.current = null;
    requestTokenRangeRef.current = null;
    setRequestTokenCursor(null);
    setRequestTokenOpen(false);
  }

  function applyPayloadToken(itemId: string, token: string) {
    setDraft((current) => ({
      ...current,
      responseItems: current.responseItems.map((item) => {
        if (item.id !== itemId) return item;
        const value = item.content;
        const nextValue = replaceTokenRange(value, token, payloadTokenRangeRef.current, payloadTokenCursorRef.current ?? payloadTokenCursor ?? value.length);
        return { ...item, content: nextValue };
      }).map((item) => item.id === itemId ? { ...item, waitForRequest: item.waitForRequest || usesRequestToken(item.content) } : item)
    }));
    payloadTokenCursorRef.current = null;
    payloadTokenRangeRef.current = null;
    setPayloadTokenCursor(null);
    setPayloadTokenItemId(null);
  }

  function updateSpecialTokenSuggest(target: SpecialTokenTarget, value: string, cursor = value.length) {
    const tokens = specialTokenMap[target] || [];
    const range = activeTokenRange(value, cursor);
    const nextCursor = range?.cursor ?? null;
    specialTokenCursorRef.current = nextCursor;
    specialTokenRangeRef.current = range ? { start: range.start, end: range.end } : null;
    setSpecialTokenCursor(nextCursor);
    setSpecialTokenTarget(range !== null && shouldOpenTokenSuggest(value, tokens, nextCursor ?? value.length) ? target : null);
  }

  function applySpecialToken(target: SpecialTokenTarget, token: string) {
    setSpecialSettings((current) => {
      const value = String(current[target] || "");
      const nextValue = replaceTokenRange(value, token, specialTokenRangeRef.current, specialTokenCursorRef.current ?? specialTokenCursor ?? value.length);
      return { ...current, [target]: nextValue };
    });
    specialTokenCursorRef.current = null;
    specialTokenRangeRef.current = null;
    setSpecialTokenCursor(null);
    setSpecialTokenTarget(null);
  }

  function specialSuggest(target: SpecialTokenTarget) {
    if (specialTokenTarget !== target || !specialTokenOptions.length) return null;
    return (
      <div className="zalo-bot-payload-suggest zalo-bot-special-suggest">
        {specialTokenOptions.map(([token, desc]) => (
          <button
            key={token}
            type="button"
            onMouseDownCapture={(event) => {
              event.preventDefault();
              event.stopPropagation();
              applySpecialToken(target, token);
            }}
          >
            <strong>{token}</strong>
            <span>{desc}</span>
          </button>
        ))}
      </div>
    );
  }

  function openNewCommandForm() {
    setDraft(emptyCommand());
    setEditingId(null);
    setFormatPickerOpen(false);
    setCommandFormOpen(true);
  }

  function closeCommandForm() {
    setDraft(emptyCommand());
    setEditingId(null);
    setFormatPickerOpen(false);
    setPayloadTokenItemId(null);
    setRequestTokenOpen(false);
    setCommandFormOpen(false);
  }

  return (
    <AppFrame active="/zalo-bot" title="BOT Zalo">
      <PageHeader
        eyebrow="Automation"
        title="Setting lệnh BOT Zalo"
        desc={selectedAccount ? `Tùy chỉnh lệnh cho ${selectedAccount.display_name || selectedAccount.own_id}.` : "Tùy chỉnh lệnh BOT cho tài khoản Zalo đã chọn."}
        action={
          <div className="row">
            <Link className="btn btn-secondary" href="/zalo-bot">
              <ArrowLeft size={17} /> Danh sách
            </Link>
            <button className="btn btn-red" type="button" onClick={openNewCommandForm}>
              <Plus size={17} /> Thêm lệnh bot
            </button>
          </div>
        }
      />

      <div className="zalo-bot-page">
        <section className="grid-4">
          <StatCard label="Tài khoản" value={selectedAccount ? "1" : "0"} help={selectedAccount?.display_name || selectedAccount?.own_id || (loading ? "Đang tải..." : "Không tìm thấy")} icon="message_circle" />
          <StatCard label="Lệnh bot" value={String(commands.length)} help="Tổng số lệnh đã tạo" icon="smart_toy" />
          <StatCard label="Đang bật" value={String(activeCommands)} help="Lệnh đang sẵn sàng chạy" icon="toggle_on" />
          <StatCard label="Request API" value={String(requestCommands)} help="Lệnh có gọi endpoint" icon="link" />
        </section>

        {commandFormOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={closeCommandForm}>
        <section className="card pad zalo-bot-builder zalo-bot-command-modal" role="dialog" aria-modal="true" aria-labelledby="zalo-bot-command-modal-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="zalo-bot-section-title">
            <h2 id="zalo-bot-command-modal-title"><Bot size={19} /> Setup BOT</h2>
            <p className="subtitle">{selectedAccount ? `Đang tạo lệnh cho ${selectedAccount.display_name || selectedAccount.own_id}.` : "Chọn tài khoản Zalo ở bảng phía trên trước khi tạo lệnh."}</p>
          </div>

          <div className="zalo-bot-form-grid">
            <label className="zalo-bot-field">
              <span>Text gọi lệnh</span>
              <input className="input" placeholder="/menu" value={draft.commandText} onChange={(event) => setDraft({ ...draft, commandText: event.target.value })} />
            </label>

            <label className="zalo-bot-field">
              <span>Tên args</span>
              <input className="input" placeholder="keyword, phone, order_id..." value={draft.argName} onChange={(event) => setDraft({ ...draft, argName: event.target.value })} />
              <small className="zalo-bot-field-help">Có thể nhập nhiều args, cách nhau bằng dấu phẩy. Dùng {draftArgHelp} trong Request URL.</small>
            </label>

            {draftArgNames.length ? (
              <label className="zalo-bot-field full">
                <span>Thông báo khi nhập thiếu args</span>
                <ZaloSummernoteEditor
                  id="zalo-bot-missing-args-message"
                  placeholder="Ví dụ: @user vui lòng nhập đủ thông tin: @required_args."
                  value={draft.missingArgsMessage || ""}
                  textStyles={draft.missingArgsMessageStyles || []}
                  onChange={(value, styles) => setDraft((current) => ({ ...current, missingArgsMessage: value, missingArgsMessageStyles: styles }))}
                />
                <small className="zalo-bot-field-help">Dùng được @user, @user_name, @missing_args, @required_args và các tag group nếu gọi trong group.</small>
              </label>
            ) : null}

            <div className="zalo-bot-field wide zalo-bot-request-toggle-field">
              <label className="zalo-bot-request-check">
                <input
                  checked={Boolean(draft.requestEnabled)}
                  type="checkbox"
                  onChange={(event) => setDraft((current) => ({ ...current, requestEnabled: event.target.checked }))}
                />
                <span>Gọi request trước khi gửi tin nhắn</span>
              </label>
              {draft.requestEnabled ? (
                <div className="zalo-bot-request-field">
                  <textarea
                    className="input zalo-bot-textarea compact"
                    placeholder={`https://api.example.com/search?q=${draftArgToken}`}
                    value={draft.requestEndpoint || ""}
                    onChange={(event) => updateRequestEndpoint(event.target.value, event.target.selectionStart ?? event.target.value.length)}
                    onFocus={(event) => {
                      const cursor = event.currentTarget.selectionStart ?? (draft.requestEndpoint || "").length;
                      updateRequestEndpoint(event.currentTarget.value, cursor);
                    }}
                    onKeyUp={(event) => {
                      const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
                      updateRequestEndpoint(event.currentTarget.value, cursor);
                    }}
                    onClick={(event) => {
                      const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
                      updateRequestEndpoint(event.currentTarget.value, cursor);
                    }}
                    onBlur={() => window.setTimeout(() => setRequestTokenOpen(false), 120)}
                  />
                  {requestTokenOpen && requestTokenOptions.length ? (
                    <div className="zalo-bot-request-suggest">
                      {requestTokenOptions.map(([token, desc]) => (
                        <button
                          key={token}
                          type="button"
                          onMouseDownCapture={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            applyRequestToken(token);
                          }}
                        >
                          <strong>{token}</strong>
                          <span>{desc}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <small className="zalo-bot-field-help">Endpoint có thể dùng {draftArgHelp}, @user_id hoặc @group_id. JSON trả về dùng trong tài liệu gửi bằng @request.tên.</small>
                </div>
              ) : null}
            </div>

            <div className="zalo-bot-field full">
              <span>Tài liệu gửi</span>
              <div className="zalo-bot-send-format-box">
                <div className="zalo-bot-format-picker-wrap">
                  <button className="btn btn-secondary" type="button" onClick={() => setFormatPickerOpen((value) => !value)}>
                    <Plus size={16} /> Thêm tài liệu gửi
                  </button>
                  {formatPickerOpen ? (
                    <div className="zalo-bot-format-picker">
                      {(["text", "audio", "image", "video"] as ZaloBotFormat[]).map((format) => (
                        <button key={format} type="button" onClick={() => addResponseFormat(format)}>
                          <FormatIcon format={format} /> {formatLabel(format)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="zalo-bot-format-inputs">
              {draft.responseItems.map((item) => (
                <div className="zalo-bot-format-input" key={item.id}>
                  <span className="zalo-bot-format-input-head">
                    <span className="zalo-bot-format-input-title">
                      <FormatIcon format={item.format} /> {formatLabel(item.format)} #{draft.responseItems.filter((entry) => entry.format === item.format).findIndex((entry) => entry.id === item.id) + 1}
                    </span>
                    {draft.requestEnabled ? (
                      <label className="zalo-bot-wait-request-check">
                        <input
                          checked={Boolean(item.waitForRequest || usesRequestToken(item.content))}
                          disabled={usesRequestToken(item.content)}
                          type="checkbox"
                          onChange={(event) => updateResponseItemWait(item.id, event.target.checked)}
                        />
                        <span>Đợi request</span>
                      </label>
                    ) : null}
                    <button
                      className="zalo-bot-remove-doc"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        removeResponseItem(item.id);
                      }}
                      title="Xóa tài liệu gửi này"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                  {item.format === "text" ? (
                    <ZaloSummernoteEditor
                      id={`zalo-bot-text-${item.id}`}
                      placeholder={formatPayloadPlaceholder(item.format)}
                      value={item.content}
                      textStyles={item.textStyles}
                      onChange={(value, styles, cursor) => updateResponseItem(item.id, value, styles, cursor ?? value.length)}
                      onCursorChange={(value, cursor) => updateResponseItem(item.id, value, undefined, cursor)}
                      onFocus={() => {
                        updateResponseItem(item.id, item.content, undefined, item.content.length);
                      }}
                      onBlur={() => window.setTimeout(() => setPayloadTokenItemId(null), 220)}
                    />
                  ) : (
                    <input
                      className="input"
                      placeholder={formatPayloadPlaceholder(item.format)}
                      value={item.content}
                      onChange={(event) => updateResponseItem(item.id, event.target.value, undefined, event.target.selectionStart ?? event.target.value.length)}
                      onFocus={(event) => {
                        const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
                        updateResponseItem(item.id, event.currentTarget.value, undefined, cursor);
                      }}
                      onKeyUp={(event) => {
                        const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
                        updateResponseItem(item.id, event.currentTarget.value, undefined, cursor);
                      }}
                      onClick={(event) => {
                        const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
                        updateResponseItem(item.id, event.currentTarget.value, undefined, cursor);
                      }}
                      onBlur={() => window.setTimeout(() => setPayloadTokenItemId(null), 120)}
                    />
                  )}
                  {payloadTokenItemId === item.id && payloadTokenOptions.length ? (
                    <div className="zalo-bot-payload-suggest">
                      {payloadTokenOptions.map(([token, desc]) => (
                        <button
                          key={token}
                          type="button"
                          onMouseDownCapture={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            applyPayloadToken(item.id, token);
                          }}
                        >
                          <strong>{token}</strong>
                          <span>{desc}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <small className="zalo-bot-field-help">
                    {item.format === "text"
                      ? <>Mỗi ô Text là một tin nhắn. Có thể dùng @request.name, @request.price hoặc @request.customer.name.</>
                      : <>Mỗi ô {formatLabel(item.format).toLowerCase()} là một link. Có thể dùng link thật hoặc @request.{item.format}_url.</>}
                  </small>
                </div>
              ))}
            </div>
          </div>

          <div className="zalo-bot-actions">
            <button className="btn btn-secondary" type="button" onClick={closeCommandForm}>
              <Icon name="x" size={16} /> Đóng
            </button>
            <button className="btn btn-red" type="button" onClick={saveDraft}>
              <Plus size={17} /> {editingId ? "Cập nhật lệnh" : "Thêm vào bảng lệnh"}
            </button>
          </div>
        </section>
        </div>
        ) : null}

        <section className="card pad zalo-bot-special-card">
          <div className="between zalo-bot-special-head">
            <div>
              <h2><Clock size={19} /> Lệnh đặc biệt</h2>
              <p className="subtitle">Các lệnh tự động chạy theo trạng thái của tài khoản, không cần text gọi lệnh.</p>
            </div>
          </div>

          <div className="zalo-bot-special-body">
            <div className="zalo-bot-special-toggle">
              <input
                checked={specialSettings.awayEnabled}
                disabled={specialSaving}
                type="checkbox"
                onChange={(event) => toggleAwayEnabled(event.target.checked)}
              />
              <span>
                <strong>Tự động reply khi vắng mặt</strong>
                <small>Chỉ tự động trả lời tin nhắn riêng user, không gửi trong group.</small>
              </span>
              <button className="btn btn-secondary" type="button" onClick={() => setSpecialModalOpen("away")}>
                <Settings2 size={16} /> Setting
              </button>
            </div>
            {[
              {
                checked: specialSettings.welcomeEnabled || specialSettings.goodbyeEnabled,
                title: "Tin nhắn chào mừng / tạm biệt group",
                help: "Gửi khi thành viên tham gia hoặc rời nhóm, có hỗ trợ ảnh kèm caption.",
                modal: "welcome" as SpecialModalType,
                onChange: (checked: boolean) => saveSpecialSettingsQuick({ ...specialSettings, welcomeEnabled: checked, goodbyeEnabled: checked }, checked ? "Đã bật tin nhắn chào mừng / tạm biệt." : "Đã tắt tin nhắn chào mừng / tạm biệt."),
              },
              {
                checked: specialSettings.antiSpamEnabled,
                title: "Chống spam tin nhắn group",
                help: "Xóa tin nhắn spam trong group và có thể tự động kích khỏi nhóm (Trưởng nhóm & Phó nhóm được miễn trừ).",
                modal: "spam" as SpecialModalType,
                onChange: (checked: boolean) => saveSpecialSettingsQuick({ ...specialSettings, antiSpamEnabled: checked }, checked ? "Đã bật chống spam group." : "Đã tắt chống spam group."),
              },
              {
                checked: specialSettings.antiLinkEnabled,
                title: "Chống gửi link vô group",
                help: "Xóa tin nhắn chứa link lạ, whitelist mỗi dòng một link và có thể tự động kích (Trưởng nhóm & Phó nhóm được miễn trừ).",
                modal: "link" as SpecialModalType,
                onChange: (checked: boolean) => saveSpecialSettingsQuick({ ...specialSettings, antiLinkEnabled: checked }, checked ? "Đã bật chống gửi link group." : "Đã tắt chống gửi link group."),
              },
              {
                checked: Boolean(specialSettings.autoJoinGroupsEnabled),
                title: "Tự động tham gia nhóm (Auto Join Group)",
                help: "Tự động gia nhập nhóm Zalo khi có link group (zalo.me/g/...) gửi trong 1vs1 hoặc trong group.",
                modal: "autojoin" as SpecialModalType,
                onChange: (checked: boolean) =>
                  saveSpecialSettingsQuick(
                    {
                      ...specialSettings,
                      autoJoinGroupsEnabled: checked,
                    },
                    checked ? "Đã bật tự động tham gia nhóm." : "Đã tắt tự động tham gia nhóm."
                  ),
              },
            ].map((item) => (
              <div className="zalo-bot-special-toggle" key={item.title}>
                <input
                  checked={item.checked}
                  disabled={specialSaving}
                  type="checkbox"
                  onChange={(event) => item.onChange(event.target.checked)}
                />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.help}</small>
                </span>
                {item.modal ? (
                  <button className="btn btn-secondary" type="button" onClick={() => setSpecialModalOpen(item.modal)}>
                    <Settings2 size={16} /> Setting
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {specialModalOpen ? (
          <div className="modal-backdrop" onMouseDown={() => setSpecialModalOpen(null)}>
            <section className="zalo-bot-content-modal" role="dialog" aria-modal="true" aria-labelledby="zalo-bot-special-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="between">
                <div>
                  <h2 id="zalo-bot-special-title">
                    {specialModalOpen === "away" ? "Setting tự động reply khi vắng mặt" : null}
                    {specialModalOpen === "welcome" ? "Setting chào mừng / tạm biệt group" : null}
                    {specialModalOpen === "spam" ? "Setting chống spam tin nhắn group" : null}
                    {specialModalOpen === "link" ? "Setting chống gửi link vô group" : null}
                    {specialModalOpen === "autojoin" ? "Setting tự động tham gia nhóm (Auto Join Group)" : null}
                  </h2>
                  <p className="subtitle">{selectedAccount?.display_name || selectedAccount?.own_id || "Tài khoản Zalo"}</p>
                </div>
                <button className="icon-btn" type="button" onClick={() => setSpecialModalOpen(null)} aria-label="Đóng">
                  <Icon name="x" size={16} />
                </button>
              </div>

              {specialModalOpen === "away" ? (
              <>
              <label className="zalo-bot-special-toggle">
                <input
                  checked={specialSettings.awayEnabled}
                  disabled={specialSaving}
                  type="checkbox"
                  onChange={(event) => toggleAwayEnabled(event.target.checked)}
                />
                <span>
                  <strong>Tự động reply khi vắng mặt</strong>
                  <small>Chỉ tự động trả lời tin nhắn riêng user, không gửi trong group.</small>
                </span>
              </label>

              <div className="zalo-bot-special-body">
            <div className="zalo-bot-special-grid">
              <label className="zalo-bot-field full">
                <span>Nội dung trả lời</span>
                <ZaloSummernoteEditor
                  id="zalo-bot-special-away-text"
                  placeholder="Ví dụ: Hiện shop đang vắng mặt, mình sẽ phản hồi bạn sớm nhất."
                  value={specialSettings.awayText}
                  textStyles={specialSettings.awayTextStyles}
                  onChange={(value, styles, cursor) => {
                    setSpecialSettings((current) => ({ ...current, awayText: value, awayTextStyles: styles }));
                    updateSpecialTokenSuggest("awayText", value, cursor ?? value.length);
                  }}
                  onCursorChange={(value, cursor) => updateSpecialTokenSuggest("awayText", value, cursor)}
                  onFocus={() => updateSpecialTokenSuggest("awayText", specialSettings.awayText)}
                  onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "awayText" ? null : current), 220)}
                />
                {specialSuggest("awayText")}
              </label>

              <label className="zalo-bot-field">
                <span>Link ảnh gửi kèm</span>
                <input
                  className="input"
                  placeholder="https://cdn.example.com/away.jpg"
                  value={specialSettings.awayImageUrl}
                  onChange={(event) => {
                    setSpecialSettings((current) => ({ ...current, awayImageUrl: event.target.value }));
                    updateSpecialTokenSuggest("awayImageUrl", event.target.value, event.target.selectionStart ?? event.target.value.length);
                  }}
                  onFocus={(event) => updateSpecialTokenSuggest("awayImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                  onKeyUp={(event) => updateSpecialTokenSuggest("awayImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                  onClick={(event) => updateSpecialTokenSuggest("awayImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)}
                  onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "awayImageUrl" ? null : current), 120)}
                />
                {specialSuggest("awayImageUrl")}
              </label>

              <label className="zalo-bot-field">
                <span>Gửi lại sau</span>
                <input
                  className="input"
                  min={1}
                  type="number"
                  value={specialSettings.awayCooldownMinutes}
                  onChange={(event) => setSpecialSettings((current) => ({ ...current, awayCooldownMinutes: Number(event.target.value || 1) }))}
                />
                <small className="zalo-bot-field-help">Tính bằng phút. Ví dụ 60 là sau 1 giờ có tin nhắn mới thì gửi lại.</small>
              </label>
            </div>
              </div>
              </>
              ) : null}

            {specialModalOpen === "welcome" ? (
            <>
            <div className="zalo-bot-special-section">
              <h3>Tin nhắn chào mừng group</h3>
              <label className="zalo-bot-request-check">
                <input checked={specialSettings.welcomeEnabled} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, welcomeEnabled: event.target.checked }))} />
                <span>Bật tin nhắn chào mừng khi có thành viên tham gia group</span>
              </label>
              {specialSettings.welcomeEnabled ? (
              <div className="zalo-bot-special-grid">
                <label className="zalo-bot-field full">
                  <span>Nội dung chào mừng</span>
                  <ZaloSummernoteEditor id="zalo-bot-special-welcome-text" placeholder="Ví dụ: Chào mừng @user đến với @group_name." value={specialSettings.welcomeText} textStyles={specialSettings.welcomeTextStyles} onChange={(value, styles, cursor) => {
                    setSpecialSettings((current) => ({ ...current, welcomeText: value, welcomeTextStyles: styles }));
                    updateSpecialTokenSuggest("welcomeText", value, cursor ?? value.length);
                  }} onCursorChange={(value, cursor) => updateSpecialTokenSuggest("welcomeText", value, cursor)} onFocus={() => updateSpecialTokenSuggest("welcomeText", specialSettings.welcomeText)} onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "welcomeText" ? null : current), 220)} />
                  {specialSuggest("welcomeText")}
                  <small className="zalo-bot-field-help">Có thể dùng @user, @user_name, @user_id, @group_name, @group_id.</small>
                </label>
                <label className="zalo-bot-field">
                  <span>Link ảnh chào mừng</span>
                  <input className="input" placeholder="https://cdn.example.com/welcome.jpg" value={specialSettings.welcomeImageUrl} onChange={(event) => {
                    setSpecialSettings((current) => ({ ...current, welcomeImageUrl: event.target.value }));
                    updateSpecialTokenSuggest("welcomeImageUrl", event.target.value, event.target.selectionStart ?? event.target.value.length);
                  }} onFocus={(event) => updateSpecialTokenSuggest("welcomeImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)} onKeyUp={(event) => updateSpecialTokenSuggest("welcomeImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)} onClick={(event) => updateSpecialTokenSuggest("welcomeImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)} onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "welcomeImageUrl" ? null : current), 120)} />
                  {specialSuggest("welcomeImageUrl")}
                </label>
              </div>
              ) : null}
            </div>

            <div className="zalo-bot-special-section">
              <h3>Tin nhắn tạm biệt group</h3>
              <label className="zalo-bot-request-check">
                <input checked={specialSettings.goodbyeEnabled} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, goodbyeEnabled: event.target.checked }))} />
                <span>Bật tin nhắn tạm biệt khi thành viên rời group</span>
              </label>
              {specialSettings.goodbyeEnabled ? (
              <div className="zalo-bot-special-grid">
                <label className="zalo-bot-field full">
                  <span>Nội dung tạm biệt</span>
                  <ZaloSummernoteEditor id="zalo-bot-special-goodbye-text" placeholder="Ví dụ: Tạm biệt @user, hẹn gặp lại bạn." value={specialSettings.goodbyeText} textStyles={specialSettings.goodbyeTextStyles} onChange={(value, styles, cursor) => {
                    setSpecialSettings((current) => ({ ...current, goodbyeText: value, goodbyeTextStyles: styles }));
                    updateSpecialTokenSuggest("goodbyeText", value, cursor ?? value.length);
                  }} onCursorChange={(value, cursor) => updateSpecialTokenSuggest("goodbyeText", value, cursor)} onFocus={() => updateSpecialTokenSuggest("goodbyeText", specialSettings.goodbyeText)} onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "goodbyeText" ? null : current), 220)} />
                  {specialSuggest("goodbyeText")}
                </label>
                <label className="zalo-bot-field">
                  <span>Link ảnh tạm biệt</span>
                  <input className="input" placeholder="https://cdn.example.com/goodbye.jpg" value={specialSettings.goodbyeImageUrl} onChange={(event) => {
                    setSpecialSettings((current) => ({ ...current, goodbyeImageUrl: event.target.value }));
                    updateSpecialTokenSuggest("goodbyeImageUrl", event.target.value, event.target.selectionStart ?? event.target.value.length);
                  }} onFocus={(event) => updateSpecialTokenSuggest("goodbyeImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)} onKeyUp={(event) => updateSpecialTokenSuggest("goodbyeImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)} onClick={(event) => updateSpecialTokenSuggest("goodbyeImageUrl", event.currentTarget.value, event.currentTarget.selectionStart ?? event.currentTarget.value.length)} onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "goodbyeImageUrl" ? null : current), 120)} />
                  {specialSuggest("goodbyeImageUrl")}
                </label>
              </div>
              ) : null}
            </div>
            </>
            ) : null}

            {specialModalOpen === "spam" ? (
            <div className="zalo-bot-special-section">
              <h3>Chống spam tin nhắn group</h3>
              <p className="zalo-bot-field-help" style={{ marginTop: 4, marginBottom: 12, color: "#10b981", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🛡️ <strong>Lưu ý:</strong> Trưởng nhóm và Phó nhóm luôn được miễn trừ, không bị xóa tin nhắn hoặc kích khỏi nhóm.</span>
              </p>
              <label className="zalo-bot-request-check">
                <input checked={specialSettings.antiSpamEnabled} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, antiSpamEnabled: event.target.checked }))} />
                <span>Bật xóa tin nhắn spam trong group</span>
              </label>
              <div className="zalo-bot-special-grid">
                <label className="zalo-bot-field">
                  <span>Số tin nhắn tối đa</span>
                  <input className="input" min={2} type="number" value={specialSettings.antiSpamLimit} onChange={(event) => setSpecialSettings((current) => ({ ...current, antiSpamLimit: Number(event.target.value || 2) }))} />
                </label>
                <label className="zalo-bot-field">
                  <span>Trong bao nhiêu giây</span>
                  <input className="input" min={5} type="number" value={specialSettings.antiSpamWindowSeconds} onChange={(event) => setSpecialSettings((current) => ({ ...current, antiSpamWindowSeconds: Number(event.target.value || 60) }))} />
                </label>
                <label className="zalo-bot-request-check full">
                  <input checked={specialSettings.antiSpamKickEnabled} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, antiSpamKickEnabled: event.target.checked }))} />
                  <span>Tự động kích khỏi nhóm sau nhiều lần spam</span>
                </label>
                {specialSettings.antiSpamKickEnabled ? (
                <label className="zalo-bot-field">
                  <span>Số lần vi phạm để kích</span>
                  <input className="input" min={1} type="number" value={specialSettings.antiSpamKickAfter} onChange={(event) => setSpecialSettings((current) => ({ ...current, antiSpamKickAfter: Number(event.target.value || 1) }))} />
                </label>
                ) : null}
                <label className="zalo-bot-request-check full">
                  <input checked={Boolean(specialSettings.antiSpamWarningEnabled)} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, antiSpamWarningEnabled: event.target.checked }))} />
                  <span>Hiển thị tin nhắn cảnh báo user khi vi phạm</span>
                </label>
                {specialSettings.antiSpamWarningEnabled ? (
                  <label className="zalo-bot-field full">
                    <span>Nội dung cảnh báo spam</span>
                    <ZaloSummernoteEditor id="zalo-bot-special-spam-warning" placeholder="Ví dụ: @user vui lòng không spam tin nhắn trong @group_name. Bạn đã vi phạm @violation_count lần." value={specialSettings.antiSpamWarningText || ""} textStyles={specialSettings.antiSpamWarningTextStyles || []} onChange={(value, styles, cursor) => {
                      setSpecialSettings((current) => ({ ...current, antiSpamWarningText: value, antiSpamWarningTextStyles: styles }));
                      updateSpecialTokenSuggest("antiSpamWarningText", value, cursor ?? value.length);
                    }} onCursorChange={(value, cursor) => updateSpecialTokenSuggest("antiSpamWarningText", value, cursor)} onFocus={() => updateSpecialTokenSuggest("antiSpamWarningText", specialSettings.antiSpamWarningText || "")} onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "antiSpamWarningText" ? null : current), 220)} />
                    {specialSuggest("antiSpamWarningText")}
                    <small className="zalo-bot-field-help">Dùng được @user, @user_name, @user_id, @group_name, @group_id, @violation_count, @violation_type.</small>
                  </label>
                ) : null}
              </div>
            </div>
            ) : null}

            {specialModalOpen === "link" ? (
            <div className="zalo-bot-special-section">
              <h3>Chống gửi link vô group</h3>
              <p className="zalo-bot-field-help" style={{ marginTop: 4, marginBottom: 12, color: "#10b981", display: "flex", alignItems: "center", gap: 6 }}>
                <span>🛡️ <strong>Lưu ý:</strong> Trưởng nhóm và Phó nhóm luôn được miễn trừ, được phép gửi link tự do mà không bị chặn hoặc kích.</span>
              </p>
              <label className="zalo-bot-request-check">
                <input checked={specialSettings.antiLinkEnabled} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, antiLinkEnabled: event.target.checked }))} />
                <span>Bật xóa tin nhắn chứa link lạ trong group</span>
              </label>
              <div className="zalo-bot-special-grid">
                <label className="zalo-bot-field full">
                  <span>Link được phép gửi</span>
                  <textarea className="input zalo-bot-textarea compact" placeholder={"techmax.vn\nzalo.me/shop\nhttps://example.com"} value={specialSettings.antiLinkAllowedText} onChange={(event) => setSpecialSettings((current) => ({ ...current, antiLinkAllowedText: event.target.value }))} />
                  <small className="zalo-bot-field-help">Mỗi dòng là một link/domain được phép gửi.</small>
                </label>
                <label className="zalo-bot-request-check full">
                  <input checked={specialSettings.antiLinkKickEnabled} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, antiLinkKickEnabled: event.target.checked }))} />
                  <span>Tự động kích khỏi nhóm sau nhiều lần gửi link lạ</span>
                </label>
                {specialSettings.antiLinkKickEnabled ? (
                <label className="zalo-bot-field">
                  <span>Số lần vi phạm để kích</span>
                  <input className="input" min={1} type="number" value={specialSettings.antiLinkKickAfter} onChange={(event) => setSpecialSettings((current) => ({ ...current, antiLinkKickAfter: Number(event.target.value || 1) }))} />
                </label>
                ) : null}
                <label className="zalo-bot-request-check full">
                  <input checked={Boolean(specialSettings.antiLinkWarningEnabled)} type="checkbox" onChange={(event) => setSpecialSettings((current) => ({ ...current, antiLinkWarningEnabled: event.target.checked }))} />
                  <span>Hiển thị tin nhắn cảnh báo user khi vi phạm</span>
                </label>
                {specialSettings.antiLinkWarningEnabled ? (
                  <label className="zalo-bot-field full">
                    <span>Nội dung cảnh báo link</span>
                    <ZaloSummernoteEditor id="zalo-bot-special-link-warning" placeholder="Ví dụ: @user không gửi link lạ vào @group_name. Link bị chặn: @blocked_url." value={specialSettings.antiLinkWarningText || ""} textStyles={specialSettings.antiLinkWarningTextStyles || []} onChange={(value, styles, cursor) => {
                      setSpecialSettings((current) => ({ ...current, antiLinkWarningText: value, antiLinkWarningTextStyles: styles }));
                      updateSpecialTokenSuggest("antiLinkWarningText", value, cursor ?? value.length);
                    }} onCursorChange={(value, cursor) => updateSpecialTokenSuggest("antiLinkWarningText", value, cursor)} onFocus={() => updateSpecialTokenSuggest("antiLinkWarningText", specialSettings.antiLinkWarningText || "")} onBlur={() => window.setTimeout(() => setSpecialTokenTarget((current) => current === "antiLinkWarningText" ? null : current), 220)} />
                    {specialSuggest("antiLinkWarningText")}
                    <small className="zalo-bot-field-help">Dùng được @user, @user_name, @user_id, @group_name, @group_id, @violation_count, @blocked_url, @blocked_urls.</small>
                  </label>
                ) : null}
              </div>
            </div>
            ) : null}

            {specialModalOpen === "autojoin" ? (
            <div className="zalo-bot-special-section">
              <h3>Tự động tham gia nhóm (Auto Join Group)</h3>
              <label className="zalo-bot-request-check">
                <input
                  checked={Boolean(specialSettings.autoLeaveRestrictedGroupsEnabled)}
                  type="checkbox"
                  onChange={(event) => setSpecialSettings((current) => ({ ...current, autoLeaveRestrictedGroupsEnabled: event.target.checked }))}
                />
                <span>Tự động thoát ngay khi mới join nếu nhóm cấm gửi tin nhắn</span>
              </label>
              <p className="zalo-bot-field-help" style={{ marginTop: 4, marginLeft: 24, color: "#94a3b8" }}>
                Chỉ kiểm tra 1 lần lúc vừa join nhóm qua link. Nếu nhóm cho phép nhắn tin thì sẽ ở lại trong nhóm (kể cả sau này nhóm có đổi cài đặt thì bot cũng không tự thoát).
              </p>
            </div>
            ) : null}

            <div className="zalo-bot-actions">
              <button className="btn btn-secondary" type="button" onClick={() => setSpecialModalOpen(null)}>
                <Icon name="x" size={16} /> Đóng
              </button>
              <button className="btn btn-red" disabled={specialSaving} type="button" onClick={saveSpecialSettings}>
                <Save size={16} /> {specialSaving ? "Đang lưu..." : "Lưu lệnh đặc biệt"}
              </button>
            </div>
        </section>
          </div>
        ) : null}

        <section className="card zalo-bot-table-card">
          <div className="between zalo-bot-table-head">
            <div>
              <h2>Bảng lệnh BOT Zalo</h2>
              <p className="subtitle">
                {selectedAccount ? `Đang setup cho ${selectedAccount.display_name || selectedAccount.own_id}.` : "Chọn tài khoản Zalo để gắn bộ lệnh."}
              </p>
            </div>
            <div className="zalo-bot-table-tools">
              <input className="input" placeholder="Tìm lệnh..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <button className="btn btn-red" type="button" onClick={openNewCommandForm}>
                <Plus size={16} /> Thêm lệnh
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="zalo-bot-table">
              <thead>
                <tr>
                  <th>Text gọi lệnh</th>
                  <th>Args</th>
                  <th>Định dạng</th>
                  <th>Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {!filteredCommands.length ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="zalo-bot-empty">Chưa có lệnh nào. Hãy thêm lệnh đầu tiên ở phần setup.</div>
                    </td>
                  </tr>
                ) : null}
                {paginatedCommands.map((command) => (
                  <tr key={command.id}>
                    <td><strong>{command.commandText}</strong></td>
                    <td>{command.argName || "Không bắt buộc"}</td>
                    <td>
                      <span className="zalo-bot-format">
                        {(command.responseFormats?.length ? command.responseFormats : [command.responseFormat || "text"]).map((format) => (
                          <button className="zalo-bot-format-chip" key={format} type="button" onClick={() => setViewingCommand(command)} title="Xem nội dung gửi">
                            <FormatIcon format={format} /> {formatLabel(format)}
                          </button>
                        ))}
                      </span>
                    </td>
                    <td>
                      <button className={command.enabled ? "status green zalo-bot-toggle" : "status red zalo-bot-toggle"} type="button" onClick={() => toggleCommand(command.id)}>
                        {command.enabled ? "Đang bật" : "Đang tắt"}
                      </button>
                    </td>
                    <td>
                      <div className="zalo-bot-row-actions">
                        <button className="icon-btn" title="Sửa lệnh" aria-label="Sửa lệnh" type="button" onClick={() => editCommand(command)}><Pencil size={16} /></button>
                        <button className="icon-btn" title="Nhân bản" aria-label="Nhân bản" type="button" onClick={() => duplicateCommand(command)}><Copy size={16} /></button>
                        <button className="icon-btn" title="Xóa lệnh" aria-label="Xóa lệnh" type="button" onClick={() => removeCommand(command.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="zalo-bot-pagination">
            <span>
              Hiển thị {commandPageFrom}-{commandPageTo} / {filteredCommands.length} lệnh
            </span>
            <div className="zalo-bot-pagination-actions">
              <select
                className="input"
                value={commandPageSize}
                onChange={(event) => setCommandPageSize(Number(event.target.value))}
                aria-label="Số lệnh mỗi trang"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>{option} / trang</option>
                ))}
              </select>
              <button className="btn btn-secondary" type="button" disabled={safeCommandPage <= 1} onClick={() => setCommandPage((value) => Math.max(1, value - 1))}>
                Trước
              </button>
              <strong>{safeCommandPage}/{commandTotalPages}</strong>
              <button className="btn btn-secondary" type="button" disabled={safeCommandPage >= commandTotalPages} onClick={() => setCommandPage((value) => Math.min(commandTotalPages, value + 1))}>
                Sau
              </button>
            </div>
          </div>
        </section>
        {viewingCommand ? (
          <div className="modal-backdrop" onMouseDown={() => setViewingCommand(null)}>
            <section className="zalo-bot-content-modal" role="dialog" aria-modal="true" aria-labelledby="zalo-bot-content-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="between">
                <div>
                  <h2 id="zalo-bot-content-title">Nội dung gửi</h2>
                  <p className="subtitle">{viewingCommand.commandText}</p>
                </div>
                <button className="icon-btn" type="button" onClick={() => setViewingCommand(null)} aria-label="Đóng">
                  <Icon name="x" size={16} />
                </button>
              </div>

              {viewingCommand.requestEnabled && viewingCommand.requestEndpoint ? (
                <div className="zalo-bot-content-block">
                  <strong>Request endpoint</strong>
                  <pre>{viewingCommand.requestEndpoint}</pre>
                </div>
              ) : null}

              <div className="zalo-bot-content-list">
                {(viewingCommand.responseItems?.length ? viewingCommand.responseItems : []).map((item, index) => (
                  <div className="zalo-bot-content-block" key={item.id || `${item.format}-${index}`}>
                    <strong><FormatIcon format={item.format} /> {formatLabel(item.format)} #{index + 1}</strong>
                    {item.format === "text" ? (
                      <div
                        className="zalo-bot-content-preview"
                        dangerouslySetInnerHTML={{ __html: item.content ? styleTextToHtml(item.content, item.textStyles || []) : "Chưa có nội dung" }}
                      />
                    ) : (
                      <pre>{item.content || "Chưa có nội dung"}</pre>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppFrame>
  );
}
