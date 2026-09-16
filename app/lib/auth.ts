"use client";

import { useEffect, useState } from "react";

export type UserProfile = {
  id: number;
  fullname: string;
  email: string;
  phone: string | null;
  address: string | null;
  region: string | null;
  tax_code: string | null;
  province_city: string | null;
  company: string | null;
  citizen_id: string | null;
  avatar_url: string | null;
  verified_badge: boolean;
  money: number;
  marketing_balance: number;
  sales_balance: number;
  plan_code: string | null;
  plan_name: string | null;
  plan_price: number;
  plan_started_at: string | null;
  plan_expires_at: string | null;
  campaign_usage_count: number;
  automation_usage_count: number;
  plan_active: boolean;
  security_alerts_enabled: boolean;
  two_factor_enabled: boolean;
  session_count: number;
  password_changed_at: string | null;
  status: string;
  level: string;
  created_at?: string;
};

export type ZaloAccount = {
  id: number;
  own_id: string;
  phone_number: string | null;
  display_name: string | null;
  proxy: string | null;
  status: string;
  source: string;
  ai_enabled: boolean;
  ai_bot_id: number | null;
  command_bot_enabled?: boolean;
  connected_at: string | null;
  last_seen_at: string | null;
  runtime_online?: boolean;
  listener_online?: boolean;
  realtime_status?: "online" | "connecting" | "offline" | "inactive" | "error" | string;
  realtime_status_text?: string;
};

export type ZaloBotFormat = "text" | "audio" | "image" | "video";

export type ZaloBotTextStyle = "b" | "i" | "u" | "s" | "c_db342e" | "c_f27806" | "c_f7b503" | "c_15a85f" | "f_13" | "f_18" | "lst_1" | "lst_2";

export type ZaloBotTextStyleRange = {
  start: number;
  len: number;
  st: ZaloBotTextStyle;
};

export type ZaloBotSendItem = {
  id: string;
  format: ZaloBotFormat;
  content: string;
  waitForRequest?: boolean;
  textStyles?: ZaloBotTextStyleRange[];
};

export type ZaloBotCommandPayload = {
  id: string;
  commandText: string;
  argName: string;
  argType?: "text" | "request";
  requestEnabled?: boolean;
  requestEndpoint?: string;
  missingArgsMessage?: string;
  missingArgsMessageStyles?: ZaloBotTextStyleRange[];
  responseFormat?: ZaloBotFormat;
  responseFormats?: ZaloBotFormat[];
  responsePayloads?: Partial<Record<ZaloBotFormat, string>>;
  responseItems: ZaloBotSendItem[];
  responseTemplate?: string;
  enabled: boolean;
};

export type ZaloBotSpecialSettings = {
  awayEnabled: boolean;
  awayText: string;
  awayTextStyles?: ZaloBotTextStyleRange[];
  awayImageUrl: string;
  awayImageCaption: string;
  awayImageCaptionStyles?: ZaloBotTextStyleRange[];
  awayCooldownMinutes: number;
  welcomeEnabled: boolean;
  welcomeText: string;
  welcomeTextStyles?: ZaloBotTextStyleRange[];
  welcomeImageUrl: string;
  welcomeImageCaption: string;
  welcomeImageCaptionStyles?: ZaloBotTextStyleRange[];
  goodbyeEnabled: boolean;
  goodbyeText: string;
  goodbyeTextStyles?: ZaloBotTextStyleRange[];
  goodbyeImageUrl: string;
  goodbyeImageCaption: string;
  goodbyeImageCaptionStyles?: ZaloBotTextStyleRange[];
  antiSpamEnabled: boolean;
  antiSpamLimit: number;
  antiSpamWindowSeconds: number;
  antiSpamKickEnabled: boolean;
  antiSpamKickAfter: number;
  antiSpamWarningEnabled?: boolean;
  antiSpamWarningText?: string;
  antiSpamWarningTextStyles?: ZaloBotTextStyleRange[];
  antiLinkEnabled: boolean;
  antiLinkAllowedText: string;
  antiLinkKickEnabled: boolean;
  antiLinkKickAfter: number;
  antiLinkWarningEnabled?: boolean;
  antiLinkWarningText?: string;
  antiLinkWarningTextStyles?: ZaloBotTextStyleRange[];
  autoJoinGroupsEnabled?: boolean;
  autoLeaveRestrictedGroupsEnabled?: boolean;
  autoJoinDelaySeconds?: number;
  autoLeaveDelaySeconds?: number;
};

export type UserProxy = {
  id: number;
  name: string | null;
  proxy: string;
  note: string | null;
  status: "active" | "inactive";
  created_at: string;
  updated_at: string;
};

export type ProxyCheckResult = {
  live: boolean;
  ip: string;
  country: string;
  latency_ms: number;
  checked_at: string;
  error?: string;
};

export type ZaloGroup = {
  id: number;
  zalo_account_id: number;
  group_id: string;
  group_name: string;
  member_count: number;
  can_send_message?: boolean;
  status: "active" | "missing";
  last_scanned_at: string | null;
  bot_enabled?: boolean;
};

export type ZaloFriend = {
  id: number;
  zalo_account_id: number;
  friend_id: string;
  friend_name: string;
  avatar_url: string | null;
  status: "active" | "missing";
  last_scanned_at: string | null;
};

export type ZaloGroupMember = {
  id: number;
  zalo_account_id: number;
  source_group_id: string;
  source_group_name: string;
  member_id: string;
  member_name: string;
  avatar_url: string | null;
  status: "active" | "missing";
  last_scanned_at: string | null;
};

export type ZaloCampaignTarget = {
  id: number;
  target_type?: "group" | "friend" | "member";
  group_id: string;
  group_name: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  error_message: string | null;
  raw_response?: unknown | null;
};

export type ZaloCampaign = {
  id: number;
  zalo_account_id: number;
  account_name: string | null;
  own_id: string | null;
  name: string;
  message: string;
  image: {
    type: "image";
    url: string;
    thumb?: string;
    filename?: string;
    size?: number | null;
    width?: number | null;
    height?: number | null;
  } | null;
  scheduled_at: string;
  next_run_at: string | null;
  last_run_at: string | null;
  schedule_type: "once" | "daily" | "custom";
  days_of_week: number[];
  scheduled_times?: string[];
  scheduled_datetimes?: string[];
  target_type?: "group" | "friend" | "member";
  delay_seconds: number;
  status: "scheduled" | "running" | "paused" | "completed" | "cancelled" | "failed";
  total_groups: number;
  sent_count: number;
  failed_count: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
  targets: ZaloCampaignTarget[];
};

export type ZaloCampaignStats = {
  total: number;
  scheduled: number;
  running: number;
  completed: number;
  failed: number;
};

export type FacebookPage = {
  id: number;
  page_id: string;
  page_name: string;
  category: string | null;
  permissions: string[];
  verify_token?: string | null;
  webhook_url?: string;
  ai_enabled: boolean;
  ai_bot_id: number | null;
  status: string;
  inbox_today: number;
  connected_at: string | null;
  last_seen_at: string | null;
};

export type AdminZaloAccount = ZaloAccount & {
  owner_id: number;
  owner_name: string;
  owner_email: string;
  bot_name: string | null;
};

export type AdminFacebookPage = FacebookPage & {
  owner_id: number;
  owner_name: string;
  owner_email: string;
  bot_name: string | null;
};

export type AdminFacebookAutoAccount = {
  id: string;
  deviceKeyHash: string | null;
  userId: string;
  name: string;
  facebookName: string | null;
  status: "active" | "checkpoint" | "invalid" | "unknown" | null;
  admin_disabled?: boolean;
  cookiePreview: string;
  createdAt: string | null;
  updatedAt: string | null;
  owner_id: number;
  owner_name: string;
  owner_email: string;
  job_status: "running" | "paused" | "completed" | "stopped" | null;
  job_progress: number;
  job_completed: number;
  job_total: number;
  job_started_at: string | null;
  job_updated_at: string | null;
};

export type AdminThreadsAutoAccount = Omit<AdminFacebookAutoAccount, "facebookName"> & {
  threadsName: string | null;
};

export type AdminFacebookAutoLog = {
  id: number;
  owner_id: number;
  account_user_id: string | null;
  level: "info" | "success" | "warn" | "error";
  message: string;
  created_at: string | null;
  owner_name: string;
  owner_email: string;
};

export type SocialAd = {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string | null;
  link_url: string;
  click_count: number;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
};

export type AdminFacebookAutoAccountDetail = {
  account: AdminFacebookAutoAccount;
  logs: AdminFacebookAutoLog[];
};

export type ChatSource = "fanpage" | "zalo" | "webchat";
export type ChatStatus = "open" | "waiting" | "resolved";

export type ChatMessage = {
  id: number;
  external_message_id: string | null;
  from: "customer" | "agent";
  sender_id: string | null;
  sender_name: string | null;
  type: string;
  text: string;
  quote?: {
    id: number | null;
    external_message_id?: string | null;
    cli_message_id?: string | null;
    text: string;
    name: string;
    from: "customer" | "agent" | null;
  } | null;
  attachments: ChatAttachment[];
  time: string;
};

export type ChatAttachment = {
  type?: string;
  url?: string;
  thumb?: string;
  title?: string;
  description?: string;
  filename?: string;
  size?: number | null;
  width?: number | null;
  height?: number | null;
};

export type ChatConversation = {
  id: number;
  source: ChatSource;
  source_ref_id: number | null;
  external_thread_id: string;
  external_user_id: string | null;
  kind: "user" | "group";
  customer: string;
  channel_name: string;
  avatar: string;
  avatar_url: string | null;
  last_message: string;
  time: string;
  unread: number;
  status: ChatStatus;
  ai_enabled: boolean;
  tags: string[];
  messages: ChatMessage[];
  owner?: {
    id: number;
    fullname: string | null;
    email: string | null;
  };
};

export type ChatStats = {
  total: number;
  fanpage: number;
  zalo: number;
  webchat: number;
  waiting: number;
  ignored_zalo_groups: number;
};

export type DashboardPayload = {
  user: UserProfile;
  plan: {
    code: string | null;
    name: string;
    price: number;
    cycle: string;
    expires_at: string | null;
    active: boolean;
    channel_limit: number | null;
    channel_limit_unlimited: boolean;
    message_limit: number | null;
    message_limit_unlimited: boolean;
    campaign_usage_limit: number | null;
    campaign_usage_unlimited: boolean;
    campaign_usage_used: number;
    automation_usage_limit: number | null;
    automation_usage_unlimited: boolean;
    automation_usage_used: number;
  };
  summary: {
    active_sessions: number;
    active_zalo: number;
    total_zalo: number;
    active_fanpage: number;
    active_channels: number;
    waiting_conversations: number;
    customer_messages_today: number;
    customers_today: number;
    customer_messages_month: number;
    customers_month: number;
    ai_replies_today: number;
    ai_usage_today: number;
  };
  message_chart: Array<{
    month: string;
    label: string;
    messages: number;
    customers: number;
  }>;
  recent_zalo_accounts: ZaloAccount[];
  dashboard_popup?: DashboardPopupSettings | null;
};

export type LiveChatWidget = {
  id: number;
  public_key: string;
  name: string;
  allowed_domains: string[];
  title: string;
  subtitle: string;
  accent_color: string;
  ai_enabled: boolean;
  ai_bot_id: number | null;
  status: "active" | "inactive";
  created_at?: string | null;
  updated_at?: string | null;
};

export type BankSetting = {
  id: number;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  branch: string | null;
  transfer_prefix: string;
  history_api_url: string;
  logo_data: string | null;
  mb_username?: string;
  mb_password?: string;
  mb_password_configured?: boolean;
  bank_status?: "active" | "inactive" | "error" | string;
  bank_last_checked_at?: string | null;
  bank_last_error?: string | null;
  bank_balance?: number | null;
  bank_balance_updated_at?: string | null;
  min_amount: number;
  max_amount: number;
  is_active?: boolean;
};

export type MailSetting = {
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass?: string;
  smtp_pass_configured?: boolean;
  from_name: string;
  from_email: string;
  is_enabled: boolean;
};

export type LandingSettings = {
  demo_video_url: string;
  demo_poster_url: string;
};

export type AuthSettings = {
  registration_trial_enabled: boolean;
  frontend_callback_url: string;
  google: {
    enabled: boolean;
    client_id: string;
    client_secret: string;
    redirect_uri: string;
  };
  facebook: {
    enabled: boolean;
    app_id: string;
    app_secret: string;
    redirect_uri: string;
  };
};

export type DashboardPopupSettings = {
  enabled: boolean;
  title: string;
  html: string;
  version: string;
  dismiss_hours: number;
};

export type ServicePlan = {
  id: number;
  code: string;
  name: string;
  price: number;
  days: number;
  cycle: string;
  description: string;
  bots: string;
  channels: string;
  messages: string;
  campaign_usage_limit: number | null;
  campaign_usage_unlimited: boolean;
  automation_usage_limit: number | null;
  automation_usage_unlimited: boolean;
  facebook_auto_usage_limit?: number | null;
  facebook_auto_usage_unlimited?: boolean;
  support: string;
  features: { text: string; included: boolean }[];
  popular: boolean;
  is_active: boolean;
  sort_order: number;
  ai_model_ids?: number[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type ServicePlanComparisonRow = {
  feature: string;
  starter?: string;
  professional?: string;
  enterprise?: string;
  [planCode: string]: string | undefined;
};

export type AiApiKey = {
  id: number;
  provider: "puter" | "gemini";
  label: string;
  key_preview: string;
  status: "active" | "inactive";
  sort_order: number;
  fail_count: number;
  last_error: string | null;
  last_used_at: string | null;
  created_at: string | null;
};

export type PuterAiModel = {
  puterId: string;
  id?: string;
  model_id?: string | null;
  name: string;
  provider?: string | null;
  modalities?: {
    input?: string[];
    output?: string[];
  } | null;
  aliases?: string[];
  knowledge?: string | null;
  release_date?: string | null;
  context?: number | null;
  max_tokens?: number | null;
  tool_call?: boolean;
  open_weights?: boolean;
  costs?: Record<string, number> | null;
  is_enabled?: boolean;
  allowed_plan_codes?: string[];
  is_plan_allowed?: boolean;
  upgrade_plan_code?: string | null;
  upgrade_plan_name?: string | null;
};

export type AiBot = {
  id: number;
  full_name: string;
  gender: string;
  personality_description: string;
  extra_description: string;
  introduction_prompt: string;
  status: "active" | "inactive";
  training_count: number;
  created_at: string | null;
  updated_at: string | null;
  model: Pick<PuterAiModel, "id" | "puterId" | "model_id" | "name" | "provider"> | null;
};

export type AdminAiBot = AiBot & {
  owner_id: number;
  owner_name: string;
  owner_email: string;
  zalo_account_count: number;
  facebook_page_count: number;
};

export type AiBotUsageStats = {
  plan: {
    code: string | null;
    name: string;
    messages: string;
    message_limit: number | null;
    message_limit_unlimited: boolean;
    campaign_usage_limit: number | null;
    campaign_usage_unlimited: boolean;
    campaign_usage_used: number;
    automation_usage_limit: number | null;
    automation_usage_unlimited: boolean;
    automation_usage_used: number;
  };
  summary: {
    usage_today: number;
    replies_today: number;
    errors_today: number;
    empty_today: number;
    logs_today: number;
    customers_today: number;
    customer_messages_today: number;
  };
  bots: Array<{
    id: number;
    full_name: string;
    status: "active" | "inactive";
    usage_today: number;
    replies_today: number;
    errors_today: number;
    empty_today: number;
    customers_today: number;
    last_used_at: string | null;
    last_error: { message: string; created_at: string | null } | null;
  }>;
  logs: Array<{
    id: number;
    bot_id: number | null;
    bot_name: string;
    source: string;
    source_ref_id: number | null;
    account_name: string;
    conversation_id: number | null;
    external_thread_id: string;
    customer_id: string;
    customer_name: string;
    status: "success" | "empty" | "error";
    usage_count: number;
    reply_count: number;
    error_message: string;
    payload: Record<string, unknown> | null;
    raw: Record<string, unknown> | null;
    created_at: string | null;
  }>;
};

export type AiBotTrainingAttachment = {
  name: string;
  type: string;
  size: number;
  path?: string | null;
  url?: string;
  data_url: string;
};

export type AiBotTrainingCategory =
  | "knowledge"
  | "consulting_skills"
  | "training_documents"
  | "operation_rules"
  | "api_connection";

export type AiBotTrainingItem = {
  id: number;
  bot_id: number;
  training_category: AiBotTrainingCategory;
  title: string;
  content_text: string;
  example_text: string;
  api_usage_when: string;
  api_required_data: string;
  api_example: string;
  attachments: AiBotTrainingAttachment[];
  attachment_count: number;
  image_count: number;
  created_at: string | null;
  updated_at: string | null;
};

export type AiBotProduct = {
  id: number;
  bot_id: number;
  pricing_type: "fixed" | "negotiable" | "quantity";
  external_product_id: string;
  platform: string;
  name: string;
  description: string;
  fixed_price: number | null;
  min_price: number | null;
  max_price: number | null;
  unit_price: number | null;
  unit_quantity: number | null;
  unit_name: string;
  min_quantity: number | null;
  max_quantity: number | null;
  allow_retail: boolean;
  negotiation_note: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ContractData = {
  contract_code?: string | null;
  title: string;
  contract_date?: string | null;
  signing_place?: string | null;
  party_a: {
    name: string | null;
    address?: string | null;
    tax_code?: string | null;
    representative?: string | null;
    position?: string | null;
    citizen_id?: string | null;
    issued_date?: string | null;
    issued_place?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  party_b: {
    name: string | null;
    address?: string | null;
    tax_code?: string | null;
    representative?: string | null;
    position?: string | null;
    citizen_id?: string | null;
    issued_date?: string | null;
    issued_place?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  };
  service: {
    package: string;
    start_date?: string | null;
    end_date?: string | null;
    value: number;
    value_text?: string | null;
    payment_method: string;
    overdue_days?: number;
    acceptance_days?: number;
  };
  signers?: {
    party_a?: string | null;
    party_b?: string | null;
  };
  signatures?: {
    party_a?: string | null;
    party_b?: string | null;
  };
  notes?: string | null;
};

export type AdminContract = {
  id: number;
  contract_code: string;
  title: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  service_package: string | null;
  contract_value: number;
  status: "draft" | "pending" | "signed" | "cancelled";
  status_text: string;
  tone: "blue" | "green" | "red" | "orange" | "gray";
  data: ContractData;
  sign_token: string | null;
  party_a_signature_data: string | null;
  party_a_signed_at: string | null;
  party_b_signature_data: string | null;
  party_b_signed_at: string | null;
  signed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type DepositInvoice = {
  id: number;
  invoice_code: string;
  transfer_content: string;
  amount: number;
  qr_url: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  status_text: string;
  tone: "blue" | "green" | "red" | "orange" | "gray";
  paid_at: string | null;
  expires_at: string;
  created_at: string;
  bank: BankSetting;
};

export type BalanceTransaction = {
  id: number;
  display_id: string;
  direction: "increase" | "decrease";
  direction_text: string;
  type: "deposit" | "package_payment" | "admin_adjustment" | "refund" | string;
  type_text: string;
  amount: number;
  change_amount: number;
  balance_after: number;
  reference: string;
  note: string;
  source: string;
  source_id: string;
  created_at: string | null;
};

export type BalanceTransactionStats = {
  current_balance: number;
  total_count: number;
  total_volume: number;
  balance_change: number;
  total_increase: number;
  total_decrease: number;
};

export type CustomerOrder = {
  id: number;
  payment_code: string;
  transfer_content: string;
  product_name: string;
  amount: number;
  qr_url: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  status_text: string;
  paid_at: string | null;
  expires_at: string | null;
  source: string;
  conversation_id: number | null;
  external_thread_id: string;
  customer_id: string;
  customer_name: string;
  bot_id: number | null;
  bot_name: string;
  external_product_id: string;
  paid_ref_no: string | null;
  payment_description: string | null;
  created_at: string | null;
  updated_at: string | null;
  bank: BankSetting;
};

export type CustomerOrderStats = {
  total_count: number;
  total_amount: number;
  paid_count: number;
  paid_amount: number;
  pending_count: number;
  pending_amount: number;
  expired_count: number;
  cancelled_count: number;
};

export type LoginSession = {
  session_id: string;
  current: boolean;
  device_name: string;
  device_type: string;
  browser: string;
  os: string;
  ip_address: string;
  location: string;
  created_at: string | null;
  last_seen_at: string | null;
  expires_at: string | null;
};

export type ActivityLog = {
  id: string;
  numeric_id: number;
  subject: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  tone: "blue" | "green" | "red" | "orange" | "gray";
  ip_address: string | null;
  device_name: string | null;
  time: string;
};

export type ActivityLogPayload = {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  page_count: number;
  stats?: {
    today_actions: number;
    system_errors: number;
    response_time_ms: number;
  };
};

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  tone: "blue" | "green" | "red" | "orange" | "gray";
  action_url: string | null;
  read_at: string | null;
  created_at: string;
  sender_name?: string | null;
  user_id?: number;
  user_name?: string;
  user_email?: string;
};

export type NotificationsPayload = {
  notifications: AppNotification[];
  unread_count: number;
};

export type Ticket = {
  id: number;
  subject: string;
  category: string | null;
  priority: "low" | "medium" | "high";
  body: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  attachments: string[];
  created_at: string;
  updated_at: string;
};

export type TicketStats = {
  open: number;
  in_progress: number;
  resolved: number;
};

type ApiPayload = {
  success: boolean;
  message?: string;
  token?: string;
  user?: UserProfile;
  accounts?: ZaloAccount[];
  groups?: ZaloGroup[];
  friends?: ZaloFriend[];
  members?: ZaloGroupMember[];
  campaigns?: ZaloCampaign[];
  pages?: FacebookPage[];
  conversations?: ChatConversation[];
  conversation?: ChatConversation;
  active_conversation_id?: number | null;
  plans?: ServicePlan[];
  plan?: ServicePlan;
  rows?: ServicePlanComparisonRow[];
  settings?: Record<string, any>;
  popup?: DashboardPopupSettings;
  bank?: BankSetting;
  invoice?: DepositInvoice;
  invoices?: DepositInvoice[];
  transactions?: BalanceTransaction[];
  orders?: CustomerOrder[];
  account?: ZaloAccount;
  sessions?: LoginSession[];
  session_token?: string;
  qr_image?: string;
  expires_at?: string;
  requires_qr?: boolean;
  reconnected?: boolean;
  status?: string;
  recovery_codes?: string[];
  two_factor_required?: boolean;
  two_factor_secret?: string;
  otpauth_uri?: string;
  logs?: ActivityLog[];
  notifications?: AppNotification[];
  unread_count?: number;
  sent_count?: number;
  total?: number;
  page?: number | FacebookPage;
  limit?: number;
  page_count?: number;
  stats?: ActivityLogPayload["stats"] | TicketStats | ChatStats | CustomerOrderStats | BalanceTransactionStats;
  ticket?: Ticket;
  tickets?: Ticket[];
  users?: any[];
  requires_verification?: boolean;
  email?: string;
  mail?: MailSetting;
  keys?: AiApiKey[];
  models?: PuterAiModel[];
  ai_models?: PuterAiModel[];
  selected_models?: PuterAiModel[];
  bots?: AiBot[];
  training_items?: AiBotTrainingItem[];
  products?: AiBotProduct[];
  created?: number;
  updated?: number;
  errors?: { row: number; id: string; name: string; message: string }[];
  used_key?: AiApiKey;
  contracts?: AdminContract[];
  contract?: AdminContract;
};

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "https://project.conkudaden.online/api").replace(/\/$/, "");
const TOKEN_KEY = "techmax_auth_token";
const USER_KEY = "techmax_auth_user";

export function formatVnd(value?: number | string | null) {
  const numericValue = Number(value ?? 0);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  return `${Math.round(safeValue).toLocaleString("vi-VN")} đ`;
}

function repairVietnameseText(value: string) {
  let text = value;

  if (/[ÃÂÄÅÆ]|áº|á»/.test(text)) {
    try {
      text = decodeURIComponent(
        Array.from(text)
          .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join("")
      );
    } catch {
      text = value;
    }
  }

  if (/^Email ho\?c m\?t kh\?u/i.test(text)) {
    return "Email ho\u1eb7c m\u1eadt kh\u1ea9u kh\u00f4ng \u0111\u00fang.";
  }

  const replacements: Array<[RegExp, string]> = [
    [/S\?\s*bot AI/g, "Số bot AI"],
    [/Cu\?c h\?i tho\?i AI m\?i ng[aà]y/g, "Cuộc hội thoại AI mỗi ngày"],
    [/L\?\?t ch\?y chi\?n d\?ch/g, "Lượt chạy chiến dịch"],
    [/L\?\?t d\?ng Auto Facebook\/Threads/g, "Lượt dùng Auto Facebook/Threads"],
    [/Kh[oô]ng gi\?i h\?n/g, "Không giới hạn"],
    [/Ð[aã]o t\?o AI/g, "Đào tạo AI"],
    [/G\?i tin nh\?n h[aà]ng lo\?t/g, "Gửi tin nhắn hàng loạt"],
    [/H\? tr\?/g, "Hỗ trợ"],
    [/Ti[eê]u chu\?n/g, "Tiêu chuẩn"],
    [/Uu ti[eê]n/g, "Ưu tiên"],
    [/Bao g\?m/g, "Bao gồm"],
    [/Kh[oô]ng bao g\?m/g, "Không bao gồm"],
    [/G\?i /g, "Gói "],
    [/d\?ch v\?/g, "dịch vụ"],
    [/Email ho\?c m\?t kh\?u kh[oô]ng d[úu]ng\./gi, "Email hoặc mật khẩu không đúng."],
    [/Email ho\?c m\?t kh\?u/g, "Email hoặc mật khẩu"],
    [/m\?t kh\?u/g, "mật khẩu"],
    [/M\?t kh\?u/g, "Mật khẩu"],
    [/ho\?c/g, "hoặc"],
    [/kh[oô]ng d[úu]ng/g, "không đúng"],
    [/kh[oô]ng h\?p l\?/g, "không hợp lệ"],
    [/Kh[oô]ng h\?p l\?/g, "Không hợp lệ"],
    [/x[aá]c th\?c/g, "xác thực"],
    [/X[aá]c th\?c/g, "Xác thực"],
    [/t[aà]i kho\?n/g, "tài khoản"],
    [/T[aà]i kho\?n/g, "Tài khoản"],
    [/nh\?p/g, "nhập"],
    [/Nh\?p/g, "Nhập"],
    [/kh[oô]ng th\?/gi, "không thể"],
    [/d[aă]ng nh\?p/gi, "đăng nhập"],
    [/d[aă]ng k[yý]/gi, "đăng ký"],
  ];

  return replacements.reduce((current, [pattern, replacement]) => current.replace(pattern, replacement), text);
}

function repairPayloadText<T>(value: T): T {
  if (typeof value === "string") return repairVietnameseText(value) as T;
  if (Array.isArray(value)) return value.map((item) => repairPayloadText(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, repairPayloadText(entry)])
    ) as T;
  }
  return value;
}

function emitAuthChange() {
  window.dispatchEvent(new Event("techmax-auth-change"));
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: UserProfile) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitAuthChange();
}

export function saveUser(user: UserProfile) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  emitAuthChange();
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  emitAuthChange();
}

export function authRedirectPath(user: Pick<UserProfile, "level"> | null | undefined) {
  return "/dashboard";
}

export function getOAuthStartUrl(provider: "google" | "facebook", mode: "login" | "register" = "login") {
  return `${API_BASE_URL}/auth/oauth/${provider}/start?mode=${encodeURIComponent(mode)}`;
}

export async function getOAuthStatus() {
  const payload = await parseResponse(await fetch(`${API_BASE_URL}/auth/oauth/status`));
  const providers = ((payload as ApiPayload & {
    providers?: {
      google?: { enabled?: boolean };
      facebook?: { enabled?: boolean };
    };
  }).providers || {}) as {
    google?: { enabled?: boolean };
    facebook?: { enabled?: boolean };
  };
  return {
    google: Boolean(providers.google?.enabled),
    facebook: Boolean(providers.facebook?.enabled),
  };
}

function defaultOAuthProviderRedirectUri(provider: "google" | "facebook") {
  return `${API_BASE_URL}/auth/oauth/${provider}/callback`;
}

function normalizeOAuthProviderRedirectUri(provider: "google" | "facebook", value?: string | null) {
  const text = String(value || "").trim();
  if (!text) return defaultOAuthProviderRedirectUri(provider);
  try {
    const url = new URL(text);
    if (!new RegExp(`/auth/oauth/${provider}/callback/?$`, "i").test(url.pathname)) {
      return defaultOAuthProviderRedirectUri(provider);
    }
    return text;
  } catch {
    return defaultOAuthProviderRedirectUri(provider);
  }
}

async function parseResponse(response: Response) {
  const payload = repairPayloadText((await response.json().catch(() => ({}))) as ApiPayload);

  if (!response.ok || !payload.success) {
    throw new Error(repairVietnameseText(payload.message || "Không thể kết nối máy chủ."));
  }

  return payload;
}

export async function registerUser(data: { fullname: string; email: string; password: string }) {
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );

  if (payload.requires_verification) {
    return { requires_verification: true, email: payload.email || data.email, message: payload.message };
  }

  if (!payload.token || !payload.user) {
    throw new Error("Server chưa trả đủ thông tin đăng ký.");
  }

  saveSession(payload.token, payload.user);
  return { requires_verification: false, user: payload.user };
}

export async function verifyRegisterEmail(data: { email: string; code: string }) {
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/register/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );

  if (!payload.token || !payload.user) {
    throw new Error("Server chưa trả đủ thông tin xác thực.");
  }

  saveSession(payload.token, payload.user);
  return payload.user;
}

export async function resendRegisterEmailCode(email: string) {
  return parseResponse(
    await fetch(`${API_BASE_URL}/register/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  );
}

export async function requestPasswordReset(email: string) {
  return parseResponse(
    await fetch(`${API_BASE_URL}/password/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  );
}

export async function resetPassword(data: { email: string; code: string; password: string }) {
  return parseResponse(
    await fetch(`${API_BASE_URL}/password/reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
}

export async function loginUser(data: { email: string; password: string; two_factor_code?: string }) {
  const response = await fetch(`${API_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const payload = (await response.json().catch(() => ({}))) as ApiPayload;

  if (!response.ok || !payload.success) {
    const error = new Error(payload.message || "Không thể đăng nhập.") as Error & { twoFactorRequired?: boolean };
    error.twoFactorRequired = payload.two_factor_required;
    throw error;
  }

  if (!payload.token || !payload.user) {
    throw new Error("Server chưa trả đủ thông tin đăng nhập.");
  }

  saveSession(payload.token, payload.user);
  return payload.user;
}

export async function fetchProfile() {
  const token = getToken();
  if (!token) return null;

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!payload.user) return null;
  saveUser(payload.user);
  return payload.user;
}

export async function updateProfile(data: Partial<UserProfile>) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/profile`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (!payload.user) {
    throw new Error("Server chưa trả thông tin hồ sơ.");
  }

  saveUser(payload.user);
  return payload.user;
}

export async function fetchDashboard(): Promise<DashboardPayload> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  const dashboardPayload = payload as unknown as Partial<DashboardPayload>;
  const user = dashboardPayload.user || getStoredUser();
  if (!user) throw new Error("Server chưa trả thông tin tài khoản.");
  if (dashboardPayload.user) saveUser(dashboardPayload.user);
  const plan = dashboardPayload.plan;
  const summary = dashboardPayload.summary;
  return {
    user,
    plan: plan || {
      code: null,
      name: "Chưa có gói",
      price: 0,
      cycle: "tháng",
      expires_at: null,
      active: false,
      channel_limit: 0,
      channel_limit_unlimited: false,
      message_limit: 0,
      message_limit_unlimited: false,
      campaign_usage_limit: 0,
      campaign_usage_unlimited: false,
      campaign_usage_used: 0,
      automation_usage_limit: 0,
      automation_usage_unlimited: false,
      automation_usage_used: 0,
    },
    summary: summary || {
      active_sessions: 0,
      active_zalo: 0,
      total_zalo: 0,
      active_fanpage: 0,
      active_channels: 0,
      waiting_conversations: 0,
      customer_messages_today: 0,
      customers_today: 0,
      customer_messages_month: 0,
      customers_month: 0,
      ai_replies_today: 0,
      ai_usage_today: 0,
    },
    message_chart: dashboardPayload.message_chart || [],
    recent_zalo_accounts: dashboardPayload.recent_zalo_accounts || [],
    dashboard_popup: dashboardPayload.dashboard_popup || null,
  };
}

export async function securityAction(data: Record<string, unknown>) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/security`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (payload.user) {
    saveUser(payload.user);
  }

  return payload;
}

export async function purchasePackage(planCode: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/packages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ plan_code: planCode }),
    })
  );

  if (!payload.user) {
    throw new Error("Server chưa trả thông tin gói dịch vụ.");
  }

  saveUser(payload.user);
  return payload;
}

export async function fetchServicePlans(): Promise<ServicePlan[]> {
  const payload = await parseResponse(await fetch(`${API_BASE_URL}/packages?_=${Date.now()}`, { cache: "no-store" }));
  return payload.plans || [];
}

export async function fetchServicePlanComparisonRows(): Promise<ServicePlanComparisonRow[]> {
  const payload = await parseResponse(await fetch(`${API_BASE_URL}/service-plan-comparison`));
  return payload.rows || [];
}

export async function fetchAdminServicePlans(): Promise<{ plans: ServicePlan[]; ai_models: PuterAiModel[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/service-plans`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return {
    plans: payload.plans || [],
    ai_models: payload.ai_models || [],
  };
}

export async function createAdminServicePlan(data: Partial<ServicePlan>): Promise<ServicePlan> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/service-plans`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
  if (!payload.plan) throw new Error("Server chưa trả thông tin gói.");
  return payload.plan;
}

export async function updateAdminServicePlan(planId: number, data: Partial<ServicePlan>): Promise<ServicePlan> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/service-plans/${planId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
  if (!payload.plan) throw new Error("Server chưa trả thông tin gói.");
  return payload.plan;
}

export async function deleteAdminServicePlan(planId: number): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/service-plans/${planId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return payload.message || "Đã xoá gói dịch vụ.";
}

export async function fetchDepositBank() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/deposit/bank`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!payload.bank) throw new Error("Chưa cấu hình ngân hàng nhận tiền.");
  return payload.bank;
}

export async function createDepositInvoice(amount: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/deposit/invoices`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount }),
    })
  );

  if (!payload.invoice) throw new Error("Server chưa trả thông tin hóa đơn.");
  return payload.invoice;
}

export async function fetchDepositInvoices() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/deposit/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.invoices || [];
}

export async function fetchDepositInvoice(id: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/deposit/invoices/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!payload.invoice) throw new Error("Không tìm thấy hóa đơn.");
  return payload.invoice;
}

export async function fetchBalanceChanges(params: {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  direction?: string;
} = {}): Promise<{
  transactions: BalanceTransaction[];
  stats: BalanceTransactionStats;
  total: number;
  page: number;
  limit: number;
  page_count: number;
}> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.type && params.type !== "all") query.set("type", params.type);
  if (params.direction && params.direction !== "all") query.set("direction", params.direction);

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/balance-changes${query.toString() ? `?${query.toString()}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    transactions: payload.transactions || [],
    stats: (payload.stats as BalanceTransactionStats) || {
      current_balance: 0,
      total_count: 0,
      total_volume: 0,
      balance_change: 0,
      total_increase: 0,
      total_decrease: 0,
    },
    total: Number(payload.total || 0),
    page: Number(payload.page || params.page || 1),
    limit: Number(payload.limit || params.limit || 10),
    page_count: Number(payload.page_count || 1),
  };
}

export async function fetchCustomerOrders(): Promise<{ orders: CustomerOrder[]; stats: CustomerOrderStats }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return {
    orders: payload.orders || [],
    stats: (payload.stats as CustomerOrderStats) || {
      total_count: 0,
      total_amount: 0,
      paid_count: 0,
      paid_amount: 0,
      pending_count: 0,
      pending_amount: 0,
      expired_count: 0,
      cancelled_count: 0,
    },
  };
}

export type FacebookAutoSystemSettings = { max_workers: number; headless_chrome: boolean; low_resource_mode: boolean };
export type FacebookAutoRuntimeSettings = { max_workers: number; headless_chrome: boolean; low_resource_mode: boolean };

export async function fetchAdminFacebookAutoSettings(): Promise<FacebookAutoSystemSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(await fetch(`${API_BASE_URL}/admin/facebook-auto-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  const settings = payload.settings as Partial<FacebookAutoSystemSettings> | undefined;
  return {
    max_workers: Number(settings?.max_workers ?? 5),
    headless_chrome: Boolean(settings?.headless_chrome ?? true),
    low_resource_mode: Boolean(settings?.low_resource_mode ?? true),
  };
}

export async function updateAdminFacebookAutoSettings(data: FacebookAutoSystemSettings): Promise<FacebookAutoSystemSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(await fetch(`${API_BASE_URL}/admin/facebook-auto-settings`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ max_workers: data.max_workers, headless_chrome: data.headless_chrome, low_resource_mode: data.low_resource_mode }),
  }));
  const settings = payload.settings as Partial<FacebookAutoSystemSettings> | undefined;
  return {
    max_workers: Number(settings?.max_workers ?? data.max_workers),
    headless_chrome: Boolean(settings?.headless_chrome ?? data.headless_chrome),
    low_resource_mode: Boolean(settings?.low_resource_mode ?? data.low_resource_mode),
  };
}

export async function fetchFacebookAutoRuntimeSettings(): Promise<FacebookAutoRuntimeSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(await fetch(`${API_BASE_URL}/facebook-auto/system-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  const settings = payload.settings as Partial<FacebookAutoRuntimeSettings> | undefined;
  return {
    max_workers: Number(settings?.max_workers ?? 5),
    headless_chrome: Boolean(settings?.headless_chrome ?? true),
    low_resource_mode: Boolean(settings?.low_resource_mode ?? true),
  };
}

export async function updateCustomerOrderStatus(orderId: number, status: "cancelled") {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
  );
}

export async function fetchAdminBankSetting(): Promise<BankSetting> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/bank`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!payload.bank) throw new Error("Không thể tải cấu hình ngân hàng.");
  return payload.bank as BankSetting;
}

export async function updateAdminBankSetting(data: Partial<BankSetting>): Promise<BankSetting> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/bank`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (!payload.bank) throw new Error("Server chưa trả cấu hình ngân hàng.");
  return payload.bank as BankSetting;
}

export async function fetchAdminMailSetting(): Promise<MailSetting> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/mail`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!payload.mail) throw new Error("Không thể tải cấu hình mail.");
  return payload.mail;
}

export async function updateAdminMailSetting(data: Partial<MailSetting>): Promise<MailSetting> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/mail`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (!payload.mail) throw new Error("Server chưa trả cấu hình mail.");
  return payload.mail;
}

export async function fetchLandingSettings(): Promise<LandingSettings> {
  const payload = await parseResponse(await fetch(`${API_BASE_URL}/landing-settings`));
  const settings = payload.settings as Partial<LandingSettings> | undefined;
  return {
    demo_video_url: settings?.demo_video_url || "",
    demo_poster_url: settings?.demo_poster_url || "/dashboard-preview.png",
  };
}

export async function fetchAdminLandingSettings(): Promise<LandingSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/landing-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  const settings = payload.settings as Partial<LandingSettings> | undefined;
  return {
    demo_video_url: settings?.demo_video_url || "",
    demo_poster_url: settings?.demo_poster_url || "/dashboard-preview.png",
  };
}

export async function updateAdminLandingSettings(data: LandingSettings): Promise<LandingSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/landing-settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  const settings = payload.settings as Partial<LandingSettings> | undefined;
  return {
    demo_video_url: settings?.demo_video_url || data.demo_video_url,
    demo_poster_url: settings?.demo_poster_url || data.demo_poster_url,
  };
}

export async function fetchAdminAuthSettings(): Promise<AuthSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/auth-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    registration_trial_enabled: Boolean(payload.settings?.registration_trial_enabled),
    frontend_callback_url: payload.settings?.frontend_callback_url || "",
    google: {
      enabled: Boolean(payload.settings?.google?.enabled),
      client_id: payload.settings?.google?.client_id || "",
      client_secret: payload.settings?.google?.client_secret || "",
      redirect_uri: normalizeOAuthProviderRedirectUri("google", payload.settings?.google?.redirect_uri),
    },
    facebook: {
      enabled: Boolean(payload.settings?.facebook?.enabled),
      app_id: payload.settings?.facebook?.app_id || "",
      app_secret: payload.settings?.facebook?.app_secret || "",
      redirect_uri: normalizeOAuthProviderRedirectUri("facebook", payload.settings?.facebook?.redirect_uri),
    },
  };
}

export async function updateAdminAuthSettings(data: AuthSettings): Promise<AuthSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/auth-settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_trial_enabled: data.registration_trial_enabled,
        frontend_callback_url: data.frontend_callback_url,
        google_enabled: data.google.enabled,
        google_client_id: data.google.client_id,
        google_client_secret: data.google.client_secret,
        google_redirect_uri: normalizeOAuthProviderRedirectUri("google", data.google.redirect_uri),
        facebook_enabled: data.facebook.enabled,
        facebook_app_id: data.facebook.app_id,
        facebook_app_secret: data.facebook.app_secret,
        facebook_redirect_uri: normalizeOAuthProviderRedirectUri("facebook", data.facebook.redirect_uri),
      }),
    })
  );

  return {
    registration_trial_enabled: Boolean(payload.settings?.registration_trial_enabled),
    frontend_callback_url: payload.settings?.frontend_callback_url || data.frontend_callback_url || "",
    google: {
      enabled: Boolean(payload.settings?.google?.enabled),
      client_id: payload.settings?.google?.client_id || data.google.client_id || "",
      client_secret: payload.settings?.google?.client_secret || data.google.client_secret || "",
      redirect_uri: normalizeOAuthProviderRedirectUri("google", payload.settings?.google?.redirect_uri || data.google.redirect_uri),
    },
    facebook: {
      enabled: Boolean(payload.settings?.facebook?.enabled),
      app_id: payload.settings?.facebook?.app_id || data.facebook.app_id || "",
      app_secret: payload.settings?.facebook?.app_secret || data.facebook.app_secret || "",
      redirect_uri: normalizeOAuthProviderRedirectUri("facebook", payload.settings?.facebook?.redirect_uri || data.facebook.redirect_uri),
    },
  };
}

export async function fetchAdminServicePlanComparisonRows(): Promise<ServicePlanComparisonRow[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/service-plan-comparison`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.rows || [];
}

export async function updateAdminServicePlanComparisonRows(rows: ServicePlanComparisonRow[]): Promise<ServicePlanComparisonRow[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/service-plan-comparison`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows }),
    })
  );

  return payload.rows || rows;
}

const defaultDashboardPopup: DashboardPopupSettings = {
  enabled: false,
  title: "Thông báo",
  html: "",
  version: "",
  dismiss_hours: 2,
};

export async function fetchAdminDashboardPopup(): Promise<DashboardPopupSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/dashboard-popup`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.popup || defaultDashboardPopup;
}

export async function updateAdminDashboardPopup(
  data: Pick<DashboardPopupSettings, "enabled" | "title" | "html">
): Promise<DashboardPopupSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/dashboard-popup`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return payload.popup || { ...defaultDashboardPopup, ...data };
}

export async function sendAdminMailTest(email: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/mail/test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    })
  );
}

export async function fetchAdminAi(): Promise<{ keys: AiApiKey[]; plans: ServicePlan[]; selected_models: PuterAiModel[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    keys: payload.keys || [],
    plans: payload.plans || [],
    selected_models: payload.selected_models || [],
  };
}

export async function addAdminAiKey(data: { api_key: string; label?: string; provider?: "puter" | "gemini" }): Promise<AiApiKey[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai/keys`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return payload.keys || [];
}

export async function updateAdminAiKey(
  keyId: number,
  data: { api_key?: string; label?: string; provider?: "puter" | "gemini"; status?: "active" | "inactive" }
): Promise<AiApiKey[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai/keys/${keyId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return payload.keys || [];
}

export async function deleteAdminAiKey(keyId: number): Promise<AiApiKey[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai/keys/${keyId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.keys || [];
}

export async function fetchPuterAiModels(): Promise<{ models: PuterAiModel[]; used_key?: AiApiKey }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai/models/puter`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    models: payload.models || [],
    used_key: payload.used_key,
  };
}

export async function fetchGeminiAiModels(): Promise<{ models: PuterAiModel[]; used_key?: AiApiKey }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai/models/gemini`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    models: payload.models || [],
    used_key: payload.used_key,
  };
}

export async function saveAdminAiModels(models: PuterAiModel[]): Promise<PuterAiModel[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai/models`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ models }),
    })
  );

  return payload.selected_models || [];
}

export async function fetchAiBots(): Promise<{ bots: AiBot[]; models: PuterAiModel[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    bots: payload.bots || [],
    models: payload.models || [],
  };
}

export async function fetchAiBotUsageStats(): Promise<AiBotUsageStats> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  const statsPayload = payload as unknown as Partial<AiBotUsageStats>;
  const plan = statsPayload.plan;

  return {
    plan: {
      code: plan?.code ?? null,
      name: plan?.name || "Chưa có gói",
      messages: plan?.messages || "",
      message_limit: typeof plan?.message_limit === "number" ? plan.message_limit : null,
      message_limit_unlimited: Boolean(plan?.message_limit_unlimited),
      campaign_usage_limit: typeof plan?.campaign_usage_limit === "number" ? plan.campaign_usage_limit : null,
      campaign_usage_unlimited: Boolean(plan?.campaign_usage_unlimited),
      campaign_usage_used: typeof plan?.campaign_usage_used === "number" ? plan.campaign_usage_used : 0,
      automation_usage_limit: typeof plan?.automation_usage_limit === "number" ? plan.automation_usage_limit : null,
      automation_usage_unlimited: Boolean(plan?.automation_usage_unlimited),
      automation_usage_used: typeof plan?.automation_usage_used === "number" ? plan.automation_usage_used : 0,
    },
    summary: statsPayload.summary || {
      usage_today: 0,
      replies_today: 0,
      errors_today: 0,
      empty_today: 0,
      logs_today: 0,
      customers_today: 0,
      customer_messages_today: 0,
    },
    bots: statsPayload.bots || [],
    logs: statsPayload.logs || [],
  };
}

export async function fetchLiveChatWidgets(): Promise<LiveChatWidget[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/livechat/widgets`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return (payload as unknown as { widgets?: LiveChatWidget[] }).widgets || [];
}

export async function createLiveChatWidget(data: {
  name?: string;
  allowed_domains?: string[] | string;
  title?: string;
  subtitle?: string;
  accent_color?: string;
  ai_enabled?: boolean;
  ai_bot_id?: number | null;
  status?: "active" | "inactive";
}): Promise<LiveChatWidget[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/livechat/widgets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
  return (payload as unknown as { widgets?: LiveChatWidget[] }).widgets || [];
}

export async function updateLiveChatWidget(widgetId: number, data: {
  name?: string;
  allowed_domains?: string[] | string;
  title?: string;
  subtitle?: string;
  accent_color?: string;
  ai_enabled?: boolean;
  ai_bot_id?: number | null;
  status?: "active" | "inactive";
}): Promise<LiveChatWidget[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/livechat/widgets/${widgetId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
  return (payload as unknown as { widgets?: LiveChatWidget[] }).widgets || [];
}

export async function deleteLiveChatWidget(widgetId: number): Promise<LiveChatWidget[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/livechat/widgets/${widgetId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return (payload as unknown as { widgets?: LiveChatWidget[] }).widgets || [];
}

export async function createAiBot(data: {
  full_name: string;
  gender: string;
  model_id: number;
  personality_description: string;
  extra_description?: string;
}): Promise<AiBot[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return payload.bots || [];
}

export async function updateAiBot(botId: number, data: {
  full_name?: string;
  gender?: string;
  model_id?: number;
  personality_description?: string;
  extra_description?: string;
  status?: "active" | "inactive";
}): Promise<AiBot[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return payload.bots || [];
}

export async function updateAiBotStatus(botId: number, status: "active" | "inactive"): Promise<AiBot[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    })
  );

  return payload.bots || [];
}

export async function deleteAiBot(botId: number): Promise<AiBot[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.bots || [];
}

export async function fetchAiBotTraining(botId: number): Promise<AiBotTrainingItem[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/training`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.training_items || [];
}

export async function createAiBotTraining(
  botId: number,
  data: { training_category: AiBotTrainingCategory; title: string; content_text?: string; example_text?: string; api_usage_when?: string; api_required_data?: string; api_example?: string; attachments?: AiBotTrainingAttachment[] }
): Promise<{ trainingItems: AiBotTrainingItem[]; bots: AiBot[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/training`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return { trainingItems: payload.training_items || [], bots: payload.bots || [] };
}

export async function updateAiBotTraining(
  botId: number,
  itemId: number,
  data: { training_category: AiBotTrainingCategory; title: string; content_text?: string; example_text?: string; api_usage_when?: string; api_required_data?: string; api_example?: string; attachments?: AiBotTrainingAttachment[] }
): Promise<AiBotTrainingItem[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/training/${itemId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return payload.training_items || [];
}

export async function deleteAiBotTraining(botId: number, itemId: number): Promise<{ trainingItems: AiBotTrainingItem[]; bots: AiBot[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/training/${itemId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return { trainingItems: payload.training_items || [], bots: payload.bots || [] };
}

export async function fetchAiBotProducts(botId: number): Promise<AiBotProduct[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/products`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return payload.products || [];
}

export async function createAiBotProduct(botId: number, data: Partial<AiBotProduct>): Promise<AiBotProduct[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/products`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
  return payload.products || [];
}

export async function importAiBotProducts(botId: number, rawText: string): Promise<{ products: AiBotProduct[]; created: number; updated: number; errors: { row: number; id: string; name: string; message: string }[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/products/bulk`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: rawText }),
    })
  );
  return { products: payload.products || [], created: Number(payload.created || 0), updated: Number(payload.updated || 0), errors: payload.errors || [] };
}

export async function updateAiBotProduct(botId: number, productId: number, data: Partial<AiBotProduct>): Promise<AiBotProduct[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/products/${productId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );
  return payload.products || [];
}

export async function deleteAiBotProduct(botId: number, productId: number): Promise<AiBotProduct[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/products/${productId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return payload.products || [];
}

export async function testAiBotTrainingApi(
  botId: number,
  data: {
    method: string;
    url: string;
    params?: { key: string; value: string }[];
    headers?: { key: string; value: string }[];
    body?: string;
  }
): Promise<any> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/training/api-test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return (payload as any).result;
}

export async function testAiBotReply(
  botId: number,
  data: { message: string; history?: { role: "user" | "assistant"; content: string; imageDataUrl?: string | null }[]; imageDataUrl?: string | null }
): Promise<{ action: "reply" | "call_api" | "handover"; messages: string[]; image: string | null; request: unknown; model?: string }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/test`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: data.message,
        history: data.history || [],
        image_data_url: data.imageDataUrl || undefined,
      }),
    })
  );

  return { ...((payload as any).result || {}), model: (payload as any).model };
}

export async function updateAiBotPrompt(botId: number, introductionPrompt: string): Promise<AiBot[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/ai-bots/${botId}/prompt`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ introduction_prompt: introductionPrompt }),
    })
  );

  return (payload as any).bots || [];
}

export async function fetchAdminContracts(): Promise<AdminContract[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/contracts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.contracts || [];
}

export async function createAdminContract(data: ContractData, status: AdminContract["status"] = "draft"): Promise<AdminContract> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/contracts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data, status }),
    })
  );

  if (!payload.contract) throw new Error("Server chưa trả thông tin hợp đồng.");
  return payload.contract;
}

export async function updateAdminContract(
  contractId: number,
  data: { status?: AdminContract["status"]; data?: Partial<ContractData>; special_code?: string }
): Promise<AdminContract> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/contracts/${contractId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (!payload.contract) throw new Error("Server chưa trả thông tin hợp đồng.");
  return payload.contract;
}

export async function deleteAdminContract(contractId: number, deleteCode: string): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/contracts/${contractId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delete_code: deleteCode }),
    })
  );

  return payload.message || "Đã xoá hợp đồng.";
}

export async function fetchContractSigning(token: string): Promise<AdminContract> {
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/contracts/sign/${encodeURIComponent(token)}`)
  );

  if (!payload.contract) throw new Error("Không tìm thấy hợp đồng.");
  return payload.contract;
}

export async function submitContractSigning(
  token: string,
  data: {
    party_a: ContractData["party_a"];
    signer_name?: string;
    signature_data: string;
    agree: boolean;
  }
): Promise<AdminContract> {
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/contracts/sign/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );

  if (!payload.contract) throw new Error("Server chưa trả thông tin hợp đồng.");
  return payload.contract;
}

export async function fetchZaloAccounts() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.accounts || [];
}

export async function fetchZaloBotCommands(accountId: number | string): Promise<ZaloBotCommandPayload[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_bot_commands?zalo_account_id=${encodeURIComponent(String(accountId))}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return ((payload as ApiPayload & { commands?: ZaloBotCommandPayload[] }).commands || []);
}

export async function saveZaloBotCommands(accountId: number | string, commands: ZaloBotCommandPayload[]): Promise<ZaloBotCommandPayload[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_bot_commands`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zalo_account_id: accountId, commands }),
    })
  );

  return ((payload as ApiPayload & { commands?: ZaloBotCommandPayload[] }).commands || []);
}

export async function fetchZaloBotSpecialSettings(accountId: number | string): Promise<ZaloBotSpecialSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_bot_special_settings?zalo_account_id=${encodeURIComponent(String(accountId))}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return (payload.settings || {
    awayEnabled: false,
    awayText: "",
    awayImageUrl: "",
    awayImageCaption: "",
    awayCooldownMinutes: 60,
    welcomeEnabled: false,
    welcomeText: "",
    welcomeImageUrl: "",
    welcomeImageCaption: "",
    goodbyeEnabled: false,
    goodbyeText: "",
    goodbyeImageUrl: "",
    goodbyeImageCaption: "",
    antiSpamEnabled: false,
    antiSpamLimit: 5,
    antiSpamWindowSeconds: 60,
    antiSpamKickEnabled: false,
    antiSpamKickAfter: 3,
    antiLinkEnabled: false,
    antiLinkAllowedText: "",
    antiLinkKickEnabled: false,
    antiLinkKickAfter: 3,
    autoJoinGroupsEnabled: false,
    autoLeaveRestrictedGroupsEnabled: false,
    autoJoinDelaySeconds: 0,
    autoLeaveDelaySeconds: 0,
  }) as ZaloBotSpecialSettings;
}

export async function saveZaloBotSpecialSettings(accountId: number | string, settings: ZaloBotSpecialSettings): Promise<ZaloBotSpecialSettings> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_bot_special_settings`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zalo_account_id: accountId, settings }),
    })
  );

  return payload.settings as ZaloBotSpecialSettings;
}

export async function fetchUserProxies(): Promise<UserProxy[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/proxies`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return (payload as ApiPayload & { proxies?: UserProxy[] }).proxies || [];
}

export async function createUserProxy(data: { name?: string; proxy: string; note?: string }): Promise<UserProxy[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/proxies`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
  );

  return (payload as ApiPayload & { proxies?: UserProxy[] }).proxies || [];
}

export async function updateUserProxyStatus(id: number, status: "active" | "inactive"): Promise<UserProxy[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/proxies/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
  );

  return (payload as ApiPayload & { proxies?: UserProxy[] }).proxies || [];
}

export async function checkUserProxyLive(id: number): Promise<ProxyCheckResult> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/proxies/${id}/check`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return (payload as ApiPayload & { result?: ProxyCheckResult }).result || {
    live: false,
    ip: "",
    country: "",
    latency_ms: 0,
    checked_at: "",
    error: "Server chưa trả kết quả check proxy.",
  };
}

export async function deleteUserProxy(id: number): Promise<UserProxy[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/proxies/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return (payload as ApiPayload & { proxies?: UserProxy[] }).proxies || [];
}

export async function updateZaloAccountStatus(id: number, status: "active" | "inactive") {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "update_status", id, status }),
    })
  );

  return payload.accounts || [];
}

export async function updateZaloAccountAiSettings(id: number, data: { aiEnabled: boolean; aiBotId: number | null }) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "update_ai_settings", id, ai_enabled: data.aiEnabled, ai_bot_id: data.aiBotId }),
    })
  );

  return payload.accounts || [];
}

export async function updateZaloAccountCommandBotSettings(id: number, enabled: boolean) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "update_command_bot_settings", id, command_bot_enabled: enabled }),
    })
  );

  return payload.accounts || [];
}

export async function fetchZaloCampaigns(accountId?: number, sourceGroupId?: string): Promise<{
  accounts: ZaloAccount[];
  groups: ZaloGroup[];
  friends: ZaloFriend[];
  members: ZaloGroupMember[];
  campaigns: ZaloCampaign[];
  stats: ZaloCampaignStats;
}> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const queryParams = new URLSearchParams();
  if (accountId) queryParams.set("account_id", String(accountId));
  if (sourceGroupId) queryParams.set("source_group_id", sourceGroupId);
  const query = queryParams.toString() ? `?${queryParams.toString()}` : "";

  let payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const campaignPayload = payload as {
    campaigns?: ZaloCampaign[];
    stats?: Partial<ZaloCampaignStats>;
  };
  if ((accountId || sourceGroupId) && !campaignPayload.campaigns?.length && Number(campaignPayload.stats?.total || 0) > 0) {
    const fallbackPayload = await parseResponse(
      await fetch(`${API_BASE_URL}/campaigns`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    payload = {
      ...payload,
      campaigns: fallbackPayload.campaigns || [],
      stats: fallbackPayload.stats || payload.stats,
    };
  }

  return {
    accounts: payload.accounts || [],
    groups: payload.groups || [],
    friends: payload.friends || [],
    members: payload.members || [],
    campaigns: payload.campaigns || [],
    stats: (payload.stats as unknown as ZaloCampaignStats) || { total: 0, scheduled: 0, running: 0, completed: 0, failed: 0 },
  };
}

export async function scanZaloGroups(accountId: number): Promise<ZaloGroup[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "scan_groups", zalo_account_id: accountId }),
    })
  );

  return payload.groups || [];
}

export async function fetchZaloBotGroups(accountId: number | string): Promise<ZaloGroup[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_bot_groups?zalo_account_id=${encodeURIComponent(String(accountId))}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.groups || [];
}

export async function saveZaloBotGroups(accountId: number | string, groupIds: string[]): Promise<ZaloGroup[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_bot_groups`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ zalo_account_id: accountId, group_ids: groupIds }),
    })
  );

  return payload.groups || [];
}

export async function scanZaloFriends(accountId: number): Promise<ZaloFriend[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "scan_friends", zalo_account_id: accountId }),
    })
  );

  return payload.friends || [];
}

export async function scanZaloGroupMembers(accountId: number, groupId?: string): Promise<ZaloGroupMember[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "scan_members", zalo_account_id: accountId, group_id: groupId }),
    })
  );

  return payload.members || [];
}

export async function deleteZaloGroup(accountId: number, groupId: string): Promise<ZaloGroup[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "delete_group", zalo_account_id: accountId, group_id: groupId }),
    })
  );

  return payload.groups || [];
}

export async function deleteZaloFriend(accountId: number, friendId: string): Promise<ZaloFriend[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "delete_friend", zalo_account_id: accountId, friend_id: friendId }),
    })
  );

  return payload.friends || [];
}

export async function deleteZaloGroupMember(accountId: number, memberId: string, groupId?: string): Promise<ZaloGroupMember[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "delete_member", zalo_account_id: accountId, member_id: memberId, group_id: groupId }),
    })
  );

  return payload.members || [];
}

export async function createZaloCampaign(data: {
  zalo_account_id: number;
  target_type?: "group" | "friend" | "member";
  source_group_id?: string;
  name: string;
  message: string;
  scheduled_at: string;
  schedule_type?: "once" | "daily" | "custom";
  days_of_week?: number[];
  scheduled_times?: string[];
  scheduled_datetimes?: string[];
  send_now?: boolean;
  delay_seconds: number;
  group_ids: string[];
  target_ids?: string[];
  image_data_url?: string | null;
  client_time?: string;
}): Promise<ZaloCampaign[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "create_campaign", ...data }),
    })
  );

  return payload.campaigns || [];
}

export async function cancelZaloCampaign(id: number): Promise<ZaloCampaign[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "cancel_campaign", id }),
    })
  );

  return payload.campaigns || [];
}

export async function pauseZaloCampaign(id: number): Promise<ZaloCampaign[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "pause_campaign", id }),
    })
  );

  return payload.campaigns || [];
}

export async function resumeZaloCampaign(id: number): Promise<ZaloCampaign[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "resume_campaign", id }),
    })
  );

  return payload.campaigns || [];
}

export async function deleteZaloCampaign(id: number): Promise<ZaloCampaign[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "delete_campaign", id }),
    })
  );

  return payload.campaigns || [];
}

export async function clearZaloCampaignHistory(): Promise<ZaloCampaign[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "clear_campaign_history" }),
    })
  );

  return payload.campaigns || [];
}

export async function cancelRunningZaloCampaigns(): Promise<ZaloCampaign[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/campaigns`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "cancel_running_campaigns" }),
    })
  );

  return payload.campaigns || [];
}

export async function fetchFacebookPages() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/facebook_pages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.pages || [];
}

export async function fetchFacebookPage(id: number): Promise<FacebookPage> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/facebook_pages/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!payload.page || typeof payload.page === "number") throw new Error("Không tìm thấy Fanpage Facebook.");
  return payload.page;
}

export async function addFacebookPage(data: {
  page_id: string;
  access_token: string;
}) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/facebook_pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  return payload.pages || [];
}

export async function updateFacebookPageAiSettings(id: number, data: { aiEnabled: boolean; aiBotId: number | null }) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/facebook_pages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "update_ai_settings", id, ai_enabled: data.aiEnabled, ai_bot_id: data.aiBotId }),
    })
  );
  return payload.pages || [];
}

export async function deleteFacebookPage(id: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/facebook_pages`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    })
  );

  return payload.pages || [];
}

export async function fetchChatInbox(params: {
  source?: "all" | ChatSource;
  search?: string;
  conversationId?: number;
  channelIds?: number[];
  markRead?: boolean;
} = {}): Promise<{ conversations: ChatConversation[]; activeConversationId: number | null; stats: ChatStats }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const query = new URLSearchParams();
  if (params.source && params.source !== "all") query.set("source", params.source);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.conversationId) query.set("conversation_id", String(params.conversationId));
  if (params.channelIds?.length) query.set("channel_ids", params.channelIds.join(","));
  if (params.markRead) query.set("mark_read", "1");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/chat${query.toString() ? `?${query.toString()}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    conversations: payload.conversations || [],
    activeConversationId: payload.active_conversation_id ?? null,
    stats: (payload.stats as ChatStats) || { total: 0, fanpage: 0, zalo: 0, webchat: 0, waiting: 0, ignored_zalo_groups: 0 },
  };
}

export async function fetchAdminChatInbox(params: {
  source?: "all" | ChatSource;
  search?: string;
  conversationId?: number;
  markRead?: boolean;
} = {}): Promise<{ conversations: ChatConversation[]; activeConversationId: number | null; stats: ChatStats }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const query = new URLSearchParams();
  if (params.source && params.source !== "all") query.set("source", params.source);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.conversationId) query.set("conversation_id", String(params.conversationId));
  if (params.markRead) query.set("mark_read", "1");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/chat${query.toString() ? `?${query.toString()}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    conversations: payload.conversations || [],
    activeConversationId: payload.active_conversation_id ?? null,
    stats: (payload.stats as ChatStats) || { total: 0, fanpage: 0, zalo: 0, webchat: 0, waiting: 0, ignored_zalo_groups: 0 },
  };
}

export async function sendChatReply(
  conversationId: number,
  data: string | { message?: string; imageDataUrl?: string | null; imageUrl?: string | null; replyToMessageId?: number | null }
): Promise<ChatConversation> {
  const requestBody = typeof data === "string"
    ? { message: data }
    : {
      message: data.message || "",
      image_data_url: data.imageDataUrl || undefined,
      image_url: data.imageUrl || undefined,
      reply_to_message_id: data.replyToMessageId || undefined,
    };
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/chat/${conversationId}/reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })
  );

  if (!payload.conversation) throw new Error("Server chưa trả hội thoại.");
  return payload.conversation;
}

export async function sendAdminChatReply(
  conversationId: number,
  data: { message?: string; imageDataUrl?: string | null; imageUrl?: string | null; replyToMessageId?: number | null }
): Promise<ChatConversation> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/chat/${conversationId}/reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: data.message || "",
        image_data_url: data.imageDataUrl || undefined,
        image_url: data.imageUrl || undefined,
        reply_to_message_id: data.replyToMessageId || undefined,
      }),
    })
  );

  if (!payload.conversation) throw new Error("Server chưa trả hội thoại.");
  return payload.conversation;
}

export async function updateChatConversation(
  conversationId: number,
  data: { status?: ChatStatus; tags?: string[]; ai_enabled?: boolean }
): Promise<ChatConversation> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/chat/${conversationId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (!payload.conversation) throw new Error("Server chưa trả hội thoại.");
  return payload.conversation;
}

export async function updateAdminChatConversation(
  conversationId: number,
  data: { status?: ChatStatus; tags?: string[]; ai_enabled?: boolean }
): Promise<ChatConversation> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/chat/${conversationId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (!payload.conversation) throw new Error("Server chưa trả hội thoại.");
  return payload.conversation;
}

export async function deleteChatConversation(conversationId: number): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/chat/${conversationId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.message || "Đã xoá hội thoại.";
}

export async function deleteAdminChatConversation(conversationId: number): Promise<string> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/chat/${conversationId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return payload.message || "Đã xoá hội thoại.";
}

export async function syncZaloRuntimeAccounts() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  return parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "sync_zalo_runtime" }),
    })
  );
}

export async function syncZaloMessages(accountId: number): Promise<{ message: string }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "scan_messages", id: accountId }),
    })
  );
  return { message: payload.message || "Đã yêu cầu đồng bộ tin nhắn Zalo." };
}

export async function reconnectZaloAccount(id: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  return parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "reconnect_account", id }),
    })
  );
}

export async function startZaloQrLogin(proxy?: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const profile = await fetchProfile();
  if (!profile?.plan_active) {
    throw new Error("Bạn cần mua gói dịch vụ hoặc gia hạn gói đang hết hạn trước khi thêm tài khoản Zalo.");
  }

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "start_qr", proxy: proxy || null }),
    })
  );

  if (!payload.session_token || !payload.qr_image) {
    throw new Error("Server chưa trả mã QR hợp lệ.");
  }

  return payload;
}

export async function pollZaloQrLogin(sessionToken: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  return parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "poll_qr", session_token: sessionToken }),
    })
  );
}

export async function deleteZaloAccount(id: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/zalo_accounts`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id }),
    })
  );

  return payload.accounts || [];
}

export async function fetchLoginSessions() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (payload.user) saveUser(payload.user);
  return payload.sessions || [];
}

export function fixCorruptedText(text?: string | null): string {
  if (!text || typeof text !== "string") return "";
  if (!text.includes("?")) return text;
  return text
    .replace(/T\?i kho\?n/g, "Tài khoản")
    .replace(/Qu\?t tin nh\?n/g, "Quét tin nhắn")
    .replace(/Qu\?t Tin Nh\?n/g, "Quét Tin Nhắn")
    .replace(/Qu\?t/g, "Quét")
    .replace(/tin nh\?n/g, "tin nhắn")
    .replace(/Tin Nh\?n/g, "Tin Nhắn")
    .replace(/b\?ng/g, "bằng")
    .replace(/ho\?c/g, "hoặc")
    .replace(/b\? qua/g, "bỏ qua")
    .replace(/s\? kiện/g, "sự kiện")
    .replace(/ t\? /g, " từ ")
    .replace(/Kh\?ng t\?m th\?y t\?i kho\?n/g, "Không tìm thấy tài khoản")
    .replace(/\?\? y\?u c\?u/g, "Đã yêu cầu")
    .replace(/ri\?ng \?\? b\?t/g, "riêng để bắt")
    .replace(/t\? g\?i t\?/g, "tự gửi từ")
    .replace(/kh\?i/g, "khỏi")
    .replace(/di\?n tho\?i/g, "điện thoại")
    .replace(/\?ng d\?ng/g, "ứng dụng")
    .replace(/dang nh\?p/g, "đăng nhập")
    .replace(/d\? dang nh\?p/g, "để đăng nhập")
    .replace(/ch\? b\?n/g, "chờ bạn");
}

export async function fetchActivityLogs(page = 1, search = "", limit = 10): Promise<ActivityLogPayload> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (search.trim()) params.set("search", search.trim());

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/activity_logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  const rawLogs = payload.logs || [];
  const cleanedLogs = rawLogs.map((item: any) => ({
    ...item,
    subject: fixCorruptedText(item.subject),
    action: fixCorruptedText(item.action),
    actor: fixCorruptedText(item.actor),
    target: fixCorruptedText(item.target),
    detail: fixCorruptedText(item.detail),
  }));

  return {
    logs: cleanedLogs,
    total: Number(payload.total || 0),
    page: Number(payload.page || page),
    limit: Number(payload.limit || limit),
    page_count: Number(payload.page_count || 1),
    stats: payload.stats as any,
  };
}

export async function fetchNotifications(limit = 10): Promise<NotificationsPayload> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/notifications?limit=${encodeURIComponent(String(limit))}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    notifications: payload.notifications || [],
    unread_count: Number(payload.unread_count || 0),
  };
}

export async function markNotificationsRead(ids?: number[]) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  return parseResponse(
    await fetch(`${API_BASE_URL}/notifications/read`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: ids || [] }),
    })
  );
}

export async function logoutLoginSessions(sessionIds: string[], logoutOthers = false) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/sessions/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_ids: sessionIds, logout_others: logoutOthers }),
    })
  );

  if (payload.user) saveUser(payload.user);
  return payload.sessions || [];
}

export async function logoutUser() {
  const token = getToken();
  if (token) {
    await fetch(`${API_BASE_URL}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
  }
  clearSession();
}

export async function fetchTickets(): Promise<{ tickets: Ticket[]; stats: TicketStats }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  return {
    tickets: payload.tickets || [],
    stats: (payload.stats as TicketStats) || { open: 0, in_progress: 0, resolved: 0 },
  };
}

export async function createTicket(data: {
  subject: string;
  category?: string;
  priority: "low" | "medium" | "high";
  body: string;
  attachments?: string[];
}): Promise<Ticket> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/tickets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );

  if (!payload.ticket) throw new Error("Server chưa trả thông tin ticket.");
  return payload.ticket;
}

export async function fetchTicket(id: number): Promise<Ticket> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");

  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/tickets/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );

  if (!payload.ticket) throw new Error("Không tìm thấy ticket.");
  return payload.ticket;
}

export async function fetchAdminDashboard() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return payload;
}

export async function fetchAdminUsers() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return payload.users || [];
}

export async function fetchAdminZaloAccounts(): Promise<AdminZaloAccount[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/zalo-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return (payload.accounts || []) as AdminZaloAccount[];
}

export async function updateAdminZaloAccount(id: number, data: Partial<AdminZaloAccount>) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/zalo-accounts/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteAdminZaloAccount(id: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/zalo-accounts/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function scanAdminZaloAccountMessages(id: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/zalo-accounts/${id}/scan-messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function fetchAdminFacebookPages(): Promise<AdminFacebookPage[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/facebook-pages`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return (payload.pages || []) as AdminFacebookPage[];
}

export async function updateAdminFacebookPage(id: number, data: Partial<AdminFacebookPage>) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/facebook-pages/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteAdminFacebookPage(id: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/facebook-pages/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function fetchAdminFacebookAutoAccounts(): Promise<{ accounts: AdminFacebookAutoAccount[]; logs: AdminFacebookAutoLog[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/facebook-auto-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const data = payload as { accounts?: unknown[]; logs?: unknown[] };
  return {
    accounts: (data.accounts || []) as AdminFacebookAutoAccount[],
    logs: (data.logs || []) as AdminFacebookAutoLog[],
  };
}

export async function fetchAdminFacebookAutoAccount(id: string): Promise<AdminFacebookAutoAccountDetail> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/facebook-auto-accounts/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const data = payload as { account?: unknown; logs?: unknown[] };
  return {
    account: data.account as AdminFacebookAutoAccount,
    logs: (data.logs || []) as AdminFacebookAutoLog[],
  };
}

export async function updateAdminFacebookAutoAccount(
  id: string,
  data: Partial<Pick<AdminFacebookAutoAccount, "status" | "admin_disabled">>
) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/facebook-auto-accounts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteAdminFacebookAutoAccount(id: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/facebook-auto-accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function fetchAdminThreadsAutoAccounts(): Promise<{ accounts: AdminThreadsAutoAccount[]; logs: AdminFacebookAutoLog[] }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`/api/admin/threads-auto-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const data = payload as { accounts?: unknown[]; logs?: unknown[] };
  return {
    accounts: (data.accounts || []) as AdminThreadsAutoAccount[],
    logs: (data.logs || []) as AdminFacebookAutoLog[],
  };
}

export async function updateAdminThreadsAutoAccount(
  id: string,
  data: Partial<Pick<AdminThreadsAutoAccount, "status" | "admin_disabled">>
) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`/api/admin/threads-auto-accounts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteAdminThreadsAutoAccount(id: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`/api/admin/threads-auto-accounts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function fetchAdminAiBotsCreated(): Promise<AdminAiBot[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/ai-bots`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return (payload.bots || []) as AdminAiBot[];
}

export async function fetchAdminNotifications(): Promise<AppNotification[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return payload.notifications || [];
}

export async function sendAdminNotification(data: {
  target: "all" | "selected";
  user_ids?: number[];
  title: string;
  message: string;
  tone: "blue" | "green" | "red" | "orange" | "gray";
  action_url?: string;
}) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/notifications`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
}

export async function updateUserMoney(userId: number, amount: number, type: "add" | "subtract", reason?: string) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/users/${userId}/money`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ amount, type, reason }),
    })
  );
  return payload;
}

export async function updateUserStatus(userId: number, status: "active" | "locked") {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/users/${userId}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    })
  );
  return payload;
}

export async function updateUserVerifiedBadge(userId: number, verifiedBadge: boolean) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/users/${userId}/verified-badge`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ verified_badge: verifiedBadge }),
    })
  );
  return payload;
}

export async function fetchAdminSocialAds(): Promise<SocialAd[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/social-ads`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ) as { ads?: SocialAd[] };
  return (payload.ads || []) as SocialAd[];
}

export async function createAdminSocialAd(data: Partial<SocialAd>) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/social-ads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
}

export async function updateAdminSocialAd(id: number, data: Partial<SocialAd>) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/social-ads/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
  );
}

export async function deleteAdminSocialAd(id: number) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/social-ads/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
  );
}

export async function reorderAdminSocialAds(ids: number[]) {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  return parseResponse(
    await fetch(`${API_BASE_URL}/admin/social-ads/reorder`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    })
  );
}

export type AdminInvoice = {
  id: number;
  invoice_code: string;
  transfer_content: string;
  amount: number;
  status: "pending" | "paid" | "expired" | "cancelled";
  paid_ref_no?: string | null;
  payment_description?: string | null;
  paid_at?: string | null;
  expires_at: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
};

export type AdminInvoiceStats = {
  total_count: number;
  total_revenue: number;
  pending_count: number;
  paid_count: number;
  expired_count: number;
  cancelled_count: number;
};

export async function fetchAdminInvoices(): Promise<{ invoices: AdminInvoice[]; stats: AdminInvoiceStats }> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return {
    invoices: payload.invoices || [],
    stats: (payload.stats as any) || {
      total_count: 0,
      total_revenue: 0,
      pending_count: 0,
      paid_count: 0,
      expired_count: 0,
      cancelled_count: 0
    }
  };
}

export async function updateAdminInvoiceStatus(invoiceId: number, status: "paid" | "cancelled" | "pending") {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/invoices/${invoiceId}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    })
  );
  return payload;
}

export async function fetchAdminTickets(): Promise<Ticket[]> {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/tickets`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  return payload.tickets || [];
}

export async function updateTicketStatus(ticketId: number, status: "open" | "in_progress" | "resolved" | "closed") {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/tickets/${ticketId}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    })
  );
  return payload;
}

export async function fetchAdminLogs() {
  const token = getToken();
  if (!token) throw new Error("Bạn cần đăng nhập.");
  const payload = await parseResponse(
    await fetch(`${API_BASE_URL}/admin/logs`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  );
  const rawLogs = payload.logs || [];
  return rawLogs.map((item: any) => ({
    ...item,
    subject: fixCorruptedText(item.subject),
    action: fixCorruptedText(item.action),
    actor: fixCorruptedText(item.actor),
    target: fixCorruptedText(item.target),
    detail: fixCorruptedText(item.detail),
  }));
}



export function useAuthUser() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    function syncStoredUser() {
      if (mounted) setUser(getStoredUser());
    }

    window.addEventListener("techmax-auth-change", syncStoredUser);
    syncStoredUser();

    fetchProfile()
      .then((profile) => {
        if (mounted) setUser(profile);
      })
      .catch(() => {
        clearSession();
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      window.removeEventListener("techmax-auth-change", syncStoredUser);
    };
  }, []);

  return { user, loading };
}
