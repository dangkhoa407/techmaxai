"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import Swal from "sweetalert2";
import { AppFrame, Icon, UserAvatar, VerifiedBadge } from "../components";
import { API_BASE_URL, getStoredUser, getToken } from "../lib/auth";
import { showError, showToast } from "../lib/swal";

type ReactionType = "like" | "love" | "care" | "haha" | "wow" | "sad" | "angry";

type SocialComment = {
  id: number;
  author: string;
  avatar: string;
  avatarUrl?: string | null;
  verifiedBadge?: boolean;
  content: string;
  createdAt: string;
  userId?: number;
};

type SocialPost = {
  id: number;
  userId?: number;
  author: string;
  role: string;
  avatar: string;
  avatarUrl?: string | null;
  verifiedBadge?: boolean;
  content: string;
  imageUrl?: string;
  createdAt: string;
  userReaction: ReactionType | null;
  reactions: Record<ReactionType, number>;
  comments: SocialComment[];
  commentsTotal: number;
};

type TopPost = {
  id: number;
  author: string;
  avatar: string;
  avatarUrl?: string | null;
  verifiedBadge?: boolean;
  title: string;
  score: number;
};

type SocialAd = {
  id: number;
  title: string;
  description: string;
  thumbnailUrl?: string | null;
  linkUrl?: string | null;
  clickCount?: number;
  isFallback?: boolean;
};

type SocialPayload = {
  success: boolean;
  message?: string;
  posts?: SocialPost[];
  post?: SocialPost;
  top_posts?: TopPost[];
  ads?: SocialAd[];
  comments?: SocialComment[];
  comment?: SocialComment;
  has_more?: boolean;
  next_cursor?: number | null;
};

const reactionOptions: { type: ReactionType; label: string; tone: string; icon: string }[] = [
  { type: "like", label: "Thích", tone: "blue", icon: "/social-reactions/like.svg" },
  { type: "love", label: "Yêu thích", tone: "red", icon: "/social-reactions/love.svg" },
  { type: "care", label: "Thương thương", tone: "yellow", icon: "/social-reactions/care.svg" },
  { type: "haha", label: "Haha", tone: "yellow", icon: "/social-reactions/haha.svg" },
  { type: "wow", label: "Wow", tone: "purple", icon: "/social-reactions/wow.svg" },
  { type: "sad", label: "Buồn", tone: "gray", icon: "/social-reactions/sad.svg" },
  { type: "angry", label: "Giận", tone: "orange", icon: "/social-reactions/angry.svg" },
];

const emptyReactions: Record<ReactionType, number> = {
  like: 0,
  love: 0,
  care: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
};

const composerEmojis = ["😀", "😂", "😍", "😎", "🥰", "😢", "😡", "👍", "🔥", "🎉", "❤️", "✨"];
const SOCIAL_PAGE_LIMIT = 8;

function totalReactions(post: SocialPost) {
  return Object.values(post.reactions || emptyReactions).reduce((sum, value) => sum + Number(value || 0), 0);
}

function getReactionOption(type: ReactionType | null) {
  return reactionOptions.find((reaction) => reaction.type === type) || reactionOptions[0];
}

function topReactionTypes(post: SocialPost) {
  return reactionOptions
    .filter((reaction) => Number(post.reactions?.[reaction.type] || 0) > 0)
    .sort((left, right) => Number(post.reactions?.[right.type] || 0) - Number(post.reactions?.[left.type] || 0))
    .slice(0, 3);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });
}

function initials(name?: string | null) {
  const text = String(name || "Bạn").trim();
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return (words[0] || "B").slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getPostPreview(content: string, expanded: boolean) {
  const maxLines = 5;
  const maxChars = 280;
  const lines = content.split(/\r?\n/);
  const shouldClamp = lines.length > maxLines || content.length > maxChars;
  if (!shouldClamp || expanded) {
    return { text: content, shouldClamp };
  }

  const linePreview = lines.slice(0, maxLines).join("\n");
  const preview = linePreview.length > maxChars ? `${linePreview.slice(0, maxChars).trimEnd()}...` : `${linePreview.trimEnd()}...`;
  return { text: preview, shouldClamp };
}

function normalizePosts(items: SocialPost[] = []) {
  return items.map((post) => ({
    ...post,
    reactions: { ...emptyReactions, ...(post.reactions || {}) },
    comments: post.comments || [],
    commentsTotal: Number(post.commentsTotal || 0),
  }));
}

function authHeaders(json = true) {
  const token = getToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiRequest<T extends SocialPayload>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Không thể kết nối máy chủ.");
  }
  return payload;
}

export default function SocialPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [ads, setAds] = useState<SocialAd[]>([]);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isEditEmojiPickerOpen, setIsEditEmojiPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [reactionPickerPostId, setReactionPickerPostId] = useState<number | null>(null);
  const [openCommentPostIds, setOpenCommentPostIds] = useState<Record<number, boolean>>({});
  const [loadingMoreComments, setLoadingMoreComments] = useState<Record<number, boolean>>({});
  const [expandedPostIds, setExpandedPostIds] = useState<Record<number, boolean>>({});
  const [openPostMenuId, setOpenPostMenuId] = useState<number | null>(null);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageName, setEditImageName] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState(() => getStoredUser());
  const reactionHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedRef = useRef<HTMLElement | null>(null);
  const feedLoaderRef = useRef<HTMLDivElement | null>(null);

  const currentName = currentUser?.fullname || "Bạn";

  useEffect(() => {
    setCurrentUser(getStoredUser());
    loadSocialFeed();
  }, []);

  useEffect(() => {
    function syncCurrentUser() {
      setCurrentUser(getStoredUser());
    }
    window.addEventListener("techmax-auth-change", syncCurrentUser);
    return () => window.removeEventListener("techmax-auth-change", syncCurrentUser);
  }, []);

  useEffect(() => {
    const root = feedRef.current;
    const target = feedLoaderRef.current;
    if (!root || !target || isLoading || isLoadingMore || !hasMorePosts || !nextCursor) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        loadMoreSocialFeed();
      }
    }, {
      root,
      rootMargin: "420px 0px",
      threshold: 0,
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMorePosts, isLoading, isLoadingMore, nextCursor, posts.length]);

  useEffect(() => {
    if (!openPostMenuId) return;

    function closePostMenu(event: PointerEvent) {
      const target = event.target as Element | null;
      if (target?.closest(".social-post-menu-wrap")) return;
      setOpenPostMenuId(null);
    }

    function closePostMenuOnPageChange() {
      setOpenPostMenuId(null);
    }

    document.addEventListener("pointerdown", closePostMenu);
    window.addEventListener("popstate", closePostMenuOnPageChange);
    window.addEventListener("hashchange", closePostMenuOnPageChange);
    return () => {
      document.removeEventListener("pointerdown", closePostMenu);
      window.removeEventListener("popstate", closePostMenuOnPageChange);
      window.removeEventListener("hashchange", closePostMenuOnPageChange);
    };
  }, [openPostMenuId]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root || !openPostMenuId) return;
    const closePostMenu = () => setOpenPostMenuId(null);
    root.addEventListener("scroll", closePostMenu, { passive: true });
    return () => root.removeEventListener("scroll", closePostMenu);
  }, [openPostMenuId]);

  function replacePost(nextPost?: SocialPost) {
    if (!nextPost) return;
    setPosts((current) => current.map((post) => (post.id === nextPost.id ? nextPost : post)));
  }

  async function loadSocialFeed() {
    try {
      setIsLoading(true);
      const payload = await apiRequest<SocialPayload>(`/social?limit=${SOCIAL_PAGE_LIMIT}`, {
        headers: authHeaders(false),
      });
      setPosts(normalizePosts(payload.posts || []));
      setTopPosts(payload.top_posts || []);
      setAds(payload.ads || []);
      setHasMorePosts(Boolean(payload.has_more));
      setNextCursor(payload.next_cursor ?? null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không tải được Social.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMoreSocialFeed() {
    if (isLoading || isLoadingMore || !hasMorePosts || !nextCursor) return;
    try {
      setIsLoadingMore(true);
      const payload = await apiRequest<SocialPayload>(`/social?limit=${SOCIAL_PAGE_LIMIT}&cursor=${nextCursor}`, {
        headers: authHeaders(false),
      });
      const nextPosts = normalizePosts(payload.posts || []);
      setPosts((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...nextPosts.filter((post) => !seen.has(post.id))];
      });
      setTopPosts(payload.top_posts || []);
      setAds(payload.ads || []);
      setHasMorePosts(Boolean(payload.has_more));
      setNextCursor(payload.next_cursor ?? null);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không tải được bài viết mới.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  function clearReactionTimers() {
    if (reactionHoverTimer.current) {
      clearTimeout(reactionHoverTimer.current);
      reactionHoverTimer.current = null;
    }
    if (reactionHoldTimer.current) {
      clearTimeout(reactionHoldTimer.current);
      reactionHoldTimer.current = null;
    }
  }

  function openReactionPicker(postId: number) {
    clearReactionTimers();
    setReactionPickerPostId(postId);
  }

  function scheduleHoverReactionPicker(postId: number) {
    clearReactionTimers();
    reactionHoverTimer.current = setTimeout(() => {
      setReactionPickerPostId(postId);
      reactionHoverTimer.current = null;
    }, 2000);
  }

  function scheduleHoldReactionPicker(postId: number) {
    clearReactionTimers();
    reactionHoldTimer.current = setTimeout(() => {
      setReactionPickerPostId(postId);
      reactionHoldTimer.current = null;
    }, 520);
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn file ảnh.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Ảnh tối đa 5MB.");
      event.target.value = "";
      return;
    }
    try {
      setImageUrl(await fileToDataUrl(file));
      setImageName(file.name);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đọc ảnh.");
    }
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = content.trim();
    if (!text && !imageUrl) {
      showError("Vui lòng nhập nội dung hoặc chọn ảnh để đăng bài.");
      return;
    }
    try {
      setIsPosting(true);
      const payload = await apiRequest<SocialPayload>("/social/posts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: text, image_url: imageUrl || null }),
      });
      if (payload.post) {
        setPosts((current) => [payload.post as SocialPost, ...current]);
      }
      setTopPosts(payload.top_posts || []);
      setContent("");
      setImageUrl("");
      setImageName("");
      setIsEmojiPickerOpen(false);
      setIsComposerOpen(false);
      showToast(payload.message || "Đã đăng bài lên Social.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đăng bài.");
    } finally {
      setIsPosting(false);
    }
  }

  async function handleReaction(postId: number, reactionType: ReactionType) {
    clearReactionTimers();
    setReactionPickerPostId(null);
    try {
      const payload = await apiRequest<SocialPayload>(`/social/posts/${postId}/reaction`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ reaction_type: reactionType }),
      });
      replacePost(payload.post);
      setTopPosts(payload.top_posts || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể gửi reaction.");
    }
  }

  async function handleAddComment(postId: number) {
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    try {
      const payload = await apiRequest<SocialPayload>(`/social/posts/${postId}/comments`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ content: text }),
      });
      if (payload.post) {
        replacePost(payload.post);
      } else if (payload.comment) {
        setPosts((current) => current.map((post) => (
          post.id === postId
            ? { ...post, comments: [...post.comments, payload.comment as SocialComment], commentsTotal: post.commentsTotal + 1 }
            : post
        )));
      }
      setTopPosts(payload.top_posts || []);
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setOpenCommentPostIds((current) => ({ ...current, [postId]: true }));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể bình luận.");
    }
  }

  async function handleDeleteComment(postId: number, commentId: number) {
    try {
      const payload = await apiRequest<SocialPayload>(`/social/posts/${postId}/comments/${commentId}`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      replacePost(payload.post);
      setTopPosts(payload.top_posts || []);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa bình luận.");
    }
  }

  function toggleComments(postId: number) {
    setOpenCommentPostIds((current) => ({ ...current, [postId]: !current[postId] }));
  }

  function togglePostContent(postId: number) {
    setExpandedPostIds((current) => ({ ...current, [postId]: !current[postId] }));
  }

  function canManagePost(post: SocialPost) {
    return Number(post.userId) === Number(currentUser?.id) || currentUser?.level === "admin";
  }

  function openEditPost(post: SocialPost) {
    setOpenPostMenuId(null);
    setEditingPost(post);
    setEditContent(post.content || "");
    setEditImageUrl(post.imageUrl || "");
    setEditImageName("");
    setIsEditEmojiPickerOpen(false);
  }

  async function handleEditImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Vui lòng chọn file ảnh.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("Ảnh tối đa 5MB.");
      event.target.value = "";
      return;
    }
    try {
      setEditImageUrl(await fileToDataUrl(file));
      setEditImageName(file.name);
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể đọc ảnh.");
    } finally {
      event.target.value = "";
    }
  }

  async function handleUpdatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPost) return;
    const text = editContent.trim();
    const image = editImageUrl.trim();
    if (!text && !image) {
      showError("Vui lòng nhập nội dung hoặc giữ ảnh cho bài viết.");
      return;
    }
    try {
      setIsSavingEdit(true);
      const payload = await apiRequest<SocialPayload>(`/social/posts/${editingPost.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ content: text, image_url: image || null }),
      });
      replacePost(payload.post);
      setTopPosts(payload.top_posts || []);
      setEditingPost(null);
      showToast(payload.message || "Đã cập nhật bài viết.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể cập nhật bài viết.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeletePost(post: SocialPost) {
    setOpenPostMenuId(null);
    const result = await Swal.fire({
      title: "Xóa bài viết?",
      text: "Bạn chắc chắn muốn xóa bài viết này?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xóa bài viết",
      cancelButtonText: "Hủy",
      reverseButtons: true,
      focusCancel: true,
      confirmButtonColor: "#ef4444",
      background: "#242526",
      color: "#e4e6eb",
    });
    if (!result.isConfirmed) return;
    try {
      setDeletingPostId(post.id);
      const payload = await apiRequest<SocialPayload>(`/social/posts/${post.id}`, {
        method: "DELETE",
        headers: authHeaders(false),
      });
      setPosts((current) => current.filter((item) => item.id !== post.id));
      setTopPosts(payload.top_posts || []);
      showToast(payload.message || "Đã xóa bài viết.");
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không thể xóa bài viết.");
    } finally {
      setDeletingPostId(null);
    }
  }

  async function showMoreComments(post: SocialPost) {
    if (loadingMoreComments[post.id]) return;
    try {
      setLoadingMoreComments((current) => ({ ...current, [post.id]: true }));
      const payload = await apiRequest<SocialPayload>(`/social/posts/${post.id}/comments?offset=${post.comments.length}&limit=5`, {
        headers: authHeaders(false),
      });
      const nextComments = payload.comments || [];
      setPosts((current) => current.map((item) => (
        item.id === post.id ? { ...item, comments: [...nextComments, ...item.comments] } : item
      )));
    } catch (error) {
      showError(error instanceof Error ? error.message : "Không tải được bình luận.");
    } finally {
      setLoadingMoreComments((current) => ({ ...current, [post.id]: false }));
    }
  }

  function handleCommentKeyDown(event: KeyboardEvent<HTMLInputElement>, postId: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddComment(postId);
    }
  }

  function insertComposerEmoji(emoji: string) {
    setContent((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${emoji}`);
    setIsEmojiPickerOpen(false);
  }

  function insertEditEmoji(emoji: string) {
    setEditContent((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${emoji}`);
    setIsEditEmojiPickerOpen(false);
  }

  function trackAdClick(adId: number) {
    const url = `${API_BASE_URL}/social/ads/${adId}/click`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url);
      return;
    }
    fetch(url, {
      method: "POST",
      keepalive: true,
      headers: authHeaders(false),
    }).catch(() => null);
  }

  const visibleAds = ads.length ? ads : [{
    id: 0,
    title: "TechMax Ads",
    description: "Để đăng quảng cáo tại đây, vui lòng liên hệ",
    thumbnailUrl: null,
    linkUrl: null,
    isFallback: true,
  }];

  return (
    <AppFrame active="/social" title="Mạng xã hội">
      <div className="social-layout">
        <aside className="social-top-posts">
          <section className="card pad social-top-users-card">
            <div className="social-top-users-head">
              <h3>Top bài viết</h3>
              <span>Tuần này</span>
            </div>
            <div className="social-top-users-list">
              {topPosts.length ? topPosts.map((post) => (
                <div className="social-top-user" key={post.id}>
                  <UserAvatar className="social-avatar small" name={post.author} src={post.avatarUrl} size={32} />
                  <div>
                    <strong className="name-with-badge">
                      {post.author}
                      {post.verifiedBadge ? <VerifiedBadge size={17} /> : null}
                    </strong>
                    <p>{post.title}</p>
                    <small>{post.score} điểm tương tác</small>
                  </div>
                </div>
              )) : (
                <p className="muted">Chưa có bài viết nổi bật.</p>
              )}
            </div>
          </section>
        </aside>

        <main className="social-feed" ref={feedRef} aria-label="Newsfeed Social">
          <section className="card pad social-composer-card">
            <div className="social-composer-quick">
              <UserAvatar className="social-avatar" name={currentName} src={currentUser?.avatar_url} size={44} />
              <button onClick={() => setIsComposerOpen(true)} type="button">
                {currentName} ơi, bạn đang nghĩ gì thế?
              </button>
            </div>
          </section>

          {isLoading ? (
            <section className="card pad social-empty-state">Đang tải newsfeed...</section>
          ) : null}

          {!isLoading && !posts.length ? (
            <section className="card pad social-empty-state">Chưa có bài viết nào. Hãy là người đầu tiên đăng lên Social.</section>
          ) : null}

          {posts.map((post) => (
            <article className="card pad social-post" key={post.id}>
              <header className="social-post-head">
                <UserAvatar className="social-avatar" name={post.author} src={post.avatarUrl} size={44} />
                <div>
                  <h3 className="name-with-badge">
                    {post.author}
                    {post.verifiedBadge ? <VerifiedBadge size={19} /> : null}
                  </h3>
                  <p>{post.role} · {post.createdAt}</p>
                </div>
                <div className="social-post-menu-wrap">
                  <button
                    className="social-post-menu"
                    type="button"
                    aria-label="Tùy chọn bài viết"
                    aria-expanded={openPostMenuId === post.id}
                    onClick={() => setOpenPostMenuId((current) => (current === post.id ? null : post.id))}
                  >
                    ...
                  </button>
                  {openPostMenuId === post.id ? (
                    <div className="social-post-dropdown" role="menu">
                      {canManagePost(post) ? (
                        <>
                          <button onClick={() => openEditPost(post)} type="button" role="menuitem">
                            <Icon name="edit_note" size={18} /> Chỉnh sửa bài viết
                          </button>
                          <button className="danger" disabled={deletingPostId === post.id} onClick={() => handleDeletePost(post)} type="button" role="menuitem">
                            <Icon name="delete" size={18} /> {deletingPostId === post.id ? "Đang xóa..." : "Xóa bài viết"}
                          </button>
                        </>
                      ) : (
                        <span>Bạn không có quyền chỉnh sửa bài viết này.</span>
                      )}
                    </div>
                  ) : null}
                </div>
              </header>

              {post.content ? (() => {
                const preview = getPostPreview(post.content, Boolean(expandedPostIds[post.id]));
                return (
                  <div className="social-post-content-wrap">
                    <p className="social-post-content">{preview.text}</p>
                    {preview.shouldClamp ? (
                      <button className="social-post-more" onClick={() => togglePostContent(post.id)} type="button">
                        {expandedPostIds[post.id] ? "Thu gọn" : "Xem thêm"}
                      </button>
                    ) : null}
                  </div>
                );
              })() : null}
              {post.imageUrl ? <img className="social-post-image" src={post.imageUrl} alt="Ảnh bài viết" /> : null}

              <div className="social-post-meta">
                <span className="social-reaction-summary">
                  {topReactionTypes(post).map((reaction) => (
                    <img alt={reaction.label} key={reaction.type} src={reaction.icon} />
                  ))}
                  {totalReactions(post)} reaction
                </span>
                <span>{post.commentsTotal} bình luận</span>
              </div>

              <div className="social-post-actions">
                <div
                  className="social-reaction-trigger"
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openReactionPicker(post.id);
                  }}
                  onMouseEnter={() => scheduleHoverReactionPicker(post.id)}
                  onMouseLeave={() => {
                    clearReactionTimers();
                    setReactionPickerPostId(null);
                  }}
                  onPointerCancel={clearReactionTimers}
                  onPointerDown={() => scheduleHoldReactionPicker(post.id)}
                  onPointerUp={clearReactionTimers}
                >
                  <button className={post.userReaction ? `active ${getReactionOption(post.userReaction).tone}` : ""} onClick={() => handleReaction(post.id, post.userReaction || "like")} type="button">
                    {post.userReaction ? (
                      <img alt="" src={getReactionOption(post.userReaction).icon} />
                    ) : (
                      <img className="social-like-muted-icon" alt="" src="/social-reactions/like.svg" />
                    )}
                    {post.userReaction ? getReactionOption(post.userReaction).label : "Thích"}
                  </button>
                  {reactionPickerPostId === post.id ? (
                    <div className="social-reaction-picker" role="group" aria-label="Chọn reaction">
                      {reactionOptions.map((reaction) => (
                        <button
                          className={post.userReaction === reaction.type ? "active" : ""}
                          key={reaction.type}
                          onClick={() => handleReaction(post.id, reaction.type)}
                          type="button"
                          title={reaction.label}
                        >
                          <img alt={reaction.label} src={reaction.icon} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <button onClick={() => toggleComments(post.id)} type="button">
                  <Icon name="message_circle" size={18} /> Bình luận
                </button>
              </div>

              {openCommentPostIds[post.id] ? (
                <div className="social-comments">
                  {post.comments.length < post.commentsTotal ? (
                    <button className="social-comments-more" onClick={() => showMoreComments(post)} type="button">
                      {loadingMoreComments[post.id] ? "Đang tải..." : "Xem thêm bình luận"}
                    </button>
                  ) : null}

                  {post.comments.map((comment) => (
                    <div className="social-comment" key={comment.id}>
                      <UserAvatar className="social-avatar small" name={comment.author} src={comment.avatarUrl} size={32} />
                      <div>
                        <div className="social-comment-bubble">
                          <strong className="name-with-badge">
                            {comment.author}
                            {comment.verifiedBadge ? <VerifiedBadge size={16} /> : null}
                          </strong>
                          <p>{comment.content}</p>
                        </div>
                        <div className="social-comment-meta">
                          <span>{comment.createdAt}</span>
                          {Number(comment.userId) === Number(currentUser?.id) ? (
                            <button onClick={() => handleDeleteComment(post.id, comment.id)} type="button">Xóa</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="social-comment-form">
                    <UserAvatar className="social-avatar small" name={currentName} src={currentUser?.avatar_url} size={32} />
                    <input
                      className="input"
                      value={commentDrafts[post.id] || ""}
                      onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))}
                      onKeyDown={(event) => handleCommentKeyDown(event, post.id)}
                      placeholder="Viết bình luận..."
                    />
                    <button className="btn btn-secondary" onClick={() => handleAddComment(post.id)} type="button">
                      <Icon name="send" size={16} />
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}

          {!isLoading && posts.length && hasMorePosts ? (
            <div className="social-feed-loader" ref={feedLoaderRef}>
              {isLoadingMore ? (
                <>
                  <span />
                  <span />
                  <span />
                </>
              ) : (
                <small>Cuộn để tải thêm bài viết</small>
              )}
            </div>
          ) : null}
        </main>

        <aside className="social-ad-sidebar">
          {visibleAds.map((ad) => {
            const cardContent = (
              <section className={`card pad social-ad-card ${ad.thumbnailUrl ? "has-thumbnail" : "no-thumbnail"}`}>
                {ad.thumbnailUrl ? (
                  <div className="social-ad-media">
                    <img className="social-ad-thumbnail" src={ad.thumbnailUrl} alt={ad.title} />
                    <div className="social-ad-overlay">
                      <span>Quảng cáo</span>
                      <h3>{ad.title}</h3>
                      <p>
                        {ad.description}
                        {" "}
                        {"isFallback" in ad && ad.isFallback ? (
                          <a href="https://t.me/techmaxvn" target="_blank" rel="noreferrer">Admin</a>
                        ) : null}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="social-ad-body">
                    <span>Quảng cáo</span>
                    <h3>{ad.title}</h3>
                    <p>
                      {ad.description}
                      {" "}
                      {"isFallback" in ad && ad.isFallback ? (
                        <a href="https://t.me/techmaxvn" target="_blank" rel="noreferrer">Admin</a>
                      ) : null}
                    </p>
                  </div>
                )}
              </section>
            );

            return ad.linkUrl ? (
              <a className="social-ad-card-link" href={ad.linkUrl} key={ad.id} rel="noreferrer" target="_blank" onClick={() => trackAdClick(ad.id)}>
                {cardContent}
              </a>
            ) : (
              <div className="social-ad-card-link" key={ad.id}>
                {cardContent}
              </div>
            );
          })}
        </aside>
      </div>

      {isComposerOpen ? (
        <div className="social-modal-backdrop" role="presentation" onMouseDown={() => setIsComposerOpen(false)}>
          <form className="social-modal" onSubmit={handleCreatePost} onMouseDown={(event) => event.stopPropagation()}>
            <header className="social-modal-head">
              <h2>Tạo bài viết</h2>
              <button onClick={() => setIsComposerOpen(false)} type="button" aria-label="Đóng">
                <Icon name="x" size={22} />
              </button>
            </header>

            <div className="social-modal-user">
              <UserAvatar className="social-avatar" name={currentName} src={currentUser?.avatar_url} size={44} />
              <div>
                <strong className="name-with-badge">
                  {currentName}
                  {currentUser?.verified_badge ? <VerifiedBadge size={18} /> : null}
                </strong>
                <div>
                  <span>Công khai</span>
                </div>
              </div>
            </div>

            <textarea
              autoFocus
              className="social-modal-input"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder={`${currentName} ơi, bạn đang nghĩ gì thế?`}
            />

            {imageUrl ? (
              <div className="social-image-preview">
                <img src={imageUrl} alt={imageName || "Ảnh bài viết"} />
                <button className="btn btn-secondary" onClick={() => { setImageUrl(""); setImageName(""); }} type="button">
                  <Icon name="x" size={16} /> Xóa ảnh
                </button>
              </div>
            ) : null}

            <div className="social-modal-tools">
              <strong>Thêm vào bài viết của bạn</strong>
              <label title="Ảnh">
                <Icon name="image" size={22} />
                <input accept="image/*" onChange={handleImageChange} type="file" />
              </label>
              <div className="social-emoji-tool">
                <button
                  type="button"
                  title="Cảm xúc"
                  onClick={() => setIsEmojiPickerOpen((current) => !current)}
                >
                  <Icon name="smile" size={22} />
                </button>
                {isEmojiPickerOpen ? (
                  <div className="social-emoji-picker" role="menu" aria-label="Chọn cảm xúc">
                    {composerEmojis.map((emoji) => (
                      <button key={emoji} onClick={() => insertComposerEmoji(emoji)} type="button">
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <button className="social-modal-submit" disabled={isPosting || (!content.trim() && !imageUrl)} type="submit">
              {isPosting ? "Đang đăng..." : "Đăng"}
            </button>
          </form>
        </div>
      ) : null}

      {editingPost ? (
        <div className="social-modal-backdrop" role="presentation" onMouseDown={() => setEditingPost(null)}>
          <form className="social-modal" onSubmit={handleUpdatePost} onMouseDown={(event) => event.stopPropagation()}>
            <header className="social-modal-head">
              <h2>Chỉnh sửa bài viết</h2>
              <button onClick={() => setEditingPost(null)} type="button" aria-label="Đóng">
                <Icon name="x" size={22} />
              </button>
            </header>

            <div className="social-modal-user">
              <UserAvatar className="social-avatar" name={editingPost.author} src={editingPost.avatarUrl} size={44} />
              <div>
                <strong className="name-with-badge">
                  {editingPost.author}
                  {editingPost.verifiedBadge ? <VerifiedBadge size={18} /> : null}
                </strong>
                <div>
                  <span>Công khai</span>
                </div>
              </div>
            </div>

            <textarea
              autoFocus
              className="social-modal-input"
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
              placeholder="Nội dung bài viết"
            />

            {editImageUrl ? (
              <div className="social-image-preview">
                <img src={editImageUrl} alt={editImageName || "Ảnh bài viết"} />
                <button className="btn btn-secondary" onClick={() => setEditImageUrl("")} type="button">
                  <Icon name="x" size={16} /> Xóa ảnh
                </button>
              </div>
            ) : null}

            <div className="social-modal-tools">
              <strong>Thêm vào bài viết của bạn</strong>
              <label title="Ảnh">
                <Icon name="image" size={22} />
                <input accept="image/*" onChange={handleEditImageChange} type="file" />
              </label>
              <div className="social-emoji-tool">
                <button
                  type="button"
                  title="Cảm xúc"
                  onClick={() => setIsEditEmojiPickerOpen((current) => !current)}
                >
                  <Icon name="smile" size={22} />
                </button>
                {isEditEmojiPickerOpen ? (
                  <div className="social-emoji-picker" role="menu" aria-label="Chọn cảm xúc">
                    {composerEmojis.map((emoji) => (
                      <button key={emoji} onClick={() => insertEditEmoji(emoji)} type="button">
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <button className="social-modal-submit" disabled={isSavingEdit || (!editContent.trim() && !editImageUrl.trim())} type="submit">
              {isSavingEdit ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </form>
        </div>
      ) : null}
    </AppFrame>
  );
}
