(function () {
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1];
  })();
  if (!currentScript || window.TechMaxLiveChatLoaded) return;
  window.TechMaxLiveChatLoaded = true;

  var apiOrigin = currentScript.getAttribute("data-api-origin") || new URL(currentScript.src).origin;
  var widgetKey = currentScript.getAttribute("data-widget-key") || currentScript.getAttribute("data-key");
  if (!widgetKey) {
    console.warn("[TechMax LiveChat] Missing data-widget-key.");
    return;
  }

  var storageKey = "techmax_livechat_visitor_" + widgetKey;
  var visitorId = localStorage.getItem(storageKey);
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(storageKey, visitorId);
  }
  var lastMessageId = Number(localStorage.getItem(storageKey + "_last") || 0);
  var open = false;
  var pollTimer = null;
  var replyTo = null;
  var selectedImage = null;
  var config = {
    title: currentScript.getAttribute("data-title") || "Hỗ trợ trực tuyến",
    subtitle: currentScript.getAttribute("data-subtitle") || "Chúng tôi thường phản hồi trong vài phút.",
    accent: currentScript.getAttribute("data-accent") || "#e02424"
  };

  function escapeHtml(text) {
    return String(text || "").replace(/[&<>"']/g, function (char) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
    });
  }

  function injectStyle() {
    var old = document.getElementById("tm-livechat-style");
    if (old) old.remove();
    var style = document.createElement("style");
    style.id = "tm-livechat-style";
    style.textContent = [
      ".tm-livechat *{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}",
      ".tm-livechat-button{position:fixed;right:22px;bottom:22px;z-index:2147483000;width:58px;height:58px;border:0;border-radius:50%;background:" + config.accent + ";color:#fff;box-shadow:0 16px 40px rgba(0,0,0,.28);cursor:pointer;display:grid;place-items:center}",
      ".tm-livechat-button svg{width:27px;height:27px}",
      ".tm-livechat-panel{position:fixed;right:22px;bottom:92px;z-index:2147483000;width:min(380px,calc(100vw - 28px));height:min(590px,calc(100vh - 118px));display:none;grid-template-rows:auto 1fr auto;overflow:hidden;border:1px solid rgba(255,255,255,.12);border-radius:18px;background:#121212;color:#fff;box-shadow:0 24px 90px rgba(0,0,0,.45)}",
      ".tm-livechat-panel.open{display:grid}",
      ".tm-livechat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;background:linear-gradient(135deg," + config.accent + ",#111)}",
      ".tm-livechat-head strong{display:block;font-size:16px}.tm-livechat-head span{display:block;margin-top:3px;color:rgba(255,255,255,.78);font-size:12px}",
      ".tm-livechat-close{border:0;background:rgba(0,0,0,.22);color:#fff;border-radius:10px;width:34px;height:34px;cursor:pointer}",
      ".tm-livechat-messages{min-height:0;overflow:auto;padding:16px;background:#171717}",
      ".tm-livechat-empty{margin:52px 20px;text-align:center;color:#aaa;font-size:14px;line-height:1.5}",
      ".tm-livechat-msg{display:flex;margin:0 0 10px}.tm-livechat-msg.agent{justify-content:flex-start}.tm-livechat-msg.customer{justify-content:flex-end}",
      ".tm-livechat-bubble{max-width:84%;padding:10px 12px;border-radius:14px;background:#242424;color:#f8f8f8;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}",
      ".tm-livechat-msg.customer .tm-livechat-bubble{background:" + config.accent + ";color:#fff;border-bottom-right-radius:4px}.tm-livechat-msg.agent .tm-livechat-bubble{border-bottom-left-radius:4px}",
      ".tm-livechat-quote{display:block;margin:-2px 0 7px;padding:6px 8px;border-left:3px solid rgba(255,255,255,.5);border-radius:8px;background:rgba(255,255,255,.12);color:rgba(255,255,255,.8);font-size:12px;line-height:1.35}",
      ".tm-livechat-bubble img{display:block;max-width:100%;max-height:210px;margin-top:6px;border-radius:10px;object-fit:contain;background:#000}",
      ".tm-livechat-actions{display:flex;justify-content:flex-end;margin-top:6px}.tm-livechat-reply{border:0;background:transparent;color:rgba(255,255,255,.72);font-size:11px;cursor:pointer;padding:0}",
      ".tm-livechat-time{display:block;margin-top:5px;color:rgba(255,255,255,.58);font-size:10px}",
      ".tm-livechat-preview,.tm-livechat-replybar{display:flex;align-items:center;gap:8px;margin:0 12px 8px;padding:8px;border-radius:12px;background:#1b1b1b;color:#ddd;font-size:12px}",
      ".tm-livechat-preview img{width:38px;height:38px;border-radius:8px;object-fit:cover}.tm-livechat-preview button,.tm-livechat-replybar button{margin-left:auto;border:0;background:rgba(255,255,255,.1);color:#fff;border-radius:8px;width:26px;height:26px;cursor:pointer}",
      ".tm-livechat-form-wrap{background:#101010;border-top:1px solid rgba(255,255,255,.08);padding-top:10px}",
      ".tm-livechat-form{display:grid;grid-template-columns:40px 1fr 44px;gap:8px;padding:0 12px 12px}",
      ".tm-livechat-form input[type=file]{display:none}.tm-livechat-attach,.tm-livechat-send{height:44px;border:0;border-radius:50%;color:#fff;cursor:pointer;display:grid;place-items:center}",
      ".tm-livechat-attach{background:#242424}.tm-livechat-send{background:" + config.accent + "}",
      ".tm-livechat-form input[type=text]{width:100%;height:44px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:#1b1b1b;color:#fff;padding:0 14px;outline:none}",
      "@media(max-width:520px){.tm-livechat-panel{right:10px;bottom:82px;width:calc(100vw - 20px);height:min(620px,calc(100vh - 96px))}.tm-livechat-button{right:16px;bottom:16px}}"
    ].join("");
    document.head.appendChild(style);
  }

  injectStyle();
  var root = document.createElement("div");
  root.className = "tm-livechat";
  root.innerHTML = [
    "<button class='tm-livechat-button' type='button' aria-label='Mở live chat'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'><path d='M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z'/></svg></button>",
    "<section class='tm-livechat-panel' aria-label='Live chat'>",
    "<header class='tm-livechat-head'><div><strong></strong><span></span></div><button class='tm-livechat-close' type='button'>×</button></header>",
    "<div class='tm-livechat-messages'><div class='tm-livechat-empty'>Chào bạn, hãy nhắn nội dung cần hỗ trợ. Đội ngũ sẽ phản hồi ngay tại đây.</div></div>",
    "<div class='tm-livechat-form-wrap'><div class='tm-livechat-replybar' style='display:none'></div><div class='tm-livechat-preview' style='display:none'></div><form class='tm-livechat-form'><button class='tm-livechat-attach' type='button' aria-label='Chọn ảnh'>＋</button><input type='file' accept='image/png,image/jpeg,image/webp,image/gif' /><input name='message' type='text' autocomplete='off' placeholder='Nhập tin nhắn...' /><button class='tm-livechat-send' type='submit' aria-label='Gửi'><svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' width='19' height='19'><path d='m22 2-7 20-4-9-9-4Z'/><path d='M22 2 11 13'/></svg></button></form></div>",
    "</section>"
  ].join("");
  document.body.appendChild(root);

  var panel = root.querySelector(".tm-livechat-panel");
  var launcher = root.querySelector(".tm-livechat-button");
  var closeBtn = root.querySelector(".tm-livechat-close");
  var messagesEl = root.querySelector(".tm-livechat-messages");
  var emptyEl = root.querySelector(".tm-livechat-empty");
  var form = root.querySelector(".tm-livechat-form");
  var input = form.querySelector("input[type=text]");
  var fileInput = form.querySelector("input[type=file]");
  var attachBtn = root.querySelector(".tm-livechat-attach");
  var previewEl = root.querySelector(".tm-livechat-preview");
  var replybarEl = root.querySelector(".tm-livechat-replybar");

  function renderHeader() {
    root.querySelector(".tm-livechat-head strong").textContent = config.title;
    root.querySelector(".tm-livechat-head span").textContent = config.subtitle;
  }
  renderHeader();

  async function loadConfig() {
    try {
      var response = await fetch(apiOrigin + "/api/livechat/config?widget_key=" + encodeURIComponent(widgetKey));
      if (!response.ok) throw new Error("Config failed");
      var payload = await response.json();
      if (payload && payload.widget) {
        config.title = payload.widget.title || config.title;
        config.subtitle = payload.widget.subtitle || config.subtitle;
        config.accent = payload.widget.accent_color || config.accent;
        injectStyle();
        renderHeader();
      }
    } catch (error) {
      console.warn("[TechMax LiveChat] Domain is not allowed or widget is inactive.", error);
    }
  }

  function renderReplybar() {
    if (!replyTo) {
      replybarEl.style.display = "none";
      replybarEl.innerHTML = "";
      return;
    }
    replybarEl.style.display = "flex";
    replybarEl.innerHTML = "<span>Đang trả lời: " + escapeHtml(replyTo.text).slice(0, 80) + "</span><button type='button'>×</button>";
    replybarEl.querySelector("button").onclick = function () {
      replyTo = null;
      renderReplybar();
    };
  }

  function renderPreview() {
    if (!selectedImage) {
      previewEl.style.display = "none";
      previewEl.innerHTML = "";
      return;
    }
    previewEl.style.display = "flex";
    previewEl.innerHTML = "<img src='" + selectedImage.dataUrl + "' alt='' /><span>" + escapeHtml(selectedImage.name) + "</span><button type='button'>×</button>";
    previewEl.querySelector("button").onclick = function () {
      selectedImage = null;
      fileInput.value = "";
      renderPreview();
    };
  }

  function appendMessage(message) {
    if (!message || (!message.text && !(message.attachments || []).length)) return;
    if (emptyEl) emptyEl.style.display = "none";
    var row = document.createElement("div");
    row.className = "tm-livechat-msg " + (message.from === "agent" ? "agent" : "customer");
    var bubble = document.createElement("div");
    bubble.className = "tm-livechat-bubble";
    if (message.quote && message.quote.text) {
      var quote = document.createElement("span");
      quote.className = "tm-livechat-quote";
      quote.textContent = message.quote.text;
      bubble.appendChild(quote);
    }
    if (message.text) bubble.appendChild(document.createTextNode(message.text));
    (message.attachments || []).forEach(function (attachment) {
      var url = attachment.url || attachment.thumb;
      if (!url) return;
      var img = document.createElement("img");
      img.src = url;
      img.alt = attachment.title || "Ảnh";
      bubble.appendChild(img);
    });
    var time = document.createElement("span");
    time.className = "tm-livechat-time";
    time.textContent = message.time ? new Date(String(message.time).replace(" ", "T")).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    bubble.appendChild(time);
    var actions = document.createElement("span");
    actions.className = "tm-livechat-actions";
    var replyBtn = document.createElement("button");
    replyBtn.className = "tm-livechat-reply";
    replyBtn.type = "button";
    replyBtn.textContent = "Trả lời";
    replyBtn.onclick = function () {
      replyTo = { id: message.id, text: message.text || "[Ảnh]", name: message.name || "" };
      renderReplybar();
      input.focus();
    };
    actions.appendChild(replyBtn);
    bubble.appendChild(actions);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (message.id) {
      lastMessageId = Math.max(lastMessageId, Number(message.id));
      localStorage.setItem(storageKey + "_last", String(lastMessageId));
    }
  }

  async function poll() {
    try {
      var url = apiOrigin + "/api/livechat/messages?widget_key=" + encodeURIComponent(widgetKey) + "&visitor_id=" + encodeURIComponent(visitorId) + "&after_id=" + encodeURIComponent(lastMessageId);
      var response = await fetch(url);
      var payload = await response.json();
      if (payload && payload.success && Array.isArray(payload.messages)) payload.messages.forEach(appendMessage);
    } catch (error) {
      console.warn("[TechMax LiveChat] Poll failed", error);
    }
  }

  function setOpen(nextOpen) {
    open = nextOpen;
    panel.classList.toggle("open", open);
    if (open) {
      input.focus();
      poll();
      clearInterval(pollTimer);
      pollTimer = setInterval(poll, 3500);
    } else {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  attachBtn.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type) || file.size > 6 * 1024 * 1024) {
      appendMessage({ from: "agent", text: "Ảnh không hợp lệ hoặc lớn hơn 6MB.", time: new Date().toISOString() });
      fileInput.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      selectedImage = { name: file.name, dataUrl: String(reader.result || "") };
      renderPreview();
    };
    reader.readAsDataURL(file);
  });

  launcher.addEventListener("click", function () { setOpen(!open); });
  closeBtn.addEventListener("click", function () { setOpen(false); });
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var text = input.value.trim();
    if (!text && !selectedImage) return;
    var imageToSend = selectedImage;
    var quoteToSend = replyTo;
    input.value = "";
    selectedImage = null;
    replyTo = null;
    renderPreview();
    renderReplybar();
    appendMessage({
      from: "customer",
      text: text,
      time: new Date().toISOString(),
      quote: quoteToSend,
      attachments: imageToSend ? [{ url: imageToSend.dataUrl, thumb: imageToSend.dataUrl, title: imageToSend.name }] : []
    });
    try {
      var response = await fetch(apiOrigin + "/api/livechat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_key: widgetKey,
          visitor_id: visitorId,
          visitor_name: localStorage.getItem(storageKey + "_name") || "Khách website",
          message: text,
          image_data_url: imageToSend ? imageToSend.dataUrl : null,
          quote: quoteToSend,
          page_url: location.href,
          page_title: document.title
        })
      });
      var payload = await response.json().catch(function () { return null; });
      if (!response.ok || (payload && payload.success === false)) {
        throw new Error((payload && payload.message) || "Send failed");
      }
      if (payload && payload.message_id) {
        lastMessageId = Math.max(lastMessageId, Number(payload.message_id));
        localStorage.setItem(storageKey + "_last", String(lastMessageId));
      }
      poll();
    } catch (error) {
      appendMessage({ from: "agent", text: "Tin nhắn chưa gửi được, bạn thử lại giúp mình nhé.", time: new Date().toISOString() });
    }
  });

  loadConfig();
})();
