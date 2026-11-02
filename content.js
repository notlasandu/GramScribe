// Instagram Post Details Grabber & Profile Auto-Scraper - Content Script
(function () {
  "use strict";

  const HEADER_BTN_CLASS = "ig-grabber-header-btn";
  const ACTIONS_CONTAINER_CLASS = "ig-grabber-header-actions";
  const ACTION_BAR_GROUP_CLASS = "ig-grabber-action-bar-group";
  const ACTION_ICON_BTN_CLASS = "ig-grabber-icon-btn";
  const TRANSCRIPT_BTN_CLASS = "ig-header-transcript-btn";
  const TRANSCRIPT_PANEL_ID = "ig-post-transcript-panel";
  const TRIGGER_BTN_CLASS = "ig-profile-grab-trigger";
  const START_MODAL_ID = "ig-batch-start-modal";
  const SUMMARY_MODAL_ID = "ig-batch-summary-modal";
  const PROGRESS_LINE_ID = "ig-live-progress-line";
  const LIVE_HUD_ID = "ig-live-hud-pill";
  const BLOCKER_OVERLAY_ID = "ig-scraping-blocker-overlay";

  let isBatchRunning = false;
  let cancelRequested = false;

  const knownTranscripts = new Map();

  function loadKnownTranscripts() {
    try {
      chrome.storage.local.get(["ig_transcripts", "last_scraped_batch"], (res) => {
        if (res?.ig_transcripts && typeof res.ig_transcripts === "object") {
          Object.entries(res.ig_transcripts).forEach(([sc, text]) => {
            if (sc && text) knownTranscripts.set(sc, text);
          });
        }
        if (res?.last_scraped_batch?.posts && Array.isArray(res.last_scraped_batch.posts)) {
          res.last_scraped_batch.posts.forEach((p) => {
            if (p.shortcode && p.transcript) {
              knownTranscripts.set(p.shortcode, p.transcript);
            }
          });
        }
        document.querySelectorAll(`.${TRANSCRIPT_BTN_CLASS}`).forEach((btn) => {
          const art = btn.closest("article");
          if (art) {
            const data = extractPostData(art);
            if (data && data.shortcode && knownTranscripts.has(data.shortcode)) {
              btn.classList.add("has-transcript");
            }
          }
        });
      });
    } catch (e) {}
  }

  const ICONS = {
    copyAction: `
      <svg aria-label="Copy JSON" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `,
    checkAction: `
      <svg aria-label="Copied!" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `,
    micAction: `
      <svg aria-label="Reel Transcript" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
        <line x1="8" y1="22" x2="16" y2="22"></line>
      </svg>
    `,
    copy: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `,
    check: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `,
    bolt: `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z"></path>
      </svg>
    `,
    download: `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
    `,
    mic: `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      </svg>
    `,
    close: `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    `,
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitFor(conditionFn, timeout = 5000, step = 100) {
    const startTime = Date.now();
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (conditionFn()) {
          clearInterval(interval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(interval);
          resolve(false);
        }
      }, step);
    });
  }

  function parseCount(str) {
    if (!str) return null;
    const match = str.match(/([0-9]+(?:[0-9.,]*[0-9])?)\s*([KkMmBbgG]?)/);
    if (!match) return null;
    let num = parseFloat(match[1].replace(/,/g, ""));
    if (isNaN(num)) return null;
    const unit = match[2].toUpperCase();
    if (unit === "K") num *= 1000;
    if (unit === "M") num *= 1000000;
    if (unit === "B") num *= 1000000000;
    return Math.round(num);
  }

  function getProfileUsername() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const reserved = [
      "p",
      "reel",
      "reels",
      "explore",
      "stories",
      "direct",
      "accounts",
      "developer",
      "about",
    ];
    if (parts.length > 0 && !reserved.includes(parts[0])) {
      return parts[0];
    }
    const headerH2 = document.querySelector("header h2");
    return headerH2 ? headerH2.textContent.trim() : "";
  }

  let lastClickedPostShortcode = null;
  document.addEventListener(
    "click",
    (e) => {
      const link = e.target.closest('a[href*="/p/"], a[href*="/reel/"]');
      if (link && link.href) {
        const m = link.href.match(/(?:p|reel)\/([a-zA-Z0-9_\-]+)/);
        if (m && m[1]) {
          lastClickedPostShortcode = m[1];
        }
      }
    },
    true
  );

  /**
   * Extract all post details from the active article element
   */
  function extractPostData(article) {
    if (!article) return null;

    let originalIsReel = false;
    let postUrl = window.location.href;
    if (postUrl.includes("/reel/")) originalIsReel = true;

    const postLink = article.querySelector('a[href*="/p/"], a[href*="/reel/"]');
    if (postLink && postLink.href) {
      if (postLink.href.includes("/reel/")) originalIsReel = true;
      postUrl = postLink.href;
    }
    const shortcodeMatch = postUrl.match(/(?:p|reel)\/([a-zA-Z0-9_\-]+)/);
    let shortcode = shortcodeMatch ? shortcodeMatch[1] : null;
    if (!shortcode && lastClickedPostShortcode) {
      shortcode = lastClickedPostShortcode;
    }
    if (shortcode) {
      postUrl = `https://www.instagram.com/p/${shortcode}/`;
    }

    const header = article.querySelector("header");
    let authorUsername = "";
    let authorProfileUrl = "";
    let authorAvatarUrl = "";

    if (header) {
      const userLink =
        header.querySelector('a[role="link"]:not([tabindex="-1"])') ||
        header.querySelector('a[href^="/"], a[href*="instagram.com"]');
      if (userLink) {
        authorUsername = userLink.textContent.trim().replace(/^•\s*/, "");
        authorProfileUrl = userLink.href;
      }
      const avatarImg = header.querySelector("img");
      if (avatarImg) {
        authorAvatarUrl = avatarImg.src;
      }
    }

    if (!authorUsername) {
      const firstLink = article.querySelector('h2 a, ul li a[role="link"]');
      if (firstLink) {
        authorUsername = firstLink.textContent.trim();
        authorProfileUrl = firstLink.href;
      }
    }

    // Check meta tags for author if header not present (standalone reel / post page)
    if (!authorUsername) {
      const descMeta =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      if (descMeta && descMeta.content) {
        const m = descMeta.content.match(/-\s*([a-zA-Z0-9_.]+)\s+on\s+/i);
        if (m) {
          authorUsername = m[1];
        }
      }
    }

    if (!authorAvatarUrl && authorUsername) {
      const avatarImg = article.querySelector(
        `img[alt*="${authorUsername}'s profile picture"], img[alt*="profile picture"]`
      );
      if (avatarImg) {
        authorAvatarUrl = avatarImg.currentSrc || avatarImg.src;
      }
    }

    if (!authorUsername) {
      authorUsername = getProfileUsername();
    }

    if (!authorProfileUrl && authorUsername && authorUsername !== "instagram_profile") {
      authorProfileUrl = `https://www.instagram.com/${authorUsername}/`;
    }

    let caption = "";
    const h1El = article.querySelector("h1");
    if (h1El) {
      caption = h1El.textContent.trim();
    } else {
      const firstComment = article.querySelector("ul li");
      if (firstComment) {
        const text = firstComment.textContent.trim();
        caption =
          authorUsername && text.startsWith(authorUsername)
            ? text.slice(authorUsername.length).trim()
            : text;
      }
    }

    // Fallback for standalone post/reel page: extract from meta description
    if (!caption) {
      const descMeta =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');
      if (descMeta && descMeta.content) {
        const quoteMatch = descMeta.content.match(
          /:\s*(?:&quot;|")([\s\S]+?)(?:&quot;|")\.?\s*$/
        );
        if (quoteMatch) {
          caption = quoteMatch[1]
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, "&")
            .replace(/&#39;/g, "'")
            .trim();
        }
      }
    }

    const hashtags = caption.match(/#[\p{L}\p{N}_]+/gu) || [];
    const mentions = caption.match(/@[\p{L}\p{N}_.]+/gu) || [];

    const mediaItems = [];
    const seenUrls = new Set();

    // Look for reel thumbnail from the background grid or page
    let reelThumbnail = null;
    let gridLink = null;
    if (shortcode) {
      gridLink = document.querySelector(
        `a[href*="/${shortcode}/"], a[href*="/${shortcode}"]`
      );
      if (gridLink) {
        const gridImg = gridLink.querySelector("img");
        if (gridImg) {
          reelThumbnail = gridImg.currentSrc || gridImg.src || null;
        }
      }
    }
    if (!reelThumbnail) {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg && ogImg.content && !ogImg.content.includes("profile_pic")) {
        reelThumbnail = ogImg.content;
      }
    }

    const videos = article.querySelectorAll("video");
    if (!reelThumbnail && videos.length > 0) {
      const vid = videos[0];
      if (vid && vid.videoWidth > 0 && vid.videoHeight > 0) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = vid.videoWidth;
          canvas.height = vid.videoHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
          reelThumbnail = canvas.toDataURL("image/jpeg", 0.85);
        } catch (e) {}
      }
    }

    videos.forEach((vid) => {
      const src = vid.currentSrc || vid.src || vid.querySelector("source")?.src;
      if (src && !seenUrls.has(src)) {
        seenUrls.add(src);
        const posterUrl = vid.poster || reelThumbnail || null;
        mediaItems.push({
          type: "video",
          url: src,
          poster: posterUrl,
          thumbnail: posterUrl,
        });
      }
    });

    const imgs = article.querySelectorAll("img");
    imgs.forEach((img) => {
      const src = img.currentSrc || img.src;
      const alt = img.alt || "";
      const isHeaderAvatar = header && header.contains(img);
      const isProfilePic = alt.toLowerCase().includes("profile picture");
      const isInsideExcludedSection = Boolean(
        img.closest("header, ul, div.xw2csxc, div[class*='_ac7v'], section, nav, form")
      );
      const isSmallAvatar = Boolean(
        (img.closest("li") || img.closest("div[role='button']")) &&
        (img.width <= 50 || img.height <= 50)
      );
      const isProfilePicCdn =
        /\/t51\.(?:2885|82787)-19\//.test(src) ||
        src.includes("s150x150") ||
        src.includes("s320x320") ||
        src.includes("profile_pic");

      if (
        src &&
        !isHeaderAvatar &&
        !isProfilePic &&
        !isInsideExcludedSection &&
        !isSmallAvatar &&
        !isProfilePicCdn &&
        !seenUrls.has(src)
      ) {
        seenUrls.add(src);
        mediaItems.push({
          type: "image",
          url: src,
          alt: alt,
        });
      }
    });

    // Robust detection: Carousel vs Reel vs Photo
    const hasCarouselArrow = Boolean(
      article.querySelector(
        'button[aria-label="Next"], button[aria-label="Go to next slide"], button[aria-label="Next slide"], button[aria-label="Previous"], button[aria-label="Go to previous slide"], button[aria-label="Previous slide"], svg[aria-label="Next"], svg[aria-label="Previous"]'
      ) ||
      document.querySelector(
        'div[role="dialog"] button[aria-label="Next"], div[role="dialog"] button[aria-label="Go to next slide"], div[role="dialog"] button[aria-label="Previous"], div[role="dialog"] button[aria-label="Go to previous slide"]'
      )
    );

    const isCarousel =
      hasCarouselArrow ||
      Boolean(article.querySelector('svg[aria-label="Carousel"], svg[aria-label="Sidecar"]')) ||
      Boolean(gridLink?.querySelector('svg[aria-label="Carousel"], svg[aria-label="Sidecar"]')) ||
      article.querySelectorAll('div._acaz, div._aamj, div._aamz, div._aamn').length > 1;

    const hasVideo =
      videos.length > 0 ||
      Boolean(article.querySelector("video")) ||
      Boolean(document.querySelector('div[role="dialog"] video')) ||
      Boolean(article.querySelector('div[aria-label="Adjust volume"], svg[aria-label*="Audio"], svg[aria-label="Play"], svg[aria-label="Pause"]')) ||
      Boolean(document.querySelector('div[role="dialog"] div[aria-label="Adjust volume"], div[role="dialog"] svg[aria-label*="Audio"]')) ||
      originalIsReel ||
      Boolean(article.querySelector('svg[aria-label="Reel"], svg[aria-label="Clip"]')) ||
      Boolean(gridLink?.querySelector('svg[aria-label="Reel"], svg[aria-label="Clip"]')) ||
      window.location.pathname.includes("/reel/") ||
      (postUrl && postUrl.includes("/reel/")) ||
      Boolean(shortcode && knownTranscripts.has(shortcode));

    let postType = "photo";
    if (isCarousel) {
      postType = "carousel";
    } else if (hasVideo) {
      postType = "video";
    } else {
      postType = "photo";
    }

    const timeEl = article.querySelector("time");
    const timestampIso = timeEl ? timeEl.getAttribute("datetime") : null;
    const timestampRelative = timeEl ? timeEl.textContent.trim() : null;

    let likesCount = null;
    let likesText = null;

    // 1. Check all liked_by links (often first link has avatars, second has "16K others")
    const likesLinks = article.querySelectorAll('a[href*="/liked_by/"]');
    for (const link of likesLinks) {
      const txt = link.textContent.trim();
      if (!txt) continue;
      const parsed = parseCount(txt);
      if (parsed !== null) {
        likesCount = parsed;
        likesText = txt;
        break;
      }
    }

    // 2. Check for parent container with "Liked by" and "others"
    if (likesCount === null) {
      const candidateElements = article.querySelectorAll("section, div, span");
      for (const el of candidateElements) {
        const text = el.textContent.trim();
        if (/^Liked by\s+/i.test(text) && text.includes("others")) {
          likesText = text;
          const matchOthers = text.match(/([0-9]+[0-9.,]*\s*[KkMmBbgG]?)\s+others/i);
          if (matchOthers) {
            const baseCount = parseCount(matchOthers[1]);
            if (baseCount !== null) {
              // Add 1 for the named user shown before 'others' (e.g. "Liked by user and 16K others")
              likesCount = baseCount + 1;
            }
          }
          break;
        }
      }
    }

    // 3. Fallback: Search for "X likes"
    if (likesCount === null) {
      const elements = article.querySelectorAll("span, a, button");
      for (const el of elements) {
        const text = el.textContent.trim();
        const m = text.match(/^([0-9]+[0-9.,]*\s*[KkMmBbgG]?)\s+likes?$/i);
        if (m) {
          likesText = text;
          likesCount = parseCount(m[1]);
          break;
        }
      }
    }

    // 4. Fallback for video / reel view count: "X views" or "X plays"
    if (likesCount === null) {
      const elements = article.querySelectorAll("span, a, button");
      for (const el of elements) {
        const text = el.textContent.trim();
        const m = text.match(/^([0-9]+[0-9.,]*\s*[KkMmBbgG]?)\s+(?:views|plays)$/i);
        if (m) {
          likesText = text;
          likesCount = parseCount(m[1]);
          break;
        }
      }
    }

    // Comments count
    let commentsCount = null;
    let commentsText = null;
    const commentsLink = article.querySelector('a[href*="/comments/"]');
    if (commentsLink) {
      commentsText = commentsLink.textContent.trim();
      commentsCount = parseCount(commentsText);
    } else {
      const viewCommentsEls = article.querySelectorAll("span, a, div");
      for (const el of viewCommentsEls) {
        const text = el.textContent.trim();
        const m = text.match(/View all ([0-9]+[0-9.,]*\s*[KkMmBbgG]?)\s+comments?/i);
        if (m) {
          commentsText = text;
          commentsCount = parseCount(m[1]);
          break;
        }
      }
    }

    return {
      shortcode: shortcode,
      url: postUrl,
      postType: postType,
      transcript: (shortcode && knownTranscripts.get(shortcode)) || null,
      author: {
        username: authorUsername,
        profileUrl: authorProfileUrl,
        avatarUrl: authorAvatarUrl,
      },
      content: {
        caption: caption,
        hashtags: hashtags,
        mentions: mentions,
      },
      media: {
        count: mediaItems.length,
        thumbnailUrl:
          reelThumbnail ||
          (mediaItems[0] ? mediaItems[0].poster || mediaItems[0].url : null),
        items: mediaItems,
      },
      engagement: {
        likes: likesCount,
        likesText: likesText,
        comments: commentsCount,
        commentsText: commentsText,
      },
      timestamp: {
        iso: timestampIso,
        relative: timestampRelative,
      },
      extractedAt: new Date().toISOString(),
    };
  }

  /**
   * 1. Manual Single Post Copy Button & Transcript Button in Bottom Action Bar
   * (Positioned to the right of Like, Comment, and Share)
   */
  /**
   * Helper to create the Transcript mic icon button
   */
  function createTranscriptButton(container, data) {
    const shortcode = data ? data.shortcode : null;
    const transcriptBtn = document.createElement("button");
    transcriptBtn.className = `${ACTION_ICON_BTN_CLASS} ${TRANSCRIPT_BTN_CLASS} ig-action-transcript-btn`;
    transcriptBtn.setAttribute("type", "button");
    transcriptBtn.setAttribute("title", "Reel Audio Transcript");
    transcriptBtn.setAttribute("aria-label", "Reel Audio Transcript");
    transcriptBtn.innerHTML = ICONS.micAction;

    if (shortcode && knownTranscripts.has(shortcode)) {
      transcriptBtn.classList.add("has-transcript");
    }

    const existingPanel =
      container.querySelector(`#${TRANSCRIPT_PANEL_ID}`) ||
      document.querySelector(`#${TRANSCRIPT_PANEL_ID}`);
    if (existingPanel) {
      transcriptBtn.classList.add("active");
    }

    transcriptBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleTranscriptPanel(container, transcriptBtn);
    });

    return transcriptBtn;
  }

  /**
   * 1. Manual Single Post Copy Button & Transcript Button in Bottom Action Bar
   * (Positioned to the right of Like, Comment, and Share)
   */
  function embedActionButtons(container) {
    if (isBatchRunning) return;
    if (!container) return;

    // Check if action group already exists in this container
    const existingGroup = container.querySelector(`.${ACTION_BAR_GROUP_CLASS}`);
    if (existingGroup) {
      const data = extractPostData(container);
      const isVideo = data && data.postType === "video";
      const hasTranscriptBtn = Boolean(
        existingGroup.querySelector(".ig-action-transcript-btn")
      );

      if (isVideo && !hasTranscriptBtn) {
        // Video post detected after initial mount: Add transcript button!
        const transcriptBtn = createTranscriptButton(container, data);
        existingGroup.insertBefore(transcriptBtn, existingGroup.firstChild);
      } else if (!isVideo && hasTranscriptBtn) {
        existingGroup.querySelector(".ig-action-transcript-btn")?.remove();
      }

      if (data && data.shortcode && knownTranscripts.has(data.shortcode)) {
        existingGroup
          .querySelector(".ig-action-transcript-btn")
          ?.classList.add("has-transcript");
      }
      return;
    }

    // Clean up any legacy header buttons or mislocated panels
    const staleHeaderBtns = container.querySelectorAll(
      `.${ACTIONS_CONTAINER_CLASS}, .${HEADER_BTN_CLASS}:not(.${ACTION_ICON_BTN_CLASS})`
    );
    staleHeaderBtns.forEach((el) => el.remove());

    const staleHeaderPanels = document.querySelectorAll(
      `header #${TRANSCRIPT_PANEL_ID}, div[class*="xyinxu5"] #${TRANSCRIPT_PANEL_ID}`
    );
    staleHeaderPanels.forEach((p) => p.remove());

    // Locate the anchor button in the action bar (Share, Repost, Comment, or Like)
    const anchorBtn =
      container.querySelector('svg[aria-label="Share"], svg[aria-label="Share Post"]')?.closest('button, [role="button"]') ||
      container.querySelector('svg[aria-label="Repost"]')?.closest('button, [role="button"]') ||
      container.querySelector('svg[aria-label="Comment"]')?.closest('button, [role="button"]') ||
      container.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"]')?.closest('button, [role="button"]') ||
      document.querySelector('div[role="dialog"] svg[aria-label="Share"], div[role="dialog"] svg[aria-label="Share Post"]')?.closest('button, [role="button"]') ||
      document.querySelector('main svg[aria-label="Share"], main svg[aria-label="Share Post"]')?.closest('button, [role="button"]');

    if (!anchorBtn) return;

    const data = extractPostData(container);
    const shortcode = data ? data.shortcode : null;

    const actionGroup = document.createElement("div");
    actionGroup.className = ACTION_BAR_GROUP_CLASS;

    // A) Transcript Icon Button (ONLY ON REELS / VIDEOS)
    if (data && data.postType === "video") {
      const transcriptBtn = createTranscriptButton(container, data);
      actionGroup.appendChild(transcriptBtn);
    }

    // B) Copy JSON Icon Button
    const copyBtn = document.createElement("button");
    copyBtn.className = `${ACTION_ICON_BTN_CLASS} ig-action-copy-btn`;
    copyBtn.setAttribute("type", "button");
    copyBtn.setAttribute("title", "Copy Post JSON");
    copyBtn.setAttribute("aria-label", "Copy Post JSON");
    copyBtn.innerHTML = ICONS.copyAction;

    copyBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const currentData = extractPostData(container);
      if (!currentData) return;

      if (currentData.shortcode && knownTranscripts.has(currentData.shortcode)) {
        currentData.transcript = knownTranscripts.get(currentData.shortcode);
      }

      try {
        await navigator.clipboard.writeText(JSON.stringify(currentData, null, 2));
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = ICONS.checkAction;
        copyBtn.setAttribute("title", "Copied to clipboard!");

        // Sync single post to extension storage for Side Panel preview
        try {
          chrome.storage.local.get("last_scraped_batch", (res) => {
            let batch = res?.last_scraped_batch;
            if (!batch || !Array.isArray(batch.posts)) {
              batch = {
                profile: currentData.author?.username || "instagram_post",
                scrapedAt: new Date().toISOString(),
                totalPosts: 1,
                posts: [currentData],
              };
            } else {
              const idx = batch.posts.findIndex((p) => p.shortcode === currentData.shortcode);
              if (idx >= 0) {
                batch.posts[idx] = currentData;
              } else {
                batch.posts.unshift(currentData);
                batch.totalPosts = batch.posts.length;
              }
            }
            chrome.storage.local.set({ last_scraped_batch: batch });
            chrome.runtime.sendMessage({ action: "batch_scraped", data: batch }).catch(() => {});
          });
        } catch (e) {}

        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = ICONS.copyAction;
          copyBtn.setAttribute("title", "Copy Post JSON");
        }, 2000);
      } catch (err) {
        console.error("[IG Grabber] Clipboard copy failed:", err);
      }
    });

    actionGroup.appendChild(copyBtn);

    const mountTarget =
      anchorBtn.parentElement && anchorBtn.parentElement.tagName === "SPAN"
        ? anchorBtn.parentElement
        : anchorBtn;

    mountTarget.insertAdjacentElement("afterend", actionGroup);
  }

  // Alias for backward compatibility
  function embedHeaderButton(article) {
    embedActionButtons(article);
  }

  /**
   * Locate the caption/comments container where the transcript panel should overlay
   */
  function findCaptionPanel(container, transcriptBtn) {
    // 1. Modal View: In Instagram dialog, the right-hand column has <header>,
    // followed immediately by the scrollable middle comments/caption container.
    const dialog =
      container?.closest('div[role="dialog"]') ||
      document.querySelector('div[role="dialog"]');

    if (dialog) {
      const modalHeader = dialog.querySelector("header");
      if (modalHeader && modalHeader.nextElementSibling) {
        const next = modalHeader.nextElementSibling;
        if (!next.matches("header") && !next.querySelector("header")) {
          return next;
        }
      }

      const modalCommentsUl =
        dialog.querySelector("ul._a9z6") ||
        dialog.querySelector("ul._a9za") ||
        dialog.querySelector("ul");
      if (modalCommentsUl) {
        const p =
          modalCommentsUl.closest("div.x78zum5.xdt5ytf") ||
          modalCommentsUl.parentElement;
        if (p && !p.matches("header") && !p.querySelector("header")) {
          return p;
        }
      }
    }

    // 2. Standalone Page View: locate the middle container next to header or div.xw2csxc
    const standaloneHeader =
      document.querySelector("main header") ||
      container?.querySelector("header");
    if (standaloneHeader && standaloneHeader.nextElementSibling) {
      const next = standaloneHeader.nextElementSibling;
      if (
        !next.matches("header") &&
        !next.querySelector("header") &&
        !next.querySelector('svg[aria-label="Like"], svg[aria-label="Comment"]')
      ) {
        return next;
      }
    }

    const standaloneMiddle =
      document.querySelector("main div.xw2csxc") ||
      document.querySelector("main div.x5yr21d.xw2csxc") ||
      container?.querySelector("div.xw2csxc") ||
      document.querySelector("div.xw2csxc");
    if (standaloneMiddle && !standaloneMiddle.matches("header") && !standaloneMiddle.querySelector("header")) {
      return standaloneMiddle;
    }

    // 3. Fallback: Sibling above the bottom action bar section
    if (transcriptBtn) {
      const actionSection =
        transcriptBtn.closest("section") ||
        transcriptBtn.closest("div.x1yvgwvq") ||
        transcriptBtn.closest("div[class*='x1yvgwvq']") ||
        transcriptBtn.parentElement?.parentElement?.parentElement;

      if (actionSection && actionSection.previousElementSibling) {
        const prev = actionSection.previousElementSibling;
        if (!prev.matches("header") && !prev.querySelector("header")) {
          return prev;
        }
      }
    }

    return null;
  }

  /**
   * Toggle transcript panel (fills the caption & comments panel)
   */
  function toggleTranscriptPanel(article, transcriptBtn) {
    const existing =
      article.querySelector(`#${TRANSCRIPT_PANEL_ID}`) ||
      document.querySelector(`#${TRANSCRIPT_PANEL_ID}`);
    if (existing) {
      existing.remove();
      transcriptBtn.classList.remove("active");
      return;
    }

    // Clean up any rogue transcript panels stuck in headers
    document
      .querySelectorAll(
        `header #${TRANSCRIPT_PANEL_ID}, div[class*="xyinxu5"] #${TRANSCRIPT_PANEL_ID}`
      )
      .forEach((p) => p.remove());

    const postData = extractPostData(article);
    if (!postData || postData.postType !== "video") return;

    const captionPanel = findCaptionPanel(article, transcriptBtn);
    if (!captionPanel) {
      console.warn("[IG Grabber] Could not find caption panel container for transcript");
      return;
    }

    captionPanel.style.position = "relative";
    captionPanel.scrollTop = 0;

    const panel = document.createElement("div");
    panel.id = TRANSCRIPT_PANEL_ID;
    panel.className = "ig-post-transcript-panel";

    renderTranscriptPanelContent(panel, postData, article, transcriptBtn);
    captionPanel.appendChild(panel);
    transcriptBtn.classList.add("active");
  }

  /**
   * Render internal content of the transcript panel
   */
  function renderTranscriptPanelContent(panel, postData, article, transcriptBtn) {
    panel.innerHTML = "";

    const shortcode = postData.shortcode;
    const transcript = knownTranscripts.get(shortcode);

    // 1. Header Bar
    const headerEl = document.createElement("div");
    headerEl.className = "ig-ptp-header";

    const titleEl = document.createElement("div");
    titleEl.className = "ig-ptp-title";
    titleEl.innerHTML = `${ICONS.mic}<span>Reel Audio Transcript</span>`;

    const actionsEl = document.createElement("div");
    actionsEl.className = "ig-ptp-actions";

    if (transcript) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "ig-ptp-btn-copy";
      copyBtn.setAttribute("type", "button");
      copyBtn.setAttribute("title", "Copy Transcript text");
      copyBtn.innerHTML = `${ICONS.copy}<span>Copy</span>`;

      copyBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        try {
          await navigator.clipboard.writeText(transcript);
          copyBtn.innerHTML = `${ICONS.check}<span>Copied!</span>`;
          copyBtn.classList.add("copied");
          setTimeout(() => {
            copyBtn.innerHTML = `${ICONS.copy}<span>Copy</span>`;
            copyBtn.classList.remove("copied");
          }, 2000);
        } catch (err) {
          console.error("[IG Grabber] Failed to copy transcript:", err);
        }
      });
      actionsEl.appendChild(copyBtn);
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "ig-ptp-btn-close";
    closeBtn.setAttribute("type", "button");
    closeBtn.setAttribute("title", "Close Panel");
    closeBtn.innerHTML = ICONS.close;
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      panel.remove();
      transcriptBtn.classList.remove("active");
    });
    actionsEl.appendChild(closeBtn);

    headerEl.appendChild(titleEl);
    headerEl.appendChild(actionsEl);
    panel.appendChild(headerEl);

    // 2. Body
    const bodyEl = document.createElement("div");
    bodyEl.className = "ig-ptp-body";

    if (transcript) {
      const textEl = document.createElement("div");
      textEl.className = "ig-ptp-text";

      const paragraphs = transcript.split(/\n\s*\n|\n/).filter(Boolean);
      if (paragraphs.length > 0) {
        paragraphs.forEach((para) => {
          const p = document.createElement("p");
          p.textContent = para.trim();
          textEl.appendChild(p);
        });
      } else {
        const p = document.createElement("p");
        p.textContent = transcript;
        textEl.appendChild(p);
      }
      bodyEl.appendChild(textEl);

      const metaBar = document.createElement("div");
      metaBar.className = "ig-ptp-meta-bar";
      const words = transcript.trim().split(/\s+/).filter(Boolean).length;
      metaBar.textContent = `${words} words · ${transcript.length} chars · Whisper AI`;
      bodyEl.appendChild(metaBar);
    } else if (postData.postType !== "video") {
      const emptyBox = document.createElement("div");
      emptyBox.className = "ig-ptp-empty";
      emptyBox.innerHTML = `
        <div class="ig-ptp-empty-icon">📷</div>
        <div class="ig-ptp-empty-title">Image / Carousel Post</div>
        <div class="ig-ptp-empty-desc">This post is not a video and does not contain an audio track to transcribe.</div>
      `;
      bodyEl.appendChild(emptyBox);
    } else {
      const emptyBox = document.createElement("div");
      emptyBox.className = "ig-ptp-empty";
      emptyBox.innerHTML = `
        <div class="ig-ptp-empty-icon">${ICONS.mic}</div>
        <div class="ig-ptp-empty-title">No Transcript Yet</div>
        <div class="ig-ptp-empty-desc">Spoken words in this reel have not been transcribed yet. Transcribe now using AI speech-to-text.</div>
      `;

      const transcribeBtn = document.createElement("button");
      transcribeBtn.className = "ig-ptp-action-btn";
      transcribeBtn.setAttribute("type", "button");
      transcribeBtn.innerHTML = `${ICONS.bolt}<span>Transcribe Reel Audio</span>`;

      transcribeBtn.addEventListener("click", () => {
        bodyEl.innerHTML = `
          <div class="ig-ptp-loading">
            <div class="ig-ptp-spinner"></div>
            <div class="ig-ptp-loading-title">Transcribing Audio...</div>
            <div class="ig-ptp-loading-desc">Extracting audio & running Whisper AI.<br>This usually takes 5 to 15 seconds.</div>
          </div>
        `;

        chrome.runtime.sendMessage(
          {
            action: "transcribe_reel",
            url: postData.url || window.location.href,
            shortcode: shortcode,
          },
          (resp) => {
            if (resp && resp.success && resp.transcript) {
              knownTranscripts.set(shortcode, resp.transcript);
              transcriptBtn.classList.add("has-transcript");
              renderTranscriptPanelContent(panel, postData, article, transcriptBtn);
            } else {
              bodyEl.innerHTML = `
                <div class="ig-ptp-empty">
                  <div class="ig-ptp-empty-title" style="color: #ef4444;">Transcription Failed</div>
                  <div class="ig-ptp-empty-desc">${resp?.error || "Unable to transcribe this reel. Please try again."}</div>
                </div>
              `;
              const retryBtn = document.createElement("button");
              retryBtn.className = "ig-ptp-action-btn";
              retryBtn.setAttribute("type", "button");
              retryBtn.innerHTML = `<span>Retry</span>`;
              retryBtn.addEventListener("click", () => {
                renderTranscriptPanelContent(panel, postData, article, transcriptBtn);
              });
              bodyEl.querySelector(".ig-ptp-empty").appendChild(retryBtn);
            }
          }
        );
      });

      emptyBox.appendChild(transcribeBtn);
      bodyEl.appendChild(emptyBox);
    }

    panel.appendChild(bodyEl);
  }

  /**
   * Helper: Trigger file download
   */
  function downloadJsonFile(jsonData, filename) {
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * 2. Live Scraping UI (Mounted on document.body so React NEVER unmounts it)
   */
  function updateLiveScrapingUI(current, total, shortcode) {
    // 0. Transparent click-shield to prevent accidental clicks closing Instagram's modal
    let blocker = document.getElementById(BLOCKER_OVERLAY_ID);
    if (!blocker) {
      blocker = document.createElement("div");
      blocker.id = BLOCKER_OVERLAY_ID;
      const intercept = (e) => {
        e.preventDefault();
        e.stopPropagation();
      };
      blocker.addEventListener("click", intercept, true);
      blocker.addEventListener("mousedown", intercept, true);
      blocker.addEventListener("pointerdown", intercept, true);
      document.body.appendChild(blocker);
    }

    // A. Pinned top progress line
    let line = document.getElementById(PROGRESS_LINE_ID);
    if (!line) {
      line = document.createElement("div");
      line.id = PROGRESS_LINE_ID;
      document.body.appendChild(line);
    }
    const pct = Math.round((current / total) * 100);
    line.style.width = `${pct}%`;

    // B. Floating top-center HUD pill
    let hud = document.getElementById(LIVE_HUD_ID);
    if (!hud) {
      hud = document.createElement("div");
      hud.id = LIVE_HUD_ID;
      hud.innerHTML = `
        <span class="ig-live-pulse-dot"></span>
        <span class="ig-live-text" id="ig-live-text">Starting auto grab...</span>
        <button class="ig-live-stop-btn" id="ig-live-stop" type="button">⏹ Stop</button>
      `;

      hud.querySelector("#ig-live-stop").addEventListener("click", (e) => {
        e.stopPropagation();
        cancelRequested = true;
        const text = hud.querySelector("#ig-live-text");
        if (text) text.innerHTML = "Stopping after current post...";
      });

      document.body.appendChild(hud);
    }

    const textEl = hud.querySelector("#ig-live-text");
    if (textEl) {
      const codeLabel = shortcode ? ` [${shortcode}]` : "";
      textEl.innerHTML = `Scraping: <b style="color:#fff;">${current}</b> of <b style="color:#fff;">${total}</b>${codeLabel}`;
    }
  }

  function removeLiveScrapingUI() {
    const blocker = document.getElementById(BLOCKER_OVERLAY_ID);
    if (blocker) blocker.remove();

    const line = document.getElementById(PROGRESS_LINE_ID);
    if (line) line.remove();

    const hud = document.getElementById(LIVE_HUD_ID);
    if (hud) hud.remove();
  }

  /**
   * 3. Summary Modal Display (Shown upon Completion)
   */
  function showSummaryModal(payload) {
    const existing = document.getElementById(SUMMARY_MODAL_ID);
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = SUMMARY_MODAL_ID;
    overlay.className = "ig-modal-overlay";

    const totalPosts = payload.posts.length;
    let totalLikes = 0;
    let photoCount = 0;
    let videoCount = 0;
    let carouselCount = 0;
    const allHashtags = [];

    payload.posts.forEach((p) => {
      if (p.engagement.likes) totalLikes += p.engagement.likes;
      if (p.postType === "video") videoCount++;
      else if (p.postType === "carousel") carouselCount++;
      else photoCount++;

      if (p.content.hashtags) allHashtags.push(...p.content.hashtags);
    });

    const uniqueTags = Array.from(new Set(allHashtags));
    const topTagsDisplay = uniqueTags.length > 0 ? uniqueTags.slice(0, 4).join(" ") : "None";

    overlay.innerHTML = `
      <div class="ig-modal-card">
        <div class="ig-modal-header">
          <div class="ig-modal-header-title">
            <span style="color:#10b981;">${ICONS.check}</span>
            <span>Scraping Complete!</span>
          </div>
          <button class="ig-modal-close-btn" id="ig-summary-close" title="Close">✕</button>
        </div>

        <div class="ig-summary-grid">
          <div class="ig-summary-card">
            <span class="ig-summary-card-label">Posts Scraped</span>
            <span class="ig-summary-card-value">${totalPosts}</span>
          </div>
          <div class="ig-summary-card">
            <span class="ig-summary-card-label">Total Likes</span>
            <span class="ig-summary-card-value">${totalLikes.toLocaleString()}</span>
          </div>
          <div class="ig-summary-card">
            <span class="ig-summary-card-label">Photos / Carousels</span>
            <span class="ig-summary-card-value">${photoCount + carouselCount}</span>
          </div>
          <div class="ig-summary-card">
            <span class="ig-summary-card-label">Reels / Videos</span>
            <span class="ig-summary-card-value">${videoCount}</span>
          </div>
        </div>

        <div class="ig-summary-tags">
          <span class="ig-summary-card-label">Sample Hashtags</span>
          <div class="ig-summary-tags-content" title="${uniqueTags.join(" ")}">${topTagsDisplay}</div>
        </div>

        <div class="ig-summary-actions">
          <button class="ig-summary-btn-sidepanel" id="ig-summary-sidepanel" type="button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
            <span>View in Side Panel</span>
          </button>
          <button class="ig-summary-btn-copy" id="ig-summary-copy" type="button">
            ${ICONS.copy} <span>Copy Full JSON (${totalPosts} Posts)</span>
          </button>
          <button class="ig-summary-btn-download" id="ig-summary-download" type="button">
            ${ICONS.download} <span>Download JSON File</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector("#ig-summary-close");
    const sidepanelBtn = overlay.querySelector("#ig-summary-sidepanel");
    const copyBtn = overlay.querySelector("#ig-summary-copy");
    const downloadBtn = overlay.querySelector("#ig-summary-download");

    function closeModal() {
      overlay.remove();
      const art = document.querySelector('div[role="dialog"] article');
      if (art) embedHeaderButton(art);
    }

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    if (sidepanelBtn) {
      sidepanelBtn.addEventListener("click", () => {
        try {
          chrome.runtime.sendMessage({ action: "open_side_panel" });
          closeModal();
        } catch (err) {
          console.warn("[IG Grabber] Failed to request side panel:", err);
        }
      });
    }

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
        copyBtn.classList.add("copied");
        copyBtn.innerHTML = `${ICONS.check} <span>✓ Copied to Clipboard!</span>`;
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.innerHTML = `${ICONS.copy} <span>Copy Full JSON (${totalPosts} Posts)</span>`;
        }, 2200);
      } catch (err) {
        console.error("[IG Grabber] Clipboard copy failed:", err);
      }
    });

    downloadBtn.addEventListener("click", () => {
      const filename = `instagram_${payload.profile}_${totalPosts}_posts.json`;
      downloadJsonFile(payload, filename);
    });
  }

  /**
   * 4. Batch Auto-Grabber Engine
   */
  async function runBatchScraper(targetCount, delayMs) {
    isBatchRunning = true;
    cancelRequested = false;

    const collectedPosts = [];
    const seenShortcodes = new Set();
    const username = getProfileUsername();

    updateLiveScrapingUI(0, targetCount, "");

    // Step A: Ensure a post modal is open
    let dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) {
      const firstThumbnail = document.querySelector('main a[href*="/p/"], main a[href*="/reel/"]');
      if (!firstThumbnail) {
        alert("No posts found on this page to scrape.");
        isBatchRunning = false;
        removeLiveScrapingUI();
        return;
      }

      firstThumbnail.click();
      const opened = await waitFor(() => document.querySelector('div[role="dialog"] article'), 5000);
      if (!opened) {
        isBatchRunning = false;
        removeLiveScrapingUI();
        return;
      }
      await sleep(350);
    }

    // Step B: Loop through posts using "Next"
    while (collectedPosts.length < targetCount && !cancelRequested) {
      dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) break;

      const article = dialog.querySelector("article");
      const postData = extractPostData(article);

      if (postData && postData.shortcode && !seenShortcodes.has(postData.shortcode)) {
        seenShortcodes.add(postData.shortcode);
        collectedPosts.push(postData);

        // Update fixed HUD on screen
        updateLiveScrapingUI(collectedPosts.length, targetCount, postData.shortcode);

        if (collectedPosts.length >= targetCount) {
          break;
        }
      }

      if (cancelRequested) break;

      const nextBtn = dialog.querySelector('svg[aria-label="Next"]')?.closest('button, [role="button"]');
      if (!nextBtn) break; // Reached end of profile

      const currentShortcode = postData?.shortcode;
      nextBtn.click();

      // Wait for next post to mount into DOM
      await waitFor(() => {
        const curArt = document.querySelector('div[role="dialog"] article');
        const curData = extractPostData(curArt);
        return curData && curData.shortcode && curData.shortcode !== currentShortcode;
      }, 4000);

      // Safe pause
      await sleep(delayMs);
    }

    // Step C: Cleanup Live HUD & show Summary Modal
    isBatchRunning = false;
    removeLiveScrapingUI();

    if (collectedPosts.length > 0) {
      const fullPayload = {
        profile: username,
        scrapedAt: new Date().toISOString(),
        totalPosts: collectedPosts.length,
        posts: collectedPosts,
      };

      // Save to chrome.storage.local, broadcast to side panel, and auto-open side panel
      try {
        chrome.storage.local.set({ last_scraped_batch: fullPayload });
        chrome.runtime.sendMessage({ action: "batch_scraped", data: fullPayload });
        chrome.runtime.sendMessage({ action: "open_side_panel" });
      } catch (err) {
        console.warn("[GramScribe] Storage save warning:", err);
      }
    }
  }

  /**
   * 5. Start Modal (Config & Launch)
   */
  function openStartModal() {
    let overlay = document.getElementById(START_MODAL_ID);
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = START_MODAL_ID;
    overlay.className = "ig-modal-overlay";

    overlay.innerHTML = `
      <div class="ig-modal-card">
        <div class="ig-modal-header">
          <div class="ig-modal-header-title">
            <span style="color:#0095f6;">${ICONS.bolt}</span>
            <span>Auto Grab Posts</span>
          </div>
          <button class="ig-modal-close-btn" id="ig-start-close" title="Close">✕</button>
        </div>
        <div class="ig-modal-body">
          <div class="ig-modal-row">
            <label for="ig-modal-count">Posts to grab:</label>
            <input type="number" id="ig-modal-count" value="5" min="1" max="100" />
          </div>
          <div class="ig-modal-row">
            <label for="ig-modal-delay">Delay per post:</label>
            <select id="ig-modal-delay">
              <option value="300">0.3s (Turbo)</option>
              <option value="500" selected>0.5s (Fast)</option>
              <option value="800">0.8s (Balanced)</option>
              <option value="1200">1.2s (Safe)</option>
            </select>
          </div>
          <button class="ig-modal-btn-start" id="ig-start-btn" type="button">▶ Start Auto Grab</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector("#ig-start-close");
    const startBtn = overlay.querySelector("#ig-start-btn");
    const countInput = overlay.querySelector("#ig-modal-count");
    const delaySelect = overlay.querySelector("#ig-modal-delay");

    function closeModal() {
      overlay.remove();
    }

    closeBtn.addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });

    startBtn.addEventListener("click", () => {
      const count = parseInt(countInput.value, 10) || 5;
      const delay = parseInt(delaySelect.value, 10) || 500;

      // Close start modal immediately so user sees post UI & live HUD
      closeModal();

      // Launch batch scraper
      runBatchScraper(count, delay);
    });
  }

  /**
   * 6. Embed Profile Icon Trigger Button (Exact match with Similar accounts)
   */
  function embedProfileTriggerButton() {
    // Only embed on profile pages with post grids
    const isProfilePage = Boolean(
      document.querySelector("header h2") ||
      document.querySelector("header section h1") ||
      document.querySelector("header section h2")
    );
    const hasGrid = Boolean(
      document.querySelector('main a[href*="/p/"], main a[href*="/reel/"]')
    );

    if (!isProfilePage || !hasGrid) {
      const existing = document.querySelector(`.${TRIGGER_BTN_CLASS}`);
      if (existing) existing.remove();
      return;
    }

    if (document.querySelector(`.${TRIGGER_BTN_CLASS}`)) return;

    const header = document.querySelector("header");
    if (!header) return;

    const similarBtn = header.querySelector('svg[aria-label="Similar accounts"]')?.closest('[role="button"]');

    let container = null;
    let insertAfterElement = null;

    if (similarBtn) {
      insertAfterElement = similarBtn.parentElement || similarBtn;
      container = insertAfterElement.parentElement;
    } else {
      const allButtons = Array.from(header.querySelectorAll('button, div[role="button"]'));
      const actionBtn = allButtons.find((b) =>
        /^(Follow|Following|Message|Edit profile)$/i.test(b.textContent.trim())
      );
      if (actionBtn) {
        insertAfterElement = actionBtn.parentElement || actionBtn;
        container = insertAfterElement.parentElement;
      }
    }

    if (!container) return;

    const triggerBtn = document.createElement("button");
    triggerBtn.className = TRIGGER_BTN_CLASS;
    triggerBtn.setAttribute("type", "button");
    triggerBtn.setAttribute("title", "Auto Grab Posts");
    triggerBtn.setAttribute("aria-label", "Auto Grab Posts");
    triggerBtn.innerHTML = ICONS.bolt;

    // Dynamically copy exact computed dimensions and background from similar accounts button
    if (similarBtn) {
      try {
        const comp = window.getComputedStyle(similarBtn);
        if (comp.height) triggerBtn.style.height = comp.height;
        if (comp.width) triggerBtn.style.width = comp.width;
        if (comp.borderRadius) triggerBtn.style.borderRadius = comp.borderRadius;
        if (comp.backgroundColor && comp.backgroundColor !== "rgba(0, 0, 0, 0)") {
          triggerBtn.style.backgroundColor = comp.backgroundColor;
        }
      } catch (e) {}
    }

    triggerBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openStartModal();
    });

    if (insertAfterElement && insertAfterElement.nextSibling) {
      container.insertBefore(triggerBtn, insertAfterElement.nextSibling);
    } else {
      container.appendChild(triggerBtn);
    }
  }

  /**
   * Expand width of caption box and post container on standalone post & reel pages
   */
  function adjustStandalonePageWidth() {
    if (document.querySelector('div[role="dialog"]')) return;
    const isPostPage = /\/(?:p|reel|reels)\/[a-zA-Z0-9_\-]+/.test(
      window.location.pathname
    );
    if (!isPostPage) return;

    const maxWidthContainer = document.querySelector(
      'main div[style*="--x-maxWidth"]'
    );
    if (maxWidthContainer) {
      maxWidthContainer.style.setProperty(
        "--x-maxWidth",
        "min(100%, 820px)",
        "important"
      );
      maxWidthContainer.style.setProperty("max-width", "820px", "important");
    }

    const rightCols = document.querySelectorAll(
      'main .x4h1yfo, main [style*="--media-info"]'
    );
    rightCols.forEach((el) => {
      el.style.setProperty("width", "420px", "important");
      el.style.setProperty("min-width", "420px", "important");
      el.style.setProperty("--media-info", "420px", "important");
    });
  }

  /**
   * Observer check with debouncing to prevent any mutation loops
   */
  function checkAndAttach() {
    adjustStandalonePageWidth();

    const dialog = document.querySelector('div[role="dialog"]');
    if (dialog) {
      const article = dialog.querySelector("article") || dialog;
      if (article) {
        embedActionButtons(article);
      }
    } else {
      const isPostPage = /\/(?:p|reel|reels)\/[a-zA-Z0-9_\-]+/.test(
        window.location.pathname
      );
      if (isPostPage) {
        const postArticle = document.querySelector("main article, article, main");
        if (postArticle) {
          embedActionButtons(postArticle);
        }
      }
    }

    embedProfileTriggerButton();
  }

  let attachDebounceTimer = null;
  const observer = new MutationObserver(() => {
    if (attachDebounceTimer) return;
    attachDebounceTimer = requestAnimationFrame(() => {
      attachDebounceTimer = null;
      checkAndAttach();
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Listen for messages from background or side panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 1. External transcript update (e.g. triggered from Side Panel)
    if (message.action === "transcript_updated" && message.shortcode) {
      knownTranscripts.set(message.shortcode, message.transcript);

      const dialogArticle =
        document.querySelector('div[role="dialog"] article') ||
        document.querySelector("main article, article, main");

      if (dialogArticle) {
        const curData = extractPostData(dialogArticle);
        if (curData && curData.shortcode === message.shortcode) {
          const tBtn = dialogArticle.querySelector(`.${TRANSCRIPT_BTN_CLASS}`);
          if (tBtn) tBtn.classList.add("has-transcript");

          const panel = dialogArticle.querySelector(`#${TRANSCRIPT_PANEL_ID}`);
          if (panel) {
            renderTranscriptPanelContent(panel, curData, dialogArticle, tBtn);
          }
        }
      }
      sendResponse({ status: "ok" });
      return true;
    }

    // 2. Focus post modal from side panel card click
    if (message.action === "open_post_modal" && message.shortcode) {
      const currentDialog = document.querySelector('div[role="dialog"]');
      const curArt = currentDialog?.querySelector("article");
      const curData = curArt ? extractPostData(curArt) : null;
      if (curData && curData.shortcode === message.shortcode) {
        sendResponse({ success: true, message: "already_open" });
        return true;
      }

      // If another dialog is open, close it first
      if (currentDialog) {
        const closeBtn =
          currentDialog.querySelector('svg[aria-label="Close"]')?.closest('button, [role="button"]') ||
          document.querySelector('svg[aria-label="Close"]')?.closest('button, [role="button"]');
        if (closeBtn) closeBtn.click();
      }

      // Find thumbnail on active profile grid
      const postLink = document.querySelector(
        `a[href*="/p/${message.shortcode}/"], a[href*="/p/${message.shortcode}"], a[href*="/reel/${message.shortcode}/"], a[href*="/reel/${message.shortcode}"]`
      );

      if (postLink) {
        postLink.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          postLink.click();
        }, 120);
        sendResponse({ success: true });
      } else {
        sendResponse({
          success: false,
          reason: "not_on_page",
          url: window.location.href,
        });
      }
      return true;
    }
  });

  loadKnownTranscripts();
  checkAndAttach();
})();
