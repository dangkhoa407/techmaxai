"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppFrame, Icon, PageHeader, StatCard } from "../../../components";
import {
  createAiBotProduct,
  createAiBotTraining,
  deleteAiBotProduct,
  deleteAiBotTraining,
  fetchAiBotProducts,
  fetchAiBotTraining,
  fetchAiBots,
  formatVnd,
  importAiBotProducts,
  testAiBotTrainingApi,
  updateAiBotProduct,
  updateAiBotTraining,
  useAuthUser,
  type AiBot,
  type AiBotProduct,
  type AiBotTrainingAttachment,
  type AiBotTrainingCategory,
  type AiBotTrainingItem,
} from "../../../lib/auth";
import { showConfirm, showToast, showError } from "../../../lib/swal";

type Pair = { key: string; value: string };
type ApiConfig = {
  method: string;
  url: string;
  params: Pair[];
  headers: Pair[];
  body: string;
  last_result?: unknown;
};
type TrainingTab = AiBotTrainingCategory | "products" | "prompt";

const trainingCategories: { value: TrainingTab; label: string; desc: string; level: "required" | "recommended" | "optional" }[] = [
  { value: "knowledge", label: "Kiến thức", desc: "Thông tin sản phẩm, dịch vụ, giá, chính sách và dữ liệu nền.", level: "required" },
  { value: "consulting_skills", label: "Kỹ năng tư vấn", desc: "Cách hỏi nhu cầu, xử lý phản hồi, chốt hẹn và chăm sóc khách hàng.", level: "recommended" },
  { value: "training_documents", label: "Tài liệu đào tạo", desc: "Hình ảnh PNG, JPG, WEBP hoặc GIF dùng làm tài liệu tham khảo.", level: "recommended" },
  { value: "operation_rules", label: "Quy định hoạt động", desc: "Quy tắc trả lời, giới hạn tư vấn, điều không được nói hoặc cần chuyển nhân viên.", level: "recommended" },
  { value: "api_connection", label: "Kết nối API", desc: "Cấu hình request giống Postman để lấy dữ liệu từ API.", level: "optional" },
  { value: "prompt", label: "Prompt", desc: "Introduction prompt được đưa vào system prompt khi test hoặc chạy Bot AI.", level: "optional" },
];

const allowedTrainingTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const defaultCategory: AiBotTrainingCategory = "knowledge";
const trainingPageSize = 10;
const emptyApiConfig: ApiConfig = { method: "GET", url: "", params: [{ key: "", value: "" }], headers: [{ key: "", value: "" }], body: "" };
const emptyProductForm = {
  pricing_type: "fixed" as AiBotProduct["pricing_type"],
  external_product_id: "",
  platform: "",
  name: "",
  description: "",
  fixed_price: "",
  min_price: "",
  max_price: "",
  unit_price: "",
  unit_quantity: "",
  unit_name: "sp",
  min_quantity: "",
  max_quantity: "",
  allow_retail: false,
  negotiation_note: "",
  is_active: true,
};

function isTrainingCategory(value: string | null): value is TrainingTab {
  return trainingCategories.some((category) => category.value === value);
}

function formatFileSize(size: number) {
  if (!size) return "-";
  if (size < 1024 * 1024) return `${Math.round(size / 1024).toLocaleString("vi-VN")} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function attachmentTypeLabel(attachment: AiBotTrainingAttachment) {
  if (attachment.type.startsWith("image/")) return "Hình ảnh";
  return "File";
}

function fileToAttachment(file: File): Promise<AiBotTrainingAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, size: file.size, data_url: String(reader.result || "") });
    reader.onerror = () => reject(new Error(`Không thể đọc file ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function compactPairs(rows: Pair[]) {
  return rows.map((row) => ({ key: row.key.trim(), value: row.value })).filter((row) => row.key);
}

function parseApiConfig(text: string): ApiConfig {
  try {
    const parsed = JSON.parse(text || "{}");
    return {
      method: parsed.method || "GET",
      url: parsed.url || "",
      params: Array.isArray(parsed.params) && parsed.params.length ? parsed.params : [{ key: "", value: "" }],
      headers: Array.isArray(parsed.headers) && parsed.headers.length ? parsed.headers : [{ key: "", value: "" }],
      body: parsed.body || "",
      last_result: parsed.last_result,
    };
  } catch {
    return emptyApiConfig;
  }
}

function apiSummary(item: AiBotTrainingItem) {
  const config = parseApiConfig(item.content_text);
  return `${config.method || "GET"} ${config.url || "-"}`;
}

function categoryEmptyLabel(category: { level: "required" | "recommended" | "optional" }) {
  if (category.level === "required") return "Bắt buộc";
  if (category.level === "recommended") return "Cần thiết";
  return "Tuỳ chọn";
}

function promptCategoryLabel(value: AiBotTrainingCategory) {
  return trainingCategories.find((category) => category.value === value)?.label || value;
}

const trainedDataCategories: AiBotTrainingCategory[] = [
  "knowledge",
  "consulting_skills",
  "training_documents",
  "operation_rules",
  "api_connection",
];

function buildTrainedDataJson(trainingItems: AiBotTrainingItem[]) {
  const data = Object.fromEntries(
    trainedDataCategories.map((category) => [
      promptCategoryLabel(category),
      trainingItems
        .filter((item) => item.training_category === category)
        .map((item) => ({
          title: item.title,
          content: item.content_text,
          example: item.example_text || null,
          api_usage_when: item.api_usage_when || null,
          api_required_data: item.api_required_data || null,
          api_example: item.api_example || null,
          attachments: item.attachments.map((file) => ({
            name: file.name,
            type: file.type,
            url: file.url || file.data_url || null,
          })),
        })),
    ])
  );

  return JSON.stringify(data, null, 2);
}

const botResponseSchemaPrompt = `QUY TẮC FORMAT BẮT BUỘC:
Bạn bắt buộc chỉ được trả về JSON hợp lệ và không được trả về bất kỳ nội dung nào ngoài JSON.
Không dùng Markdown. Không bọc trong code block. Không giải thích ngoài JSON.

Schema JSON bắt buộc:
{
  "action": "reply | call_api | handover",
  "messages": [
    "Tin nhắn 1",
    "Tin nhắn 2"
  ],
  "image": "https://example.com/image.jpg hoặc null",
  "request": {
    "url": "",
    "method": "GET | POST | PUT | PATCH | DELETE",
    "headers": {},
    "payload": {}
  } hoặc null
}

Ý nghĩa:
- action = "reply": Trả lời bình thường, request = null.
- action = "call_api": Cần hệ thống gọi API, request phải chứa đầy đủ url, method, headers, payload.
- action = "handover": Chuyển cho nhân viên, request = null.
- image phải là URL ảnh phù hợp hoặc null.
- messages phải là mảng chuỗi, tối đa 8 tin nhắn.
- Nếu cuộc hội thoại đã kết thúc, khách chỉ xác nhận/cảm ơn/thả cảm xúc/nhắn nội dung không cần phản hồi, hoặc AI nhận biết không nên trả lời thêm, hãy trả về messages = [].
- Khi messages = [] thì không được thêm lời chào, câu hỏi tiếp tục, hay nội dung fallback.`;

function buildPromptPreview(bot: AiBot | null, trainingItems: AiBotTrainingItem[], promptText: string, includeFormatRules: boolean) {
  const groups = trainingItems.reduce<Record<string, unknown[]>>((result, item) => {
    const label = promptCategoryLabel(item.training_category);
    if (!result[label]) result[label] = [];
    result[label].push({
      title: item.title,
      content: item.content_text,
      example: item.example_text,
      api_usage_when: item.api_usage_when,
      api_required_data: item.api_required_data,
      api_example: item.api_example,

      attachments: item.attachments.map((file) => ({ name: file.name, type: file.type, url: file.url || file.data_url || null })),
    });
    return result;
  }, {});

  const preview = `${promptText}

DỮ LIỆU HỆ THỐNG:
${JSON.stringify({
    bot: bot ? {
      full_name: bot.full_name,
      gender: bot.gender,
      personality_description: bot.personality_description,
      extra_description: bot.extra_description,
      status: bot.status,
      model: bot.model,
    } : null,
    training_groups: groups,
  }, null, 2)}`;

  return includeFormatRules ? `${preview}

${botResponseSchemaPrompt}` : preview;
}

export default function BotTrainingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthUser();
  const botId = Number(params.id || 0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bot, setBot] = useState<AiBot | null>(null);
  const [trainingItems, setTrainingItems] = useState<AiBotTrainingItem[]>([]);
  const [products, setProducts] = useState<AiBotProduct[]>([]);
  const [activeCategory, setActiveCategory] = useState<TrainingTab>(() => {
    const tab = searchParams.get("tab");
    return isTrainingCategory(tab) ? tab : defaultCategory;
  });
  const [title, setTitle] = useState("");
  const [contentText, setContentText] = useState("");
  const [exampleText, setExampleText] = useState("");
  const [apiUsageWhen, setApiUsageWhen] = useState("");
  const [apiRequiredData, setApiRequiredData] = useState("");
  const [apiExample, setApiExample] = useState("");
  const [attachments, setAttachments] = useState<AiBotTrainingAttachment[]>([]);
  const [apiConfig, setApiConfig] = useState<ApiConfig>(emptyApiConfig);
  const [apiResult, setApiResult] = useState<unknown>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingApi, setTestingApi] = useState(false);
  const [trainingSearch, setTrainingSearch] = useState("");
  const [trainingPage, setTrainingPage] = useState(1);
  const [promptText, setPromptText] = useState("");
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [bulkProductsText, setBulkProductsText] = useState("");
  const [importingProducts, setImportingProducts] = useState(false);

  const currentCategory = trainingCategories.find((category) => category.value === activeCategory) || trainingCategories[0];
  const isApiTab = activeCategory === "api_connection";
  const isPromptTab = activeCategory === "prompt";
  const isProductsTab = activeCategory === "products";
  const requiredCategories = trainingCategories.filter((category) => category.level === "required");
  const visibleItems = useMemo(() => (isPromptTab || isProductsTab) ? [] : trainingItems.filter((item) => item.training_category === activeCategory), [activeCategory, isProductsTab, isPromptTab, trainingItems]);
  const filteredItems = useMemo(() => {
    const keyword = trainingSearch.trim().toLowerCase();
    if (!keyword) return visibleItems;
    return visibleItems.filter((item) => {
      const config = item.training_category === "api_connection" ? parseApiConfig(item.content_text) : null;
      return [
        item.title,
        item.content_text,
        item.example_text,
        item.api_usage_when,
        item.api_required_data,
        item.api_example,
        item.created_at,
        item.updated_at,
        item.training_category === "api_connection" ? apiSummary(item) : "",
        config?.last_result ? JSON.stringify(config.last_result) : "",
        ...item.attachments.map((file) => file.name),
      ].some((value) => String(value || "").toLowerCase().includes(keyword));
    });
  }, [trainingSearch, visibleItems]);
  const trainingPageCount = Math.max(1, Math.ceil(filteredItems.length / trainingPageSize));
  const safeTrainingPage = Math.min(trainingPage, trainingPageCount);
  const pagedItems = filteredItems.slice((safeTrainingPage - 1) * trainingPageSize, safeTrainingPage * trainingPageSize);
  const categoryCounts = useMemo(() => {
    const counts = new Map<TrainingTab, number>();
    for (const category of trainingCategories) counts.set(category.value, 0);
    for (const item of trainingItems) counts.set(item.training_category, (counts.get(item.training_category) || 0) + 1);
    counts.set("products", products.length);
    if (promptText.trim()) counts.set("prompt", 1);
    return counts;
  }, [products.length, promptText, trainingItems]);
  const completedRequired = requiredCategories.filter((category) => (categoryCounts.get(category.value) || 0) > 0).length;
  const isAdmin = user?.level === "admin";
  const promptPreview = useMemo(() => buildPromptPreview(bot, trainingItems, promptText, isAdmin), [bot, isAdmin, promptText, trainingItems]);
  const trainedDataJson = useMemo(() => buildTrainedDataJson(trainingItems), [trainingItems]);

  useEffect(() => {
    Promise.all([fetchAiBots(), fetchAiBotTraining(botId), fetchAiBotProducts(botId)])
      .then(([data, items, productRows]) => {
        const currentBot = data.bots.find((item) => item.id === botId) || null;
        setBot(currentBot);
        setPromptText(currentBot?.introduction_prompt || "");
        setTrainingItems(items);
        setProducts(productRows);
      })
      .catch((error) => {
        showError(error instanceof Error ? error.message : "Không thể tải phòng đào tạo.");
      })
      .finally(() => setLoading(false));
  }, [botId]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (isTrainingCategory(tab) && tab !== activeCategory) {
      setActiveCategory(tab);
      resetForm();
    }
  }, [searchParams]);

  useEffect(() => {
    setTrainingPage(1);
  }, [activeCategory, trainingSearch]);

  function setSuccess(text: string) {
    showToast(text);
  }

  function setError(error: unknown, fallback: string) {
    showToast(error instanceof Error ? error.message : fallback, "error");
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContentText("");
    setExampleText("");
    setApiUsageWhen("");
    setApiRequiredData("");
    setApiExample("");
    setAttachments([]);
    setApiConfig(emptyApiConfig);
    setApiResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetProductForm() {
    setEditingProductId(null);
    setProductForm(emptyProductForm);
  }

  function updateProductField<K extends keyof typeof emptyProductForm>(field: K, value: (typeof emptyProductForm)[K]) {
    setProductForm((current) => ({ ...current, [field]: value }));
  }

  async function onSaveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    try {
      const payload = {
        pricing_type: productForm.pricing_type,
        external_product_id: productForm.external_product_id,
        platform: productForm.platform,
        name: productForm.name,
        description: productForm.description,
        fixed_price: productForm.fixed_price ? Number(productForm.fixed_price) : null,
        min_price: productForm.min_price ? Number(productForm.min_price) : null,
        max_price: productForm.max_price ? Number(productForm.max_price) : null,
        unit_price: productForm.unit_price ? Number(productForm.unit_price) : null,
        unit_quantity: productForm.unit_quantity ? Number(productForm.unit_quantity) : null,
        unit_name: productForm.unit_name,
        min_quantity: productForm.min_quantity ? Number(productForm.min_quantity) : null,
        max_quantity: productForm.max_quantity ? Number(productForm.max_quantity) : null,
        allow_retail: productForm.allow_retail,
        negotiation_note: productForm.negotiation_note,
        is_active: productForm.is_active,
      };
      const nextProducts = editingProductId
        ? await updateAiBotProduct(botId, editingProductId, payload)
        : await createAiBotProduct(botId, payload);
      setProducts(nextProducts);
      resetProductForm();
      setSuccess(editingProductId ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm.");
    } catch (error) {
      setError(error, "Không thể lưu sản phẩm.");
    } finally {
      setSavingProduct(false);
    }
  }

  function onEditProduct(product: AiBotProduct) {
    setEditingProductId(product.id);
    setProductForm({
      pricing_type: product.pricing_type,
      external_product_id: product.external_product_id || "",
      platform: product.platform || "",
      name: product.name,
      description: product.description || "",
      fixed_price: product.fixed_price ? String(product.fixed_price) : "",
      min_price: product.min_price ? String(product.min_price) : "",
      max_price: product.max_price ? String(product.max_price) : "",
      unit_price: product.unit_price ? String(product.unit_price) : "",
      unit_quantity: product.unit_quantity ? String(product.unit_quantity) : "",
      unit_name: product.unit_name || "sp",
      min_quantity: product.min_quantity ? String(product.min_quantity) : "",
      max_quantity: product.max_quantity ? String(product.max_quantity) : "",
      allow_retail: product.allow_retail,
      negotiation_note: product.negotiation_note || "",
      is_active: product.is_active,
    });
  }

  async function onDeleteProduct(product: AiBotProduct) {
    if (!(await showConfirm(`Xoá sản phẩm "${product.name}"?`))) return;
    try {
      setProducts(await deleteAiBotProduct(botId, product.id));
      if (editingProductId === product.id) resetProductForm();
      setSuccess("Đã xoá sản phẩm.");
    } catch (error) {
      setError(error, "Không thể xoá sản phẩm.");
    }
  }

  async function onImportProducts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportingProducts(true);
    try {
      const result = await importAiBotProducts(botId, bulkProductsText);
      setProducts(result.products);
      const errorText = result.errors.length ? ` Bỏ qua ${result.errors.length} dòng lỗi.` : "";
      setSuccess(`Đã thêm ${result.created} và cập nhật ${result.updated} sản phẩm.${errorText}`);
      if (!result.errors.length) setBulkProductsText("");
    } catch (error) {
      setError(error, "Không thể import sản phẩm.");
    } finally {
      setImportingProducts(false);
    }
  }

  function switchTab(category: TrainingTab) {
    setActiveCategory(category);
    resetForm();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", category);
    router.replace(`/chatbot-ai/${botId}/training?${nextParams.toString()}`, { scroll: false });
  }

  function updatePair(kind: "params" | "headers", index: number, field: keyof Pair, value: string) {
    setApiConfig((current) => ({
      ...current,
      [kind]: current[kind].map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row),
    }));
  }

  function addPair(kind: "params" | "headers") {
    setApiConfig((current) => ({ ...current, [kind]: [...current[kind], { key: "", value: "" }] }));
  }

  function removePair(kind: "params" | "headers", index: number) {
    setApiConfig((current) => {
      const nextRows = current[kind].filter((_, rowIndex) => rowIndex !== index);
      return { ...current, [kind]: nextRows.length ? nextRows : [{ key: "", value: "" }] };
    });
  }

  async function onSelectFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      for (const file of files) {
        if (!allowedTrainingTypes.has(file.type)) throw new Error("Chỉ hỗ trợ file ảnh PNG, JPG, WEBP hoặc GIF.");
        if (file.size > 5 * 1024 * 1024) throw new Error("Mỗi file đào tạo phải nhỏ hơn 5MB.");
      }
      const nextFiles = [...attachments, ...(await Promise.all(files.map(fileToAttachment)))];
      if (nextFiles.filter((file) => file.type.startsWith("image/")).length > 5) throw new Error("Mỗi nội dung đào tạo chỉ được tối đa 5 ảnh.");
      setAttachments(nextFiles);
    } catch (error) {
      setError(error, "File đào tạo không hợp lệ.");
    } finally {
      event.target.value = "";
    }
  }

  async function onTestApi() {
    setTestingApi(true);
    try {
      const result = await testAiBotTrainingApi(botId, {
        method: apiConfig.method,
        url: apiConfig.url,
        params: compactPairs(apiConfig.params),
        headers: compactPairs(apiConfig.headers),
        body: apiConfig.body,
      });
      setApiResult(result);
      setSuccess("Đã lấy dữ liệu API thành công.");
    } catch (error) {
      setError(error, "Không thể lấy dữ liệu từ API.");
    } finally {
      setTestingApi(false);
    }
  }

  async function onSaveTraining(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const apiText = JSON.stringify({
        ...apiConfig,
        params: compactPairs(apiConfig.params),
        headers: compactPairs(apiConfig.headers),
        last_result: apiResult ?? apiConfig.last_result,
      }, null, 2);
      const payload = {
        training_category: activeCategory as AiBotTrainingCategory,
        title: title || (isApiTab ? `${apiConfig.method} ${apiConfig.url}` : ""),
        content_text: isApiTab ? apiText : contentText,
        example_text: isApiTab ? "" : exampleText,
        api_usage_when: isApiTab ? apiUsageWhen : "",
        api_required_data: isApiTab ? apiRequiredData : "",
        api_example: isApiTab ? apiExample : "",
        attachments: isApiTab ? [] : attachments,
      };
      if (editingId) {
        setTrainingItems(await updateAiBotTraining(botId, editingId, payload));
      } else {
        const result = await createAiBotTraining(botId, payload);
        setTrainingItems(result.trainingItems);
      }
      resetForm();
      setSuccess(editingId ? "Đã cập nhật nội dung đào tạo." : "Đã thêm nội dung đào tạo.");
    } catch (error) {
      setError(error, "Không thể lưu nội dung đào tạo.");
    } finally {
      setSaving(false);
    }
  }

  function onEditTraining(item: AiBotTrainingItem) {
    setActiveCategory(item.training_category);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("tab", item.training_category);
    router.replace(`/chatbot-ai/${botId}/training?${nextParams.toString()}`, { scroll: false });
    setEditingId(item.id);
    setTitle(item.title);
    setContentText(item.training_category === "api_connection" ? "" : item.content_text);
    setExampleText(item.training_category === "api_connection" ? "" : item.example_text || "");
    setApiUsageWhen(item.training_category === "api_connection" ? item.api_usage_when || "" : "");
    setApiRequiredData(item.training_category === "api_connection" ? item.api_required_data || "" : "");
    setApiExample(item.training_category === "api_connection" ? item.api_example || "" : "");
    setAttachments(item.attachments);
    const nextApiConfig = item.training_category === "api_connection" ? parseApiConfig(item.content_text) : emptyApiConfig;
    setApiConfig(nextApiConfig);
    setApiResult(nextApiConfig.last_result || null);
  }

  async function onDeleteTraining(item: AiBotTrainingItem) {
    if (!(await showConfirm(`Xoá nội dung đào tạo "${item.title}"?`))) return;
    try {
      const result = await deleteAiBotTraining(botId, item.id);
      setTrainingItems(result.trainingItems);
      if (editingId === item.id) resetForm();
      setSuccess("Đã xoá nội dung đào tạo.");
    } catch (error) {
      setError(error, "Không thể xoá nội dung đào tạo.");
    }
  }

  return (
    <AppFrame active="/chatbot-ai" title="Phòng đào tạo Bot AI">
      <PageHeader
        eyebrow="Phòng đào tạo"
        title={bot ? `Đào tạo Bot AI: ${bot.full_name}` : "Đào tạo Bot AI"}
        desc="Quản lý nội dung đào tạo cho bot AI. Kiến thức là bắt buộc; các tab kỹ năng, tài liệu và quy định là cần thiết."
        action={
          <div className="row">
            <Link className="btn btn-primary" href={`/chatbot-ai/${botId}/test`}><Icon name="message_circle" /> Test bot</Link>
            <Link className="btn btn-secondary" href="/chatbot-ai"><Icon name="chevron_left" /> Quay lại</Link>
          </div>
        }
      />

      <div className="stack">
        {/* Banners removed per toast request */}

        <section className="grid-4">
          <StatCard label="Nội dung" value={String(trainingItems.length)} help="Tổng nội dung đã thêm" icon="menu_book" />
          <StatCard label="Bắt buộc" value={`${completedRequired}/${requiredCategories.length}`} help="Kiến thức đã có nội dung" icon="check_circle" />
          <StatCard label="File" value={String(trainingItems.reduce((sum, item) => sum + item.attachment_count, 0))} help="Tổng file đính kèm" icon="list_alt" />
          <StatCard label="Ảnh" value={String(trainingItems.reduce((sum, item) => sum + item.image_count, 0))} help="Tổng ảnh đào tạo" icon="smart_toy" />
        </section>

        <section className="card">
          <div style={{ padding: 18, borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
            <div className="row" style={{ minWidth: 780, gap: 10 }}>
              {trainingCategories.map((category) => {
                const count = categoryCounts.get(category.value) || 0;
                return (
                  <button className={activeCategory === category.value ? "btn btn-primary" : "btn btn-secondary"} key={category.value} type="button" onClick={() => switchTab(category.value)} style={{ justifyContent: "space-between", minWidth: 150 }}>
                    <span>{category.label}</span>
                    <span className={`status ${count ? "green" : "orange"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="between" style={{ padding: 22, borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 style={{ margin: 0 }}>{currentCategory.label}</h2>
              <p className="subtitle">{currentCategory.desc}</p>
            </div>
            <span className={`status ${(categoryCounts.get(activeCategory) || 0) ? "green" : "orange"}`}>{(categoryCounts.get(activeCategory) || 0) ? "Đã có nội dung" : categoryEmptyLabel(currentCategory)}</span>
          </div>

          {isProductsTab ? (
            <div className="stack" style={{ padding: 22 }}>
              <form className="stack" onSubmit={onImportProducts} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                <div>
                  <h3 style={{ margin: 0 }}>Import nhiều sản phẩm</h3>
                  <p className="subtitle">Dán JSON hoặc PHP array có id, name, platform, unit, rate_per_1000, min, max, notes. ID trùng sẽ được cập nhật.</p>
                </div>
                <textarea
                  className="input"
                  rows={7}
                  value={bulkProductsText}
                  onChange={(event) => setBulkProductsText(event.target.value)}
                  placeholder={`[
  {
    "id": "facebook_follow_viet",
    "name": "Follow Facebook Việt",
    "platform": "facebook",
    "unit": "follow",
    "rate_per_1000": 30000,
    "min": 100,
    "max": 100000,
    "notes": "Follow trang cá nhân Facebook..."
  }
]`}
                />
                <button className="btn btn-secondary" type="submit" disabled={importingProducts || !bulkProductsText.trim()}>
                  <Icon name="upload" size={18} /> {importingProducts ? "Đang import..." : "Import sản phẩm"}
                </button>
              </form>

              <form className="stack" onSubmit={onSaveProduct}>
                <div className="between">
                  <div>
                    <h3 style={{ margin: 0 }}>{editingProductId ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}</h3>
                    <p className="subtitle">Bot sẽ dùng dữ liệu này để báo giá, tư vấn và thương lượng với khách.</p>
                  </div>
                  {editingProductId ? <button className="btn btn-secondary" type="button" onClick={resetProductForm}>Huỷ sửa</button> : null}
                </div>

                <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                  <label>
                    <span className="muted" style={{ display: "block", marginBottom: 8 }}>Tên sản phẩm</span>
                    <input className="input" value={productForm.name} onChange={(event) => updateProductField("name", event.target.value)} placeholder="Ví dụ: Gói chăm sóc fanpage" />
                  </label>
                  <label>
                    <span className="muted" style={{ display: "block", marginBottom: 8 }}>ID sản phẩm</span>
                    <input className="input" value={productForm.external_product_id} onChange={(event) => updateProductField("external_product_id", event.target.value)} placeholder="Ví dụ: SP-001 hoặc 12345" />
                  </label>
                  <label>
                    <span className="muted" style={{ display: "block", marginBottom: 8 }}>Nền tảng</span>
                    <input className="input" value={productForm.platform} onChange={(event) => updateProductField("platform", event.target.value)} placeholder="Ví dụ: facebook, tiktok, combo" />
                  </label>
                  <label>
                    <span className="muted" style={{ display: "block", marginBottom: 8 }}>Kiểu giá</span>
                    <select className="input" value={productForm.pricing_type} onChange={(event) => updateProductField("pricing_type", event.target.value as AiBotProduct["pricing_type"])}>
                      <option value="fixed">Giá cố định</option>
                      <option value="quantity">Giá theo số lượng</option>
                      <option value="negotiable">Giá thương lượng</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Mô tả sản phẩm</span>
                  <textarea className="input" rows={4} value={productForm.description} onChange={(event) => updateProductField("description", event.target.value)} placeholder="Thông tin chính, lợi ích, điều kiện bán..." />
                </label>

                {productForm.pricing_type === "fixed" ? (
                  <label>
                    <span className="muted" style={{ display: "block", marginBottom: 8 }}>Giá cố định</span>
                    <input className="input" inputMode="numeric" value={productForm.fixed_price} onChange={(event) => updateProductField("fixed_price", event.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 500000" />
                  </label>
                ) : productForm.pricing_type === "quantity" ? (
                  <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    <label>
                      <span className="muted" style={{ display: "block", marginBottom: 8 }}>Giá mỗi block</span>
                      <input className="input" inputMode="numeric" value={productForm.unit_price} onChange={(event) => updateProductField("unit_price", event.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 30000" />
                    </label>
                    <label>
                      <span className="muted" style={{ display: "block", marginBottom: 8 }}>Số lượng mỗi block</span>
                      <input className="input" inputMode="numeric" value={productForm.unit_quantity} onChange={(event) => updateProductField("unit_quantity", event.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 1000" />
                    </label>
                    <label>
                      <span className="muted" style={{ display: "block", marginBottom: 8 }}>Đơn vị</span>
                      <input className="input" value={productForm.unit_name} onChange={(event) => updateProductField("unit_name", event.target.value)} placeholder="Ví dụ: sp" />
                    </label>
                    <label>
                      <span className="muted" style={{ display: "block", marginBottom: 8 }}>Tối thiểu (theo đơn vị)</span>
                      <input className="input" inputMode="numeric" value={productForm.min_quantity} onChange={(event) => updateProductField("min_quantity", event.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 100" />
                    </label>
                    <label>
                      <span className="muted" style={{ display: "block", marginBottom: 8 }}>Tối đa (theo đơn vị)</span>
                      <input className="input" inputMode="numeric" value={productForm.max_quantity} onChange={(event) => updateProductField("max_quantity", event.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 100000" />
                    </label>
                    <label className="row" style={{ alignItems: "center", gridColumn: "1 / -1" }}>
                      <input type="checkbox" checked={productForm.allow_retail} onChange={(event) => updateProductField("allow_retail", event.target.checked)} />
                      <span>Cho phép bán lẻ theo tỷ lệ block</span>
                    </label>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                      <label>
                        <span className="muted" style={{ display: "block", marginBottom: 8 }}>Giá thấp nhất được chốt</span>
                        <input className="input" inputMode="numeric" value={productForm.min_price} onChange={(event) => updateProductField("min_price", event.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 450000" />
                      </label>
                      <label>
                        <span className="muted" style={{ display: "block", marginBottom: 8 }}>Giá cao nhất / giá niêm yết</span>
                        <input className="input" inputMode="numeric" value={productForm.max_price} onChange={(event) => updateProductField("max_price", event.target.value.replace(/\D/g, ""))} placeholder="Ví dụ: 700000" />
                      </label>
                    </div>
                    <label>
                      <span className="muted" style={{ display: "block", marginBottom: 8 }}>Hướng dẫn thương lượng</span>
                      <textarea className="input" rows={4} value={productForm.negotiation_note} onChange={(event) => updateProductField("negotiation_note", event.target.value)} placeholder="Ví dụ: ưu tiên chốt từ 600k, chỉ xuống 450k nếu khách mua trong hôm nay." />
                    </label>
                  </>
                )}

                <label className="row" style={{ alignItems: "center" }}>
                  <input type="checkbox" checked={productForm.is_active} onChange={(event) => updateProductField("is_active", event.target.checked)} />
                  <span>Cho bot sử dụng sản phẩm này</span>
                </label>

                <button className="btn btn-primary" type="submit" disabled={savingProduct}>
                  <Icon name={editingProductId ? "check" : "add"} size={18} /> {savingProduct ? "Đang lưu..." : editingProductId ? "Lưu sản phẩm" : "Thêm sản phẩm"}
                </button>
              </form>

              <div className="table-scroll">
                <table className="datatable">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Kiểu giá</th>
                      <th>Giá</th>
                      <th>Trạng thái</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length ? products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          {product.external_product_id ? <div className="muted" style={{ marginTop: 4 }}>ID web: {product.external_product_id}</div> : null}
                          {product.platform ? <div className="muted" style={{ marginTop: 4 }}>Nền tảng: {product.platform}</div> : null}
                          <div className="muted" style={{ marginTop: 4 }}>{product.description || "-"}</div>
                        </td>
                        <td>{product.pricing_type === "fixed" ? "Cố định" : product.pricing_type === "quantity" ? "Theo số lượng" : "Thương lượng"}</td>
                        <td>
                          {product.pricing_type === "fixed"
                            ? formatVnd(product.fixed_price)
                            : product.pricing_type === "quantity"
                              ? `${formatVnd(product.unit_price)} / ${Number(product.unit_quantity || 0).toLocaleString("vi-VN")} ${product.unit_name || "sp"}`
                              : `${formatVnd(product.min_price)} - ${formatVnd(product.max_price)}`}
                          {product.pricing_type === "quantity" && product.allow_retail ? (
                            <div className="muted" style={{ marginTop: 4 }}>Cho phép bán lẻ theo tỷ lệ</div>
                          ) : null}
                          {product.pricing_type === "quantity" && (product.min_quantity || product.max_quantity) ? (
                            <div className="muted" style={{ marginTop: 4 }}>
                              {Number(product.min_quantity || 0).toLocaleString("vi-VN")} - {Number(product.max_quantity || 0).toLocaleString("vi-VN")} {product.unit_name || "sp"}
                            </div>
                          ) : null}
                        </td>
                        <td><span className={`status ${product.is_active ? "green" : "orange"}`}>{product.is_active ? "Đang dùng" : "Tạm tắt"}</span></td>
                        <td>
                          <div className="row">
                            <button className="btn btn-secondary" type="button" onClick={() => onEditProduct(product)}><Icon name="edit_note" size={16} /> Sửa</button>
                            <button className="btn btn-secondary" style={{ color: "#ff8f96" }} type="button" onClick={() => onDeleteProduct(product)}><Icon name="x" size={16} /> Xoá</button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5}>
                          <div className="activity-empty">
                            <strong>Chưa có sản phẩm</strong>
                            <p>Thêm sản phẩm để bot có thể báo giá, tư vấn và thương lượng chính xác hơn.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : isPromptTab ? (
            <div className="stack" style={{ padding: 22 }}>
              <div className="between">
                <div>
                  <h3 style={{ margin: 0 }}>Dữ liệu JSON đã train</h3>
                  <p className="subtitle">Tổng hợp dữ liệu đã lưu từ 5 nhóm đào tạo của bot.</p>
                </div>
              </div>
              <label>
                <span className="muted" style={{ display: "block", marginBottom: 8 }}>JSON: Kiến thức, Kỹ năng tư vấn, Tài liệu đào tạo, Quy định hoạt động, Kết nối API</span>
                <textarea className="input" rows={28} value={trainedDataJson} readOnly style={{ opacity: 0.92 }} />
              </label>
              {isAdmin ? (
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Prompt đầy đủ sẽ gửi AI (admin)</span>
                  <textarea className="input" rows={14} value={promptPreview} readOnly style={{ opacity: 0.72 }} />
                </label>
              ) : null}
              <p className="subtitle" style={{ margin: 0 }}>Phần preview dữ liệu train chỉ để xem. Muốn sửa dữ liệu train, hãy chỉnh trong từng tab Kiến thức, Kỹ năng, Tài liệu, Quy định hoặc Kết nối API.</p>
            </div>
          ) : (
            <>
          <form className="stack" style={{ padding: 22, borderBottom: "1px solid var(--border)" }} onSubmit={onSaveTraining}>
            <div className="between">
              <div>
                <h3 style={{ margin: 0 }}>{editingId ? "Chỉnh sửa nội dung" : `Thêm nội dung ${currentCategory.label}`}</h3>
                <p className="subtitle">{isApiTab ? "Nhập request giống Postman, gửi thử để lấy dữ liệu rồi lưu vào bot." : "Nội dung mới sẽ được lưu vào tab đang chọn."}</p>
              </div>
              {editingId ? <button className="btn btn-secondary" type="button" onClick={resetForm}>Huỷ sửa</button> : null}
            </div>

            <label>
              <span className="muted" style={{ display: "block", marginBottom: 8 }}>Tên nội dung</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={isApiTab ? "Ví dụ: Lấy danh sách sản phẩm" : "Ví dụ: Chính sách bảo hành"} />
            </label>

            {isApiTab ? (
              <>
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Khi nào cần sử dụng API</span>
                  <textarea className="input" rows={4} value={apiUsageWhen} onChange={(event) => setApiUsageWhen(event.target.value)} placeholder="Ví dụ: Khi khách hỏi tồn kho, trạng thái đơn hàng, điểm tích luỹ hoặc dữ liệu thay đổi theo thời gian thực." />
                </label>

                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Yêu cầu dữ liệu bắt buộc cần có để gửi request</span>
                  <textarea className="input" rows={4} value={apiRequiredData} onChange={(event) => setApiRequiredData(event.target.value)} placeholder="Ví dụ: Cần có số điện thoại khách hàng và mã đơn hàng trước khi gọi API kiểm tra đơn." />
                </label>

                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Ví dụ</span>
                  <textarea className="input" rows={4} value={apiExample} onChange={(event) => setApiExample(event.target.value)} placeholder="Ví dụ: Khách hỏi 'Đơn DH123 của tôi tới đâu rồi?' thì lấy mã DH123 gửi vào query order_code." />
                </label>


                <div style={{ display: "grid", gap: 12, gridTemplateColumns: "150px 1fr" }}>
                  <label>
                    <span className="muted" style={{ display: "block", marginBottom: 8 }}>Method</span>
                    <select className="input" value={apiConfig.method} onChange={(event) => setApiConfig((current) => ({ ...current, method: event.target.value }))}>
                      {["GET", "POST", "PUT", "PATCH", "DELETE"].map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="muted" style={{ display: "block", marginBottom: 8 }}>URL</span>
                    <input className="input" value={apiConfig.url} onChange={(event) => setApiConfig((current) => ({ ...current, url: event.target.value }))} placeholder="https://api.example.com/products" />
                  </label>
                </div>

                {(["params", "headers"] as const).map((kind) => (
                  <div className="card pad" key={kind} style={{ padding: 16 }}>
                    <div className="between" style={{ marginBottom: 12 }}>
                      <strong>{kind === "params" ? "Params" : "Headers"}</strong>
                      <button className="btn btn-secondary" type="button" onClick={() => addPair(kind)}><Icon name="add" size={16} /> Thêm dòng</button>
                    </div>
                    <div className="stack">
                      {apiConfig[kind].map((row, index) => (
                        <div key={`${kind}-${index}`} style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr auto" }}>
                          <input className="input" value={row.key} onChange={(event) => updatePair(kind, index, "key", event.target.value)} placeholder="Key" />
                          <input className="input" value={row.value} onChange={(event) => updatePair(kind, index, "value", event.target.value)} placeholder="Value" />
                          <button className="btn btn-secondary" type="button" onClick={() => removePair(kind, index)}><Icon name="x" size={16} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Body JSON / raw</span>
                  <textarea className="input" rows={7} value={apiConfig.body} onChange={(event) => setApiConfig((current) => ({ ...current, body: event.target.value }))} placeholder='{"keyword":"demo"}' />
                </label>

                <div className="row">
                  <button className="btn btn-secondary" type="button" onClick={onTestApi} disabled={testingApi || !apiConfig.url.trim()}>
                    <Icon name="update" size={18} /> {testingApi ? "Đang gửi..." : "Gửi thử"}
                  </button>
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    <Icon name={editingId ? "check" : "add"} size={18} /> {saving ? "Đang lưu..." : editingId ? "Lưu API" : "Lưu API"}
                  </button>
                </div>

                {apiResult ? (
                  <div className="card pad" style={{ padding: 16 }}>
                    <strong>Response</strong>
                    <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", marginBottom: 0 }}>{JSON.stringify(apiResult, null, 2)}</pre>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Nội dung văn bản</span>
                  <textarea className="input" rows={7} value={contentText} onChange={(event) => setContentText(event.target.value)} placeholder="Nhập nội dung đào tạo cho bot..." />
                </label>
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>Ví dụ</span>
                  <textarea className="input" rows={5} value={exampleText} onChange={(event) => setExampleText(event.target.value)} placeholder="Nhập ví dụ câu hỏi/câu trả lời để bot học cách áp dụng nội dung này..." />
                </label>
                <label>
                  <span className="muted" style={{ display: "block", marginBottom: 8 }}>File đính kèm</span>
                  <input ref={fileInputRef} className="input" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif" onChange={onSelectFiles} />
                </label>
                {attachments.length ? (
                  <div className="grid-2">
                    {attachments.map((file, index) => (
                      <div className="between card pad" key={`${file.name}-${index}`} style={{ padding: 12 }}>
                        <span><strong>{file.name}</strong><br /><span className="muted">{attachmentTypeLabel(file)} · {formatFileSize(file.size)}</span></span>
                        <button className="btn btn-secondary" type="button" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="x" size={14} /></button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <Icon name={editingId ? "check" : "add"} size={18} /> {saving ? "Đang lưu..." : editingId ? "Lưu nội dung" : "Thêm nội dung"}
                </button>
              </>
            )}
          </form>

          <div className="activity-search" style={{ borderRadius: 0, borderInline: 0 }}>
            <div className="activity-search-input">
              <Icon name="search" size={20} />
              <input
                className="input"
                onChange={(event) => setTrainingSearch(event.target.value)}
                placeholder={`Tìm nội dung trong mục ${currentCategory.label}...`}
                value={trainingSearch}
              />
            </div>
            <button className="btn btn-secondary" onClick={() => setTrainingPage(1)} type="button">
              <Icon name="filter_list" size={18} />
              Tìm kiếm
            </button>
          </div>

          <div className="table-scroll">
            <table className="datatable training-table">
              <thead>
                <tr>
                  <th>Tên nội dung</th>
                  <th>{isApiTab ? "Request" : "Nội dung"}</th>
                  <th>{isApiTab ? "Kết quả gần nhất" : "File"}</th>
                  {!isApiTab ? <th>Ảnh</th> : null}
                  <th>Cập nhật</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={isApiTab ? 5 : 6} style={{ textAlign: "center" }}>Đang tải phòng đào tạo...</td></tr>
                ) : pagedItems.length ? pagedItems.map((item) => {
                  const config = isApiTab ? parseApiConfig(item.content_text) : null;
                  return (
                    <tr key={item.id}>
                      <td className="training-table-title"><strong>{item.title}</strong></td>
                      <td className="training-table-content">
                        {isApiTab ? (
                          <>
                            <strong>{apiSummary(item)}</strong>

                            {item.api_usage_when ? <div className="muted" style={{ marginTop: 6 }}>Khi dùng: {item.api_usage_when.slice(0, 160)}</div> : null}
                            {item.api_required_data ? <div className="muted" style={{ marginTop: 4 }}>Dữ liệu bắt buộc: {item.api_required_data.slice(0, 160)}</div> : null}
                            {item.api_example ? <div className="muted" style={{ marginTop: 4 }}>Ví dụ: {item.api_example.slice(0, 160)}</div> : null}
                          </>
                        ) : (
                          <>
                            <div>{item.content_text ? item.content_text.slice(0, 220) : "Chỉ dùng file đính kèm"}</div>
                            {item.example_text ? <div className="muted" style={{ marginTop: 6 }}>Ví dụ: {item.example_text.slice(0, 180)}</div> : null}
                          </>
                        )}
                      </td>
                      <td className="training-table-files">
                        {isApiTab ? (
                          config?.last_result ? <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{JSON.stringify(config.last_result, null, 2).slice(0, 700)}</pre> : "-"
                        ) : item.attachments.length ? item.attachments.map((file, index) => (
                          <div key={`${item.id}-${file.name}-${index}`}><a href={file.data_url} download={file.name}>{file.name}</a><span className="muted"> · {formatFileSize(file.size)}</span></div>
                        )) : "-"}
                      </td>
                      {!isApiTab ? <td>{item.image_count}/5</td> : null}
                      <td>{item.updated_at || item.created_at || "-"}</td>
                      <td className="training-table-actions">
                        <div className="row">
                          <button className="btn btn-secondary" type="button" onClick={() => onEditTraining(item)}><Icon name="edit_note" size={16} /> Chỉnh sửa chi tiết</button>
                          <button className="btn btn-secondary" style={{ color: "#ff8f96" }} type="button" onClick={() => onDeleteTraining(item)}><Icon name="x" size={16} /> Xoá</button>
                        </div>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={isApiTab ? 5 : 6}>
                      <div className="activity-empty">
                        <strong>{visibleItems.length ? "Không tìm thấy nội dung" : `Chưa có nội dung trong mục ${currentCategory.label}`}</strong>
                        <p>{visibleItems.length ? "Thử tìm bằng tên, nội dung, file hoặc thời gian cập nhật khác." : "Thêm nội dung mới để bot có dữ liệu học trong tab này."}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="activity-pagination">
            <p>Tổng: {filteredItems.length} nội dung • Trang {safeTrainingPage}/{trainingPageCount}</p>
            <div className="row">
              <button className="btn btn-secondary" disabled={safeTrainingPage <= 1} onClick={() => setTrainingPage(safeTrainingPage - 1)} type="button">‹</button>
              <button className="btn btn-primary" type="button">{safeTrainingPage}</button>
              <button className="btn btn-secondary" disabled={safeTrainingPage >= trainingPageCount} onClick={() => setTrainingPage(safeTrainingPage + 1)} type="button">›</button>
            </div>
          </div>
            </>
          )}
        </section>
      </div>
    </AppFrame>
  );
}
