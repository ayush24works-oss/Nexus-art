"use strict";

const state = {
  mode: "generate",
  style: "vector", // Default style updated to Vector
  ratio: { w: 1024, h: 1024, label: "1:1" },
  referenceFile: null,
  referenceDataUrl: null,
  history: [],
  lastPrompt: "",
  lastUrl: "",
  isLoading: false,
};

// Updated modifiers to match Nano Apple's new niche
const STYLE_MODIFIERS = {
  "vector": "flat vector illustration, minimal, clean logo design, solid background, high contrast, svg style, corporate branding",
  "3d-logo": "3D logo, glossy finish, octane render, modern branding, highly detailed, dramatic lighting",
  "gaming-thumbnail": "youtube gaming thumbnail, high contrast, neon lighting, dramatic, esports style, vibrant colors",
  "vlog-thumbnail": "youtube vlog thumbnail, bright, cinematic lighting, engaging, high quality, expressive",
  "mascot": "esports mascot logo, bold outlines, vibrant colors, vector illustration, aggressive and dynamic",
  "typography": "typography logo, bold text layout, creative font design, minimal graphics, clean and modern",
};

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

function randomSeed() {
  return Math.floor(Math.random() * 2_000_000_000);
}

function buildPollinationsUrl(prompt, width, height) {
  const encoded = encodeURIComponent(prompt);
  const seed = randomSeed();
  return `https://image.pollinations.ai/prompt/${encoded}?seed=${seed}&width=${width}&height=${height}&model=flux&nologo=true`;
}

function showPage(page) {
  dom.pageGenerator.classList.toggle("hidden", page !== "generator");
  dom.pageHistory.classList.toggle("hidden", page !== "history");
  dom.navGenerator.classList.toggle("active", page === "generator");
  dom.navHistory.classList.toggle("active", page === "history");
  if (page === "history") renderHistory();
}

dom.navGenerator.addEventListener("click", (e) => { e.preventDefault(); showPage("generator"); });
dom.navHistory.addEventListener("click", (e) => { e.preventDefault(); showPage("history"); });

function setMode(mode) {
  state.mode = mode;
  dom.btnGenerate.classList.toggle("active", mode === "generate");
  dom.btnEdit.classList.toggle("active", mode === "edit");
  dom.referenceSection.classList.toggle("hidden", mode === "generate");
  dom.promptLabel.textContent = mode === "edit" ? "Edit Instructions" : "Design Prompt";
  dom.promptInput.placeholder = mode === "edit"
    ? "Transform this sketch into a premium 3D logo..."
    : "A sleek, minimalist logo for a tech startup called 'Vyom', metallic silver on a black background...";
  dom.btnContent.innerHTML = mode === "edit"
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg> Edit Design`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg> Design Now`;
}

dom.btnGenerate.addEventListener("click", () => setMode("generate"));
dom.btnEdit.addEventListener("click", () => setMode("edit"));

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

dom.uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dom.uploadZone.classList.add("drag-over");
});
dom.uploadZone.addEventListener("dragleave", () => {
  dom.uploadZone.classList.remove("drag-over");
});
dom.uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dom.uploadZone.classList.remove("drag-over");
  handleFileSelect(e.dataTransfer.files[0]);
});

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
  state.ratio = {
    w: Number(btn.dataset.w),
    h: Number(btn.dataset.h),
    label: btn.dataset.ratio,
  };
});

function showCanvasState(s) {
  dom.canvasEmpty.classList.toggle("hidden", s !== "empty");
  dom.canvasLoading.classList.toggle("hidden", s !== "loading");
  dom.canvasResult.classList.toggle("hidden", s !== "result");
  dom.canvasError.classList.toggle("hidden", s !== "error");
}

showCanvasState("empty");

async function runGeneration() {
  const prompt = dom.promptInput.value.trim();
  if (!prompt) {
    dom.promptInput.focus();
    dom.promptInput.style.borderColor = "rgba(239,68,68,0.6)";
    setTimeout(() => { dom.promptInput.style.borderColor = ""; }, 2000);
    return;
  }
  if (state.mode === "edit" && !state.referenceFile) {
    alert("Please upload a reference image.");
    return;
  }
  if (state.isLoading) return;

  state.isLoading = true;
  state.lastPrompt = prompt;
  dom.submitBtn.disabled = true;
  dom.btnContent.classList.add("hidden");
  dom.btnLoading.classList.remove("hidden");
  showCanvasState("loading");

  try {
    const styleModifier = STYLE_MODIFIERS[state.style] || "";
    // Secret Prompt Engineering to ensure high quality logos/thumbnails
    let fullPrompt = `Professional high quality logo or youtube thumbnail: ${prompt}`;
    
    if (state.mode === "edit" && state.referenceFile) {
      fullPrompt = `${fullPrompt}, inspired by and maintaining the composition of the reference image`;
    }
    if (styleModifier) fullPrompt = `${fullPrompt}, ${styleModifier}`;

    const url = buildPollinationsUrl(fullPrompt, state.ratio.w, state.ratio.h);
    state.lastUrl = url;

    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = resolve;
      img.onerror = () => reject(new Error("Failed to load design. Please try again."));
      img.src = url;
    });

    dom.outputImg.src = url;
    dom.resultPrompt.textContent = prompt;
    showCanvasState("result");

    state.history.unshift({
      url,
      prompt,
      style: state.style,
      ratio: state.ratio.label,
      date: new Date(),
    });
    saveHistory();

  } catch (err) {
    dom.errorMsg.textContent = err.message || "Could not generate design.";
    showCanvasState("error");
  } finally {
    state.isLoading = false;
    dom.submitBtn.disabled = false;
    dom.btnContent.classList.remove("hidden");
    dom.btnLoading.classList.add("hidden");
  }
}

dom.submitBtn.addEventListener("click", runGeneration);
dom.promptInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runGeneration();
});
dom.btnRegenerate.addEventListener("click", runGeneration);
dom.btnRetry.addEventListener("click", runGeneration);

async function downloadImage(url, filename) {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank");
  }
}

dom.btnDownload.addEventListener("click", () => {
  downloadImage(state.lastUrl, `nano-apple-${Date.now()}.png`); // Changed File Name
});

function saveHistory() {
  try {
    localStorage.setItem("nano_apple_history", JSON.stringify(state.history.slice(0, 50))); // Changed DB Name
  } catch {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem("nano_apple_history"); // Changed DB Name
    if (raw) {
      state.history = JSON.parse(raw).map((i) => ({ ...i, date: new Date(i.date) }));
    }
  } catch {
    state.history = [];
  }
}

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

  state.history.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.dataset.index = index;
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

let lightboxDownloadUrl = "";

function openLightbox(item) {
  dom.lightboxImg.src = item.url;
  dom.lightboxPrompt.textContent = item.prompt;
  dom.lightboxStyle.textContent = item.style;
  dom.lightboxRatio.textContent = item.ratio;
  dom.lightboxDate.textContent = item.date instanceof Date
    ? item.date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : String(item.date);
  lightboxDownloadUrl = item.url;
  dom.lightbox.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  dom.lightbox.classList.add("hidden");
  document.body.style.overflow = "";
  dom.lightboxImg.src = "";
}

dom.lightboxBackdrop.addEventListener("click", closeLightbox);
dom.lightboxClose.addEventListener("click", closeLightbox);
dom.lightboxDownload.addEventListener("click", () => {
  downloadImage(lightboxDownloadUrl, `nano-apple-${Date.now()}.png`); // Changed File Name
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

(function init() {
  loadHistory();
  dom.btnContent.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    </svg>
    Design Now`;
})();
