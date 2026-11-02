/**
 * Instagram Post Details Grabber & Transcriber - Side Panel Controller
 */

(() => {
  let currentBatch = null;
  let isBatchTranscribing = false;

  // DOM Elements
  const countBadge = document.getElementById("post-count-badge");
  const profileBanner = document.getElementById("profile-banner");
  const profileAvatar = document.getElementById("profile-avatar");
  const profileHandle = document.getElementById("profile-handle");
  const profileStats = document.getElementById("profile-stats");
  const toolsBar = document.getElementById("tools-bar");
  const btnTranscribeAll = document.getElementById("btn-transcribe-all");
  const transcribeAllText = document.getElementById("transcribe-all-text");
  const postsContainer = document.getElementById("posts-container");
  const batchSummary = document.getElementById("batch-summary");
  const summaryTotalPosts = document.getElementById("summary-total-posts");
  const summaryTotalLikes = document.getElementById("summary-total-likes");
  const summaryReelsCount = document.getElementById("summary-reels-count");
  const summaryPhotosCount = document.getElementById("summary-photos-count");
  const summaryTagsContainer = document.getElementById("summary-tags-container");
  const summaryTagsText = document.getElementById("summary-tags-text");
  const cardsList = document.getElementById("cards-list");
  const emptyState = document.getElementById("empty-state");
  const warningToast = document.getElementById("warning-toast");
  const footerActions = document.getElementById("footer-actions");
  const btnCopyAll = document.getElementById("btn-copy-all");
  const btnCopyText = document.getElementById("btn-copy-text");
  const btnDownload = document.getElementById("btn-download");
  const btnClear = document.getElementById("btn-clear");

  let toastTimer = null;

  function showWarningToast(message, actionText, onAction) {
    if (toastTimer) clearTimeout(toastTimer);
    warningToast.innerHTML = `
      <div class="ig-sp-toast-msg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:#f59e0b;flex-shrink:0;">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>${escapeHtml(message)}</span>
      </div>
      ${actionText ? `<button class="ig-sp-toast-action" type="button" id="toast-action-btn">${escapeHtml(actionText)}</button>` : ""}
    `;
    warningToast.style.display = "flex";

    if (actionText && onAction) {
      const actBtn = warningToast.querySelector("#toast-action-btn");
      if (actBtn) {
        actBtn.addEventListener("click", () => {
          onAction();
          hideWarningToast();
        });
      }
    }

    toastTimer = setTimeout(() => {
      hideWarningToast();
    }, 4500);
  }

  function hideWarningToast() {
    warningToast.style.display = "none";
    if (toastTimer) clearTimeout(toastTimer);
  }

  // SVG Icons
  const ICONS = {
    heart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`,
    comment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>`,
    copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:11px;height:11px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:11px;height:11px;"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>`,
    play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
    image: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`,
  };

  function formatNumber(num) {
    if (num === null || num === undefined) return "-";
    if (typeof num === "string") return num;
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
    return num.toLocaleString();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Request transcription for a single post
   */
  async function transcribePost(post, onProgress) {
    if (!post || !post.url) return { success: false, error: "No URL" };
    if (onProgress) onProgress("loading");

    try {
      const response = await chrome.runtime.sendMessage({
        action: "transcribe_reel",
        url: post.url,
        shortcode: post.shortcode,
      });

      if (response && response.success && response.transcript) {
        post.transcript = response.transcript;
        if (onProgress) onProgress("done", response.transcript);
        return { success: true, transcript: response.transcript };
      } else {
        if (onProgress) onProgress("error", response?.error || "Failed");
        return { success: false, error: response?.error || "Transcription failed" };
      }
    } catch (err) {
      if (onProgress) onProgress("error", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Render inline mic button next to timestamp in card meta row
   */
  function renderCardMicButton(holder, post) {
    holder.innerHTML = "";

    if (post.postType !== "video") return;

    const btn = document.createElement("button");
    btn.type = "button";

    if (post.transcript) {
      btn.className = "ig-sp-mic-btn ig-sp-mic-done";
      btn.setAttribute("title", "Transcribed (Click to copy transcript)");
      btn.innerHTML = `${ICONS.mic}<span class="ig-sp-mic-label">Transcribed</span>`;

      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(post.transcript);
          const lbl = btn.querySelector(".ig-sp-mic-label");
          if (lbl) lbl.textContent = "Copied!";
          setTimeout(() => {
            if (lbl) lbl.textContent = "Transcribed";
          }, 1500);
        } catch (err) {}
      });
    } else {
      btn.className = "ig-sp-mic-btn ig-sp-mic-pending";
      btn.setAttribute("title", "Transcribe Reel audio");
      btn.innerHTML = `${ICONS.mic}`;

      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.className = "ig-sp-mic-btn ig-sp-mic-loading";
        btn.innerHTML = `<div class="ig-sp-mic-spinner"></div>`;
        btn.setAttribute("title", "Transcribing audio...");

        await transcribePost(post, (status) => {
          if (status === "done") {
            renderCardMicButton(holder, post);
            updateTranscribeAllButtonText();
          } else if (status === "error") {
            btn.className = "ig-sp-mic-btn ig-sp-mic-error";
            btn.innerHTML = `⚠️`;
            btn.setAttribute("title", "Transcription failed. Click to retry.");
            setTimeout(() => {
              renderCardMicButton(holder, post);
            }, 3000);
          }
        });
      });
    }

    holder.appendChild(btn);
  }

  function updateTranscribeAllButtonText() {
    if (!currentBatch || !currentBatch.posts) {
      toolsBar.style.display = "none";
      return;
    }

    const videoPosts = currentBatch.posts.filter((p) => p.postType === "video");
    if (videoPosts.length === 0) {
      toolsBar.style.display = "none";
      return;
    }

    toolsBar.style.display = "flex";
    const untranscribed = videoPosts.filter((p) => !p.transcript);

    if (untranscribed.length === 0) {
      btnTranscribeAll.disabled = true;
      transcribeAllText.textContent = `✓ All ${videoPosts.length} Reels Transcribed`;
    } else {
      btnTranscribeAll.disabled = isBatchTranscribing;
      if (!isBatchTranscribing) {
        transcribeAllText.textContent = `Transcribe All Reels (${untranscribed.length} left)`;
      }
    }
  }

  /**
   * Render the batch data into the side panel
   */
  function renderBatch(batch) {
    currentBatch = batch;

    if (!batch || !batch.posts || batch.posts.length === 0) {
      countBadge.textContent = "0";
      profileBanner.style.display = "none";
      toolsBar.style.display = "none";
      footerActions.style.display = "none";
      if (batchSummary) batchSummary.style.display = "none";
      if (cardsList) cardsList.innerHTML = "";
      emptyState.style.display = "flex";
      return;
    }

    emptyState.style.display = "none";
    footerActions.style.display = "flex";

    const posts = batch.posts;
    const totalCount = posts.length;
    countBadge.textContent = String(totalCount);

    // 1. Calculate Summary Stats
    let totalLikes = 0;
    let videoCount = 0;
    let photoCount = 0;
    let carouselCount = 0;
    const allHashtags = [];

    posts.forEach((p) => {
      if (p.engagement?.likes) totalLikes += p.engagement.likes;
      if (p.postType === "video") videoCount++;
      else if (p.postType === "carousel") carouselCount++;
      else photoCount++;

      if (Array.isArray(p.content?.hashtags)) {
        allHashtags.push(...p.content.hashtags);
      }
    });

    if (batchSummary) {
      summaryTotalPosts.textContent = totalCount;
      summaryTotalLikes.textContent = formatNumber(totalLikes);
      summaryReelsCount.textContent = videoCount;
      summaryPhotosCount.textContent = photoCount + carouselCount;

      const uniqueTags = Array.from(new Set(allHashtags));
      if (uniqueTags.length > 0) {
        summaryTagsText.textContent = uniqueTags.slice(0, 8).join(" ");
        summaryTagsContainer.style.display = "flex";
      } else {
        summaryTagsContainer.style.display = "none";
      }
      batchSummary.style.display = "block";
    }

    // 2. Profile Banner
    const firstAuthor = posts[0]?.author;
    const username = batch.profile || firstAuthor?.username || "instagram_user";
    profileHandle.textContent = `@${username}`;
    profileStats.textContent = `${totalCount} post${totalCount > 1 ? "s" : ""} scraped`;

    if (firstAuthor?.avatarUrl) {
      profileAvatar.src = firstAuthor.avatarUrl;
      profileAvatar.style.display = "block";
    } else {
      profileAvatar.style.display = "none";
    }
    profileBanner.style.display = "flex";

    updateTranscribeAllButtonText();
    btnCopyText.textContent = `Copy Full JSON (${totalCount})`;

    // 3. Clear and Render Cards
    if (cardsList) {
      cardsList.innerHTML = "";
    } else {
      postsContainer.querySelectorAll(".ig-sp-card").forEach((c) => c.remove());
    }

    // Render Cards
    posts.forEach((post) => {
      const card = document.createElement("div");
      card.className = "ig-sp-card";
      card.setAttribute("data-shortcode", post.shortcode);
      card.setAttribute("title", "Click to view this post on Instagram");

      // 1. Thumbnail selection
      const thumbUrl =
        post.media?.thumbnailUrl ||
        post.media?.items?.[0]?.thumbnail ||
        post.media?.items?.[0]?.poster ||
        post.media?.items?.[0]?.url ||
        null;

      // 2. Clean thumbnail element without any overlay badges
      const thumbWrap = document.createElement("div");
      thumbWrap.className = "ig-sp-thumb-wrap";
      if (thumbUrl && !thumbUrl.startsWith("blob:")) {
        thumbWrap.innerHTML = `
          <img class="ig-sp-thumb-img" src="${escapeHtml(thumbUrl)}" alt="Post preview" loading="lazy" />
        `;
      } else {
        thumbWrap.innerHTML = `
          <div class="ig-sp-thumb-fallback">${post.postType === "video" ? ICONS.play : ICONS.image}</div>
        `;
      }

      // 3. Details element
      const details = document.createElement("div");
      details.className = "ig-sp-details";

      let typeLabel = "Post";
      if (post.postType === "video") typeLabel = "Reel";
      else if (post.postType === "carousel") typeLabel = "Carousel";
      else if (post.postType === "photo") typeLabel = "Photo";

      const timeLabel = post.timestamp?.relative || "";
      const likesCount = formatNumber(post.engagement?.likes);
      const commentsCount = formatNumber(post.engagement?.comments);
      const captionText = post.content?.caption || "No caption";

      const metaRow = document.createElement("div");
      metaRow.className = "ig-sp-meta-row";
      metaRow.innerHTML = `
        <span class="ig-sp-type-pill">${escapeHtml(typeLabel)}</span>
        ${timeLabel ? `<span class="ig-sp-bullet">•</span><span class="ig-sp-time">${escapeHtml(timeLabel)}</span>` : ""}
      `;

      // Mic button next to timestamp for Reels only
      if (post.postType === "video") {
        const micHolder = document.createElement("span");
        micHolder.className = "ig-sp-mic-holder";
        renderCardMicButton(micHolder, post);
        metaRow.appendChild(micHolder);
      }

      const statsRow = document.createElement("div");
      statsRow.className = "ig-sp-stats-row";
      statsRow.innerHTML = `
        <span class="ig-sp-stat-item" title="${escapeHtml(post.engagement?.likesText || "")}">${ICONS.heart} ${likesCount}</span>
        <span class="ig-sp-stat-item" title="${escapeHtml(post.engagement?.commentsText || "")}">${ICONS.comment} ${commentsCount}</span>
      `;

      const captionEl = document.createElement("p");
      captionEl.className = "ig-sp-caption";
      captionEl.setAttribute("title", captionText);
      captionEl.textContent = captionText;

      details.appendChild(metaRow);
      details.appendChild(statsRow);
      details.appendChild(captionEl);

      card.appendChild(thumbWrap);
      card.appendChild(details);

      // 4. Card Click -> trigger native post modal in Instagram tab or show warning
      card.addEventListener("click", async (e) => {
        // Prevent click if user clicked directly on the mic button
        if (e.target.closest(".ig-sp-mic-btn")) {
          return;
        }

        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeTab = tabs[0];
          if (!activeTab || !activeTab.id) {
            showWarningToast("No active browser tab found.", "Open Post ↗", () => {
              chrome.tabs.create({ url: post.url });
            });
            return;
          }

          chrome.tabs.sendMessage(
            activeTab.id,
            { action: "open_post_modal", shortcode: post.shortcode },
            (response) => {
              if (chrome.runtime.lastError || !response || !response.success) {
                showWarningToast("Not on this profile page.", "Open Post ↗", () => {
                  chrome.tabs.create({ url: post.url });
                });
              } else {
                card.classList.add("active-open");
                setTimeout(() => card.classList.remove("active-open"), 800);
                hideWarningToast();
              }
            }
          );
        } catch (err) {
          showWarningToast("Could not connect to Instagram tab.", "Open Post ↗", () => {
            chrome.tabs.create({ url: post.url });
          });
        }
      });

      if (cardsList) {
        cardsList.appendChild(card);
      } else {
        postsContainer.appendChild(card);
      }
    });
  }

  // Transcribe All Reels button listener
  btnTranscribeAll.addEventListener("click", async () => {
    if (isBatchTranscribing || !currentBatch || !currentBatch.posts) return;

    const untranscribed = currentBatch.posts.filter((p) => p.postType === "video" && !p.transcript);
    if (untranscribed.length === 0) return;

    isBatchTranscribing = true;
    btnTranscribeAll.disabled = true;

    for (let i = 0; i < untranscribed.length; i++) {
      const post = untranscribed[i];
      transcribeAllText.textContent = `Transcribing ${i + 1} of ${untranscribed.length}...`;

      // Update card UI to loading spinner
      const card = postsContainer.querySelector(`.ig-sp-card[data-shortcode="${post.shortcode}"]`);
      const holder = card?.querySelector(".ig-sp-mic-holder");
      if (holder) {
        holder.innerHTML = `<button type="button" class="ig-sp-mic-btn ig-sp-mic-loading" title="Transcribing audio..."><div class="ig-sp-mic-spinner"></div></button>`;
      }

      await transcribePost(post);

      if (holder) {
        renderCardMicButton(holder, post);
      }

      // 400ms pause between requests to prevent rate limit
      await new Promise((r) => setTimeout(r, 400));
    }

    isBatchTranscribing = false;
    updateTranscribeAllButtonText();
  });

  // Copy Full JSON Button
  btnCopyAll.addEventListener("click", async () => {
    if (!currentBatch) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(currentBatch, null, 2));
      btnCopyAll.classList.add("copied");
      btnCopyText.textContent = "✓ Copied Full JSON!";
      setTimeout(() => {
        btnCopyAll.classList.remove("copied");
        btnCopyText.textContent = `Copy Full JSON (${currentBatch.posts.length})`;
      }, 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  });

  // Download JSON File
  btnDownload.addEventListener("click", () => {
    if (!currentBatch) return;
    const filename = `instagram_${currentBatch.profile || "scraped"}_${currentBatch.posts.length}_posts.json`;
    const blob = new Blob([JSON.stringify(currentBatch, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  // Clear list
  btnClear.addEventListener("click", () => {
    chrome.storage.local.remove("last_scraped_batch", () => {
      renderBatch(null);
    });
  });

  // Initial Load from Storage
  chrome.storage.local.get(["last_scraped_batch", "ig_transcripts"], (res) => {
    const batch = res?.last_scraped_batch;
    const transcripts = res?.ig_transcripts || {};

    if (batch && Array.isArray(batch.posts)) {
      // Merge cached transcripts into batch if not present
      batch.posts.forEach((p) => {
        if (!p.transcript && transcripts[p.shortcode]) {
          p.transcript = transcripts[p.shortcode];
        }
      });
      renderBatch(batch);
    } else {
      renderBatch(null);
    }
  });

  // Listen for storage updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.last_scraped_batch) {
      renderBatch(changes.last_scraped_batch.newValue);
    }
  });

  // Listen for direct runtime messages from background or content script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "batch_scraped" && message.data) {
      renderBatch(message.data);
    }

    if (message.action === "transcript_updated" && message.shortcode && currentBatch) {
      const post = currentBatch.posts.find((p) => p.shortcode === message.shortcode);
      if (post) {
        post.transcript = message.transcript;
        const card = postsContainer.querySelector(`.ig-sp-card[data-shortcode="${message.shortcode}"]`);
        const holder = card?.querySelector(".ig-sp-mic-holder");
        if (holder) {
          renderCardMicButton(holder, post);
        }
        updateTranscribeAllButtonText();
      }
    }
  });
})();
