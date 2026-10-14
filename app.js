import { textToParadeeTokens, phonemizeToIpa } from "./g2p.js";
import { encodeWav } from "./wav.js";
import { SPEAKERS, applyAcousticDsp, analyzeReferenceAudio, peakNormalize } from "./dsp.js";

// DOM Elements - Studio Tab
const tabNavStudio = document.getElementById("tab-nav-studio");
const tabNavClone = document.getElementById("tab-nav-clone");
const tabStudio = document.getElementById("tab-studio");
const tabClone = document.getElementById("tab-clone");

const textInput = document.getElementById("text-input");
const btnSynthesize = document.getElementById("btn-synthesize");
const speakerCards = document.querySelectorAll(".speaker-card");
const speedRange = document.getElementById("speed-range");
const speedVal = document.getElementById("speed-val");
const btnLangId = document.getElementById("btn-lang-id");
const btnLangEn = document.getElementById("btn-lang-en");
const presetBtns = document.querySelectorAll(".preset-btn");

// DOM Elements - Voice Cloning Tab
const cloneDropzone = document.getElementById("clone-dropzone");
const cloneFileInput = document.getElementById("clone-file-input");
const cloneFilename = document.getElementById("clone-filename");
const cloneAnalysis = document.getElementById("clone-analysis");
const cloneRefPlayer = document.getElementById("clone-ref-player");
const refDuration = document.getElementById("ref-duration");
const refSr = document.getElementById("ref-sr");
const refF0 = document.getElementById("ref-f0");
const refSpeaker = document.getElementById("ref-speaker");
const refSemitones = document.getElementById("ref-semitones");
const cloneTargetInput = document.getElementById("clone-target-input");
const btnCloneLangId = document.getElementById("btn-clone-lang-id");
const btnCloneLangEn = document.getElementById("btn-clone-lang-en");
const cloneSpeedRange = document.getElementById("clone-speed-range");
const cloneSpeedVal = document.getElementById("clone-speed-val");
const btnCloneSynthesize = document.getElementById("btn-clone-synthesize");

// DOM Elements - Output & Status
const statusCard = document.getElementById("status-card");
const statusText = document.getElementById("status-text");
const progressBar = document.getElementById("progress-bar");
const outputSection = document.getElementById("output-section");
const audioPlayer = document.getElementById("audio-player");
const btnDownload = document.getElementById("btn-download");
const statPersona = document.getElementById("stat-persona");
const statLatency = document.getElementById("stat-latency");
const statDuration = document.getElementById("stat-duration");
const statRtf = document.getElementById("stat-rtf");
const statPhonemes = document.getElementById("stat-phonemes");

// State
let ortSession = null;
let modelConfig = null;
let currentBlobUrl = null;
let selectedSpeaker = "arbo";
let currentLang = "id";
let cloneLang = "id";
let cloneAnalysisResult = null;
let audioContext = null;

// IndexedDB Caching Constants
const DB_NAME = "ArboTTS_Cache_v3";
const STORE_NAME = "models";
const DEFAULT_MODEL_NAME = "arbo_paradee_8m.onnx";
const MODEL_URL = `models/${DEFAULT_MODEL_NAME}`;
const CONFIG_URL = "models/vocab.json";

function getAudioContext() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

function openCacheDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getCachedModel(key) {
  try {
    const db = await openCacheDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("IndexedDB unavailable:", e);
    return null;
  }
}

async function cacheModel(key, buffer) {
  try {
    const db = await openCacheDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(buffer, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn("Failed caching model in IndexedDB:", e);
  }
}

async function fetchModelWithProgress(url, onProgress) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP error ${resp.status} fetching model`);
  const contentLength = resp.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 9037971;

  if (!resp.body) {
    const buf = await resp.arrayBuffer();
    onProgress(total, total, 100);
    return buf;
  }

  const reader = resp.body.getReader();
  const chunks = [];
  let loaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    const pct = Math.min(100, Math.round((loaded / total) * 100));
    onProgress(loaded, total, pct);
  }

  const allChunks = new Uint8Array(loaded);
  let pos = 0;
  for (const chunk of chunks) {
    allChunks.set(chunk, pos);
    pos += chunk.length;
  }
  return allChunks.buffer;
}

// Initialize Model & ONNX WebAssembly SIMD
async function initModel() {
  try {
    statusCard.classList.remove("hidden");
    statusText.textContent = "Memeriksa cache browser IndexedDB...";
    progressBar.style.width = "5%";

    // 1. Fetch Phoneme Config
    const cfgResp = await fetch(CONFIG_URL);
    if (!cfgResp.ok) throw new Error("Gagal mengunduh konfigurasi suara");
    modelConfig = await cfgResp.json();

    // 2. Fetch or Read Model Buffer
    let modelBuffer = await getCachedModel(DEFAULT_MODEL_NAME);
    if (modelBuffer) {
      statusText.textContent = "Model ArboTTS Paradee-8M dimuat dari cache IndexedDB...";
      progressBar.style.width = "75%";
    } else {
      statusText.textContent = "Mengunduh model ArboTTS Paradee-8M (9.0 MB)...";
      modelBuffer = await fetchModelWithProgress(MODEL_URL, (loaded, total, pct) => {
        const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
        const mbTotal = (total / (1024 * 1024)).toFixed(1);
        statusText.textContent = `Mengunduh model: ${mbLoaded} MB / ${mbTotal} MB (${pct}%)`;
        progressBar.style.width = `${Math.max(5, pct * 0.75)}%`;
      });
      cacheModel(DEFAULT_MODEL_NAME, modelBuffer);
    }

    // 3. Initialize ORT Session
    statusText.textContent = "Menginisialisasi WebAssembly Engine SIMD (Paradee-8M)...";
    progressBar.style.width = "85%";

    if (window.ort) {
      ort.env.wasm.numThreads = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2;
      ort.env.wasm.simd = true;

      const sessionOptions = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };

      ortSession = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    } else {
      throw new Error("onnxruntime-web tidak ditemukan.");
    }

    progressBar.style.width = "100%";
    statusText.textContent = "Siap digunakan! (Paradee-8M 24kHz SIMD Aktif)";
    setTimeout(() => {
      statusCard.classList.add("hidden");
    }, 1200);

    btnSynthesize.disabled = false;
    if (cloneAnalysisResult) {
      btnCloneSynthesize.disabled = false;
    }
  } catch (err) {
    console.error("Init error:", err);
    statusText.textContent = `Error: ${err.message}`;
    progressBar.style.backgroundColor = "#ef4444";
  }
}

// Tab Switching
tabNavStudio.addEventListener("click", () => {
  tabNavStudio.classList.add("active");
  tabNavClone.classList.remove("active");
  tabStudio.style.display = "block";
  tabClone.style.display = "none";
});

tabNavClone.addEventListener("click", () => {
  tabNavClone.classList.add("active");
  tabNavStudio.classList.remove("active");
  tabStudio.style.display = "none";
  tabClone.style.display = "block";
});

// Speaker Selection
speakerCards.forEach((card) => {
  card.addEventListener("click", () => {
    speakerCards.forEach((c) => c.classList.remove("active"));
    card.classList.add("active");
    selectedSpeaker = card.getAttribute("data-speaker") || "arbo";
  });
});

// Language Switcher - Studio
btnLangId.addEventListener("click", () => {
  currentLang = "id";
  btnLangId.classList.add("active");
  btnLangEn.classList.remove("active");
});

btnLangEn.addEventListener("click", () => {
  currentLang = "en";
  btnLangEn.classList.add("active");
  btnLangId.classList.remove("active");
});

// Language Switcher - Clone
btnCloneLangId.addEventListener("click", () => {
  cloneLang = "id";
  btnCloneLangId.classList.add("active");
  btnCloneLangEn.classList.remove("active");
});

btnCloneLangEn.addEventListener("click", () => {
  cloneLang = "en";
  btnCloneLangEn.classList.add("active");
  btnCloneLangId.classList.remove("active");
});

// Speed Range Sliders
speedRange.addEventListener("input", (e) => {
  speedVal.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
});

cloneSpeedRange.addEventListener("input", (e) => {
  cloneSpeedVal.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
});

// Presets
presetBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const text = btn.getAttribute("data-text");
    const lang = btn.getAttribute("data-lang");
    textInput.value = text;
    if (lang === "en") {
      btnLangEn.click();
    } else {
      btnLangId.click();
    }
    textInput.focus();
  });
});

// Voice Cloning File Dropzone
cloneDropzone.addEventListener("click", () => cloneFileInput.click());

cloneDropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  cloneDropzone.classList.add("dragover");
});

cloneDropzone.addEventListener("dragleave", () => {
  cloneDropzone.classList.remove("dragover");
});

cloneDropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  cloneDropzone.classList.remove("dragover");
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleReferenceAudioFile(e.dataTransfer.files[0]);
  }
});

cloneFileInput.addEventListener("change", (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleReferenceAudioFile(e.target.files[0]);
  }
});

async function handleReferenceAudioFile(file) {
  try {
    cloneFilename.textContent = `Memproses: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`;

    const ctx = getAudioContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // Analyze acoustic characteristics
    cloneAnalysisResult = analyzeReferenceAudio(audioBuffer);

    // Update UI
    cloneFilename.textContent = `✅ ${file.name} (Siap Dikloning)`;
    cloneAnalysis.style.display = "block";

    refDuration.textContent = `${cloneAnalysisResult.duration.toFixed(1)} detik`;
    refSr.textContent = `${cloneAnalysisResult.sampleRate} Hz`;
    refF0.textContent = `~${cloneAnalysisResult.f0} Hz (${cloneAnalysisResult.gender === "female" ? "Wanita" : "Pria"})`;
    refSpeaker.textContent = cloneAnalysisResult.baseSpeakerId === 1 ? "Arba (Female)" : "Arbo (Male)";
    refSemitones.textContent = `${cloneAnalysisResult.recipe.pitch_shift_semitones > 0 ? "+" : ""}${cloneAnalysisResult.recipe.pitch_shift_semitones} st`;

    // Local playback preview
    const previewBlob = new Blob([arrayBuffer], { type: file.type || "audio/wav" });
    cloneRefPlayer.src = URL.createObjectURL(previewBlob);

    if (ortSession) {
      btnCloneSynthesize.disabled = false;
    }
  } catch (err) {
    console.error("Audio decoding error:", err);
    alert(`Gagal membaca berkas audio: ${err.message}. Harap unggah berkas .wav atau .mp3 yang valid.`);
    cloneFilename.textContent = "Klik atau Tarik Berkas Audio ke Sini (WAV, MP3, M4A, OGG)";
    cloneAnalysis.style.display = "none";
    btnCloneSynthesize.disabled = true;
  }
}

// Core Synthesis Engine Function
async function runSynthesis({ text, lang, speakerKey, dspRecipe, speed, modeLabel }) {
  if (!text || !text.trim()) {
    alert("Silakan masukkan teks terlebih dahulu.");
    return;
  }
  if (!ortSession || !modelConfig) {
    alert("Model neural sedang dimuat, harap tunggu sebentar.");
    return;
  }

  const startTime = performance.now();

  // 1. Text to IPA and Paradee token framing
  const { ipa, inputIds, tokens, lang: detectedLang } = textToParadeeTokens(text, modelConfig, lang);
  statPhonemes.textContent = ipa || "-";

  if (!tokens || tokens.length === 0) {
    alert("Tidak ada karakter yang valid untuk disuarakan.");
    return;
  }

  // 2. Prepare ONNX Input Tensors
  const seqLen = inputIds.length;
  const inputIdsTensor = new ort.Tensor("int64", inputIds, [1, seqLen]);
  const speedTensor = new ort.Tensor("float32", new Float32Array([speed]), [1]);

  const feeds = {
    input_ids: inputIdsTensor,
    speed: speedTensor,
  };

  // 3. WebAssembly SIMD ONNX Inference
  const results = await ortSession.run(feeds);
  const rawAudio = results.waveform.data; // Float32Array at 24,000 Hz
  const inferenceTimeMs = performance.now() - startTime;

  // 4. Acoustic DSP Morphing (Pitch Shift + Biquad Formant EQ)
  let processedAudio = await applyAcousticDsp(rawAudio, 24000, dspRecipe);

  // Peak normalization
  processedAudio = peakNormalize(processedAudio, 0.95);

  // 5. Encode 16-bit PCM WAV
  const wavBlob = encodeWav(processedAudio, 24000);
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  currentBlobUrl = URL.createObjectURL(wavBlob);

  // 6. Play and update UI
  outputSection.classList.remove("hidden");
  audioPlayer.src = currentBlobUrl;
  audioPlayer.play();

  btnDownload.href = currentBlobUrl;
  btnDownload.download = `arbotts_${modeLabel.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${Date.now()}.wav`;

  // 7. Metrics
  const durationSec = processedAudio.length / 24000;
  const rtf = (inferenceTimeMs / 1000) / durationSec;

  statPersona.textContent = modeLabel;
  statLatency.textContent = `${Math.round(inferenceTimeMs)} ms`;
  statDuration.textContent = `${durationSec.toFixed(2)} dtk`;
  statRtf.textContent = `${rtf.toFixed(3)}x`;

  outputSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Studio Synthesis Action
btnSynthesize.addEventListener("click", async () => {
  btnSynthesize.disabled = true;
  btnSynthesize.innerHTML = `<span class="spinner"></span> Memproses WebAssembly...`;

  try {
    const speaker = SPEAKERS[selectedSpeaker] || SPEAKERS.arbo;
    const speed = parseFloat(speedRange.value);

    await runSynthesis({
      text: textInput.value,
      lang: currentLang,
      speakerKey: selectedSpeaker,
      dspRecipe: speaker.dsp,
      speed,
      modeLabel: `${speaker.name} (${speaker.persona})`
    });
  } catch (err) {
    console.error("Synthesis error:", err);
    alert(`Terjadi kesalahan saat sintesis: ${err.message}`);
  } finally {
    btnSynthesize.disabled = false;
    btnSynthesize.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Sintesis Suara (Generate Speech)`;
  }
});

// Voice Cloning Synthesis Action
btnCloneSynthesize.addEventListener("click", async () => {
  if (!cloneAnalysisResult) {
    alert("Silakan unggah berkas audio referensi suara Anda terlebih dahulu.");
    return;
  }

  btnCloneSynthesize.disabled = true;
  btnCloneSynthesize.innerHTML = `<span class="spinner"></span> Menyesuaikan Timbre & Sintesis...`;

  try {
    const speed = parseFloat(cloneSpeedRange.value);
    const baseSpeakerKey = cloneAnalysisResult.baseSpeakerId === 1 ? "arba" : "arbo";

    await runSynthesis({
      text: cloneTargetInput.value,
      lang: cloneLang,
      speakerKey: baseSpeakerKey,
      dspRecipe: cloneAnalysisResult.recipe,
      speed,
      modeLabel: `Kloning Suara (${cloneAnalysisResult.gender === "female" ? "Wanita" : "Pria"}, F0: ${cloneAnalysisResult.f0}Hz)`
    });
  } catch (err) {
    console.error("Clone synthesis error:", err);
    alert(`Terjadi kesalahan saat kloning: ${err.message}`);
  } finally {
    btnCloneSynthesize.disabled = false;
    btnCloneSynthesize.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg> Mulai Kloning & Sintesis Suara`;
  }
});

// Auto-start on load
window.addEventListener("DOMContentLoaded", () => {
  initModel();
});
