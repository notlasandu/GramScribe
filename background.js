/**
 * Background Service Worker for Instagram Post Details Grabber & Transcriber
 * Handles Chrome Side Panel API, cross-origin transcription fetch, and transcript storage.
 */

const ENDPOINT_URL = "https://audio-transcribe.replit.app/tools/transcribe-instagram/transcribe";

// Configure side panel to open when extension toolbar icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.warn("[IG Grabber Background] setPanelBehavior error:", error));

/**
 * Fetch transcript from the Replit transcription service
 */
async function fetchTranscript(reelUrl, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const formData = new FormData();
      formData.append("url", reelUrl);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 75000); // 75s timeout for Whisper

      const resp = await fetch(ENDPOINT_URL, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        if (resp.status === 429 && attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, attempt * 3000));
          continue;
        }
        return { success: false, error: `HTTP ${resp.status} ${resp.statusText}` };
      }

      const data = await resp.json();
      if (data && data.success) {
        return {
          success: true,
          transcript: (data.transcription || "").trim(),
        };
      } else {
        return {
          success: false,
          error: data?.error || "No transcript returned by service",
        };
      }
    } catch (err) {
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, attempt * 2500));
        continue;
      }
      return { success: false, error: err.name === "AbortError" ? "Request timed out" : err.message };
    }
  }
  return { success: false, error: "Failed after retries" };
}

/**
 * Save transcript into persistent storage cache & update last_scraped_batch
 */
async function storeTranscript(shortcode, transcriptText) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["ig_transcripts", "last_scraped_batch"], (res) => {
      // 1. Persistent map of shortcode -> transcript
      const transcripts = res?.ig_transcripts || {};
      transcripts[shortcode] = transcriptText;

      // 2. Also append/update in last_scraped_batch if present
      const batch = res?.last_scraped_batch;
      if (batch && Array.isArray(batch.posts)) {
        const post = batch.posts.find((p) => p.shortcode === shortcode);
        if (post) {
          post.transcript = transcriptText;
        }
      }

      chrome.storage.local.set(
        {
          ig_transcripts: transcripts,
          ...(batch ? { last_scraped_batch: batch } : {}),
        },
        () => {
          // Broadcast update to all tabs and side panels
          chrome.runtime.sendMessage({
            action: "transcript_updated",
            shortcode,
            transcript: transcriptText,
          }).catch(() => {});

          chrome.tabs.query({}, (tabs) => {
            tabs.forEach((tab) => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  action: "transcript_updated",
                  shortcode,
                  transcript: transcriptText,
                }).catch(() => {});
              }
            });
          });

          resolve();
        }
      );
    });
  });
}

// Message dispatcher
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "open_side_panel") {
    const tabId = sender.tab ? sender.tab.id : undefined;
    if (tabId) {
      chrome.sidePanel
        .open({ tabId: tabId })
        .then(() => sendResponse({ status: "success" }))
        .catch((err) => {
          console.warn("[IG Grabber Background] Failed to open side panel:", err);
          sendResponse({ status: "error", error: err.message });
        });
      return true;
    }
  }

  if (message.action === "save_scraped_batch" && message.payload) {
    chrome.storage.local.set({ last_scraped_batch: message.payload }, () => {
      sendResponse({ status: "saved" });
    });
    return true;
  }

  // Handle single reel transcription request
  if (message.action === "transcribe_reel" && message.url) {
    fetchTranscript(message.url)
      .then(async (result) => {
        if (result.success && message.shortcode) {
          await storeTranscript(message.shortcode, result.transcript);
        }
        sendResponse(result);
      })
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});
