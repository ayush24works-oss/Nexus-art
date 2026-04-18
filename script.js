"use strict";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Apna Hugging Face token yahan paste karo
const HF_TOKEN = "YOUR_HF_TOKEN_HERE";

// Best free model for thumbnails & logos
// stabilityai/stable-diffusion-xl-base-1.0 = best quality free model
const HF_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

const HF_API_URL = `https://api-inference.huggingface.co/models/${HF_MODEL}`;

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  mode: "generate",
  style: "vector",
  ratio: { w: 1024, h: 1024, label: "1:1" },
  referenceFile: null,
  referenceDataUrl: null,
  history: [],
  lastPrompt: "",
  lastUrl: "",
  lastBlob: null, // HF returns blob, not URL
  isLoading: false,
};

// ─── STYLE MODIFIERS ─────────────────────────────────────────────────────────
// Har style ke liye professional prompt engineering
const STYLE_MODIFIERS = {
  "vector":
    "flat vector logo design, minimal clean lines, solid color background, high contrast, professional branding, SVG style, sharp edges, corporate identity",
  "3d-logo":
    "3D logo render, glossy metallic finish, octane render, studio lighting, modern branding, photorealistic, dramatic shadows, premium quality",
  "gaming-thumbnail":
    "YouTube gaming thumbnail, ultra high contrast, neon glow effects, dramatic composition, esports style, vibrant saturated colors, bold typography space, cinematic",
  "vlog-thumbnail":
    "YouTube vlog thumbnail, bright cinematic lighting, high energy, expressive composition, clean negative space for text overlay, professional photography style",
  "mascot":
    "esports mascot logo, bold clean outlines, vibrant flat colors, vector illustration, dynamic aggressive pose, professional esports branding",
  "typography":
    "typography-focused logo, bold creative lettering, minimal graphic elements, clean modern layout, professional font design, negative space usage",
};

// Negative prompts — kya nahi chahiye image mein
const NEGATIVE_PROMPT =
  "blurry, low quality, watermark, text overlay, username, signature, jpeg artifacts, distorted, ugly, bad anatomy, extra limbs, duplicate, deformed, out of frame, low resolution, amateur";

// ─── DOM ──────────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const dom = {
  navGenerator: $("nav-generator"),
  navHistory: $("nav-history"),
  pageGenerator: $("page-generator"),
  pageHistory: $("page-history"),
  btnGenerate: $("btn-generate"),
  btnEdit: $("btn-edit"),
  referenceSection: $("reference-section"),
  promptLabel: $("prompt-label"),
  uploadZone: $("upload-zone"),
  fileInput: $("file-input"),
  referencePreview: $("reference-preview"),
  previewImg: $("preview-img"),
  btnReplace: $("btn-replace"),
  btnRemove: $("btn-remove"),
  promptInput: $("prompt-input"),
  styleGrid: $("style-grid"),
  ratioGroup: $("ratio-group"),
  submitBtn: $("submit-btn"),
  btnContent: $("btn-content"),
  btnLoading: $("btn-loading"),
  canvasEmpty: $("canvas-empty"),
  canvasLoading: $("canvas-loading"),
  canvasResult: $("canvas-result"),
  canvasError: $("canvas-error"),
  outputImg: $("output-img"),
  resultPrompt: $("result-prompt"),
  errorMsg: $("error-msg"),
  btnDownload: $("btn-download"),
  btnRegenerate: $("btn-regenerate"),
  btnRetry: $("btn-retry"),
  historyGrid: $("history-grid"),
  historyEmpty: $("history-empty"),
  historyCount: $("history-count"),
  lightbox: $("lightbox"),
  lightboxBackdrop: $("lightbox-backdrop"),
  lightboxImg: $("lightbox-img"),
  lightboxPrompt: $("lightbox-prompt"),
  lightboxStyle: $("lightbox-style"),
  lightboxRatio: $("lightbox-ratio"),
  lightboxDate: $("lightbox-date"),
  lightboxDownload: $("lightbox-download"),
  lightboxClose: $("lightbox-close"),
};

// ─── NAVIGATION ───────────────────────────────────────────────────────────────
function showPage(page) {
  dom.pageGenerator.classList.toggle("hidden", page !== "generator");
  dom.pageHistory.classList.toggle("hidden", page !== "history");
  dom.navGenerator.classList.toggle("active", page === "generator");
  dom.navHistory.classList.toggle("active", page === "history");
  if (page === "history") renderHistory();
}

dom.navGenerator.addEventListener("click", (e) => { e.preventDefault(); showPage("generator"); });
dom.navHistory.addEventListener("click", (e) => { e.preventDefault(); showPage("history"); });

// ─── MODE TOGGLE ──────────────────────────────────────────────────────────────
function setMode(mode) {
  state.mode = mode;
  dom.btnGenerate.classList.toggle("active", mode === "generate");
  dom.btnEdit.classList.toggle("active", mode === "edit");
  dom.referenceSection.classList.toggle("hidden", mode === "generate");
  dom.promptLabel.textContent = mode === "edit" ? "Edit Instructions" : "Design Prompt";
  dom.promptInput.placeholder =
    mode === "edit"
      ? "Transform this sketch into a premium 3D logo with gold metallic finish..."
      : "A bold gaming thumbnail for a Minecraft video, dark background, glowing title text space, dramatic lighting...";
  dom.btnContent.innerHTML =
    mode === "edit"
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> EDIT DESIGN`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> GENERATE`;
}

dom.btnGenerate.addEventListener("click", () => setMode("generate"));
dom.btnEdit.addEventListener("click", () => setMode("edit"));

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
function handleFileSelect(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("Please upload an image file."); return; }
  if (file.size > 20 * 1024 * 1024) { alert("Max file size is 20MB."); return; }
  state.referenceFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    state.referenceDataUrl = e.target.result;
    dom.previewImg.src = state.referenceDataUrl;
    dom.uploadZone.classList.add("hidden");
    dom.referencePreview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function clearReference() {
  state.referenceFile = null;
  state.referenceDataUrl = null;
  dom.previewImg.src = "";
  dom.fileInput.value = "";
  dom.referencePreview.classList.add("hidden");
  dom.uploadZone.classList.remove("hidden");
}

dom.uploadZone.addEventListener("click", () => dom.fileInput.click());
dom.fileInput.addEventListener("change", (e) => handleFileSelect(e.target.files[0]));
dom.btnReplace.addEventListener("click", () => dom.fileInput.click());
dom.btnRemove.addEventListener("click", clearReference);

dom.uploadZone.addEventListener("dragover", (e) => { e.preventDefault(); dom.uploadZone.classList.add("drag-over"); });
dom.uploadZone.addEventListener("dragleave", () => { dom.uploadZone.classList.remove("drag-over"); });
dom.uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dom.uploadZone.classList.remove("drag-over");
  handleFileSelect(e.dataTransfer.files[0]);
});

// ─── STYLE & RATIO SELECTION ──────────────────────────────────────────────────
dom.styleGrid.addEventListener("click", (e) => {
  const card = e.target.closest(".style-card");
  if (!card) return;
  dom.styleGrid.querySelectorAll(".style-card").forEach((c) => c.classList.remove("active"));
  card.classList.add("active");
  state.style = card.dataset.style;
});

dom.ratioGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".ratio-btn");
  if (!btn) return;
  dom.ratioGroup.querySelectorAll(".ratio-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  state.ratio = { w: Number(btn.dataset.w), h: Number(btn.dataset.h), label: btn.dataset.ratio };
});

// ─── CANVAS STATE ─────────────────────────────────────────────────────────────
function showCanvasState(s) {
  dom.canvasEmpty.classList.toggle("hidden", s !== "empty");
  dom.canvasLoading.classList.toggle("hidden", s !== "loading");
  dom.canvasResult.classList.toggle("hidden", s !== "result");
  dom.canvasError.classList.toggle("hidden", s !== "error");
}

showCanvasState("empty");

// ─── HUGGING FACE API CALL ────────────────────────────────────────────────────
async function generateWithHuggingFace(prompt, width, height) {
  // HF SDXL supports max 1024x1024. 16:9 ke liye crop baad mein hoga.
  // Actual supported sizes: 1024x1024, 768x1344, 1344x768, etc.
  const safeWidth = Math.min(width, 1024);
  const safeHeight = Math.min(height, 1024);

  const response = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${HF_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        negative_prompt: NEGATIVE_PROMPT,
        width: safeWidth,
        height: safeHeight,
        num_inference_steps: 30,     // Higher = better quality (max ~50)
        guidance_scale: 7.5,          // Prompt adherence (7-9 sweet spot)
        num_images_per_prompt: 1,
      },
    }),
  });

  // Model loading hone par HF 503 deta hai — retry karo
  if (response.status === 503) {
    const errData = await response.json().catch(() => ({}));
    const waitTime = errData.estimated_time || 20;
    throw new Error(`Model is loading, please retry in ~${Math.ceil(waitTime)}s`);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`API Error ${response.status}: ${errText}`);
  }

  // HF image generation returns raw image blob
  const blob = await response.blob();
  if (!blob || blob.size === 0) throw new Error("Empty response from API. Please try again.");

  return blob;
}

// ─── MAIN GENERATION ──────────────────────────────────────────────────────────
async function runGeneration() {
  const prompt = dom.promptInput.value.trim();

  // Validation
  if (!prompt) {
    dom.promptInput.focus();
    dom.promptInput.style.boxShadow = "0 0 0 3px rgba(224,48,48,0.35)";
    setTimeout(() => { dom.promptInput.style.boxShadow = ""; }, 2000);
    return;
  }
  if (state.mode === "edit" && !state.referenceFile) {
    alert("Please upload a reference image to use Edit mode.");
    return;
  }
  if (state.isLoading) return;

  state.isLoading = true;
  state.lastPrompt = prompt;
  dom.submitBtn.disabled = true;
  dom.btnContent.classList.add("hidden");
  dom.btnLoading.classList.remove("hidden");
  showCanvasState("loading");

  // Revoke old blob URL to free memory
  if (state.lastUrl && state.lastUrl.startsWith("blob:")) {
    URL.revokeObjectURL(state.lastUrl);
    state.lastUrl = "";
  }

  try {
    const styleModifier = STYLE_MODIFIERS[state.style] || "";

    // Clean prompt engineering — no hidden "youtube thumbnail" tricks
    // Bas style modifier add hoga jo user ne choose kiya
    let fullPrompt = prompt;
    if (styleModifier) fullPrompt = `${fullPrompt}, ${styleModifier}`;
    // SDXL ke liye quality booster
    fullPrompt = `${fullPrompt}, masterpiece, best quality, highly detailed, 4k`;

    // Edit mode mein reference ka mention
    if (state.mode === "edit" && state.referenceFile) {
      fullPrompt = `${fullPrompt}, inspired by the reference composition and style`;
    }

    const blob = await generateWithHuggingFace(fullPrompt, state.ratio.w, state.ratio.h);
    const objectUrl = URL.createObjectURL(blob);

    state.lastUrl = objectUrl;
    state.lastBlob = blob;

    dom.outputImg.src = objectUrl;
    dom.resultPrompt.textContent = prompt;
    showCanvasState("result");

    // History mein save karo
    // Blob URL session ke baad expire hogi, isliye base64 bhi save kar lo
    const reader = new FileReader();
    reader.onload = (e) => {
      state.history.unshift({
        url: e.target.result, // base64 for persistent storage
        prompt,
        style: state.style,
        ratio: state.ratio.label,
        date: new Date(),
      });
      saveHistory();
    };
    reader.readAsDataURL(blob);

  } catch (err) {
    dom.errorMsg.textContent = err.message || "Could not generate design. Please try again.";
    showCanvasState("error");
  } finally {
    state.isLoading = false;
    dom.submitBtn.disabled = false;
    dom.btnContent.classList.remove("hidden");
    dom.btnLoading.classList.add("hidden");
  }
}

// Event listeners for generation
dom.submitBtn.addEventListener("click", runGeneration);
dom.promptInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runGeneration();
});
dom.btnRegenerate.addEventListener("click", runGeneration);
dom.btnRetry.addEventListener("click", runGeneration);

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function downloadFromUrl(url, filename) {
  try {
    // base64 data URL
    if (url.startsWith("data:")) {
      const res = await fetch(url);
      const blob = await res.blob();
      downloadBlob(blob, filename);
      return;
    }
    // blob URL
    if (url.startsWith("blob:")) {
      const res = await fetch(url);
      const blob = await res.blob();
      downloadBlob(blob, filename);
      return;
    }
    window.open(url, "_blank");
  } catch {
    window.open(url, "_blank");
  }
}

dom.btnDownload.addEventListener("click", () => {
  if (state.lastBlob) {
    downloadBlob(state.lastBlob, `nano-apple-${Date.now()}.png`);
  } else if (state.lastUrl) {
    downloadFromUrl(state.lastUrl, `nano-apple-${Date.now()}.png`);
  }
});

// ─── HISTORY STORAGE ──────────────────────────────────────────────────────────
function saveHistory() {
  try {
    // Sirf 30 items save karo, har ek base64 heavy hoti hai
    localStorage.setItem("nano_apple_history", JSON.stringify(state.history.slice(0, 30)));
  } catch (e) {
    // localStorage full ho sakti hai base64 se — quietly fail karo
    console.warn("History save failed (storage full?):", e);
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem("nano_apple_history");
    if (raw) {
      state.history = JSON.parse(raw).map((i) => ({ ...i, date: new Date(i.date) }));
    }
  } catch {
    state.history = [];
  }
}

// ─── HISTORY RENDER ───────────────────────────────────────────────────────────
function escapeHtml(str) {
  const d = document.createElement("div");
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

function renderHistory() {
  dom.historyCount.textContent = state.history.length;
  dom.historyGrid.querySelectorAll(".history-item").forEach((el) => el.remove());

  if (state.history.length === 0) {
    dom.historyEmpty.classList.remove("hidden");
    return;
  }
  dom.historyEmpty.classList.add("hidden");

  state.history.forEach((item) => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <img src="${item.url}" alt="${escapeHtml(item.prompt)}" loading="lazy" />
      <div class="history-overlay">
        <p class="history-prompt">${escapeHtml(item.prompt)}</p>
        <div class="history-tags">
          <span class="tag tag-style">${escapeHtml(item.style)}</span>
          <span class="tag tag-ratio">${escapeHtml(item.ratio)}</span>
        </div>
      </div>`;
    div.addEventListener("click", () => openLightbox(item));
    dom.historyGrid.appendChild(div);
  });
}

// ─── LIGHTBOX ─────────────────────────────────────────────────────────────────
let lightboxCurrentItem = null;

function openLightbox(item) {
  lightboxCurrentItem = item;
  dom.lightboxImg.src = item.url;
  dom.lightboxPrompt.textContent = item.prompt;
  dom.lightboxStyle.textContent = item.style;
  dom.lightboxRatio.textContent = item.ratio;
  dom.lightboxDate.textContent =
    item.date instanceof Date
      ? item.date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
      : String(item.date);
  dom.lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  dom.lightbox.classList.add("hidden");
  document.body.style.overflow = "";
  dom.lightboxImg.src = "";
  lightboxCurrentItem = null;
}

dom.lightboxBackdrop.addEventListener("click", closeLightbox);
dom.lightboxClose.addEventListener("click", closeLightbox);
dom.lightboxDownload.addEventListener("click", () => {
  if (lightboxCurrentItem) {
    downloadFromUrl(lightboxCurrentItem.url, `nano-apple-${Date.now()}.png`);
  }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

// ─── INIT ─────────────────────────────────────────────────────────────────────
(function init() {
  loadHistory();
  dom.btnContent.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    GENERATE`;
})();