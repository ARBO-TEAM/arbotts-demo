import { textToPhonemeIds, phonemizeToIpa } from "./g2p.js";
import { encodeWav } from "./wav.js";

// DOM Elements
const textInput = document.getElementById("text-input");
const btnSynthesize = document.getElementById("btn-synthesize");
const btnStop = document.getElementById("btn-stop");
const speakerSelect = document.getElementById("speaker-select");
const speedRange = document.getElementById("speed-range");
const speedVal = document.getElementById("speed-val");
const statusCard = document.getElementById("status-card");
const statusText = document.getElementById("status-text");
const progressBar = document.getElementById("progress-bar");
const audioPlayer = document.getElementById("audio-player");
const btnDownload = document.getElementById("btn-download");
const statLatency = document.getElementById("stat-latency");
const statDuration = document.getElementById("stat-duration");
const statRtf = document.getElementById("stat-rtf");
const statPhonemes = document.getElementById("stat-phonemes");
const sampleChips = document.querySelectorAll(".chip");

let ortSession = null;
let modelConfig = null;
let currentBlobUrl = null;

// IndexedDB Cache Helpers
const DB_NAME = "ArboTTS_Cache_v1";
const STORE_NAME = "models";
const MODEL_KEY = "arbotts_small.onnx";

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

async function getCachedModel() {
  try {
    const db = await openCacheDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(MODEL_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    console.warn("IndexedDB unavailable, proceeding without cache:", e);
    return null;
  }
}

async function cacheModel(buffer) {
  try {
    const db = await openCacheDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(buffer, MODEL_KEY);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    console.warn("Failed to cache model in IndexedDB:", e);
  }
}

// Fetch model with stream progress tracking
async function fetchModelWithProgress(url, onProgress) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP error ${resp.status} fetching model`);
  const contentLength = resp.headers.get("Content-Length");
  const total = contentLength ? parseInt(contentLength, 10) : 32806261;

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

// Initialize Model & ONNX Runtime Web
async function initModel() {
  try {
    statusCard.classList.remove("hidden");
    statusText.textContent = "Memeriksa cache browser...";
    progressBar.style.width = "5%";

    // 1. Load config JSON
    const cfgResp = await fetch("models/arbotts_small.onnx.json");
    if (!cfgResp.ok) throw new Error("Gagal mengunduh konfigurasi suara");
    modelConfig = await cfgResp.json();

    // 2. Load ONNX model from IndexedDB or fetch
    let modelBuffer = await getCachedModel();
    if (modelBuffer) {
      statusText.textContent = "Model dimuat dari cache IndexedDB...";
      progressBar.style.width = "75%";
    } else {
      statusText.textContent = "Mengunduh model ArboTTS Small (32.8 MB)...";
      modelBuffer = await fetchModelWithProgress("models/arbotts_small.onnx", (loaded, total, pct) => {
        const mbLoaded = (loaded / (1024 * 1024)).toFixed(1);
        const mbTotal = (total / (1024 * 1024)).toFixed(1);
        statusText.textContent = `Mengunduh model: ${mbLoaded} MB / ${mbTotal} MB (${pct}%)`;
        progressBar.style.width = `${Math.max(5, pct * 0.75)}%`;
      });
      // Save to IndexedDB asynchronously
      cacheModel(modelBuffer);
    }

    // 3. Initialize ORT Session
    statusText.textContent = "Menginisialisasi WebAssembly Engine...";
    progressBar.style.width = "85%";

    // Set ORT options
    if (window.ort) {
      ort.env.wasm.numThreads = navigator.hardwareConcurrency ? Math.min(navigator.hardwareConcurrency, 4) : 2;
      ort.env.wasm.simd = true;

      // Try WebGPU first, then WASM
      const sessionOptions = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };

      ortSession = await ort.InferenceSession.create(modelBuffer, sessionOptions);
    } else {
      throw new Error("onnxruntime-web tidak ditemukan.");
    }

    progressBar.style.width = "100%";
    statusText.textContent = "Siap digunakan! (Client-Side WebAssembly Aktif)";
    setTimeout(() => {
      statusCard.classList.add("hidden");
    }, 1200);

    btnSynthesize.disabled = false;
  } catch (err) {
    console.error("Init error:", err);
    statusText.textContent = `Error: ${err.message}`;
    progressBar.style.backgroundColor = "#ef4444";
  }
}

// Synthesis function
async function synthesize() {
  const text = textInput.value.trim();
  if (!text) {
    alert("Silakan masukkan teks terlebih dahulu.");
    return;
  }
  if (!ortSession || !modelConfig) {
    alert("Model belum siap, silakan tunggu sebentar.");
    return;
  }

  btnSynthesize.disabled = true;
  btnSynthesize.innerHTML = `<span class="spinner"></span> Memproses...`;

  try {
    const startTime = performance.now();

    // 1. Indonesian G2P
    const phonemeMap = modelConfig.phoneme_id_map || {};
    const ipaStr = phonemizeToIpa(text);
    statPhonemes.textContent = ipaStr || "-";

    const idsBigInt = textToPhonemeIds(text, phonemeMap);
    const seqLen = idsBigInt.length;

    // 2. Prepare ONNX input tensors
    const inputIdsTensor = new ort.Tensor("int64", idsBigInt, [1, seqLen]);
    const inputLengthsTensor = new ort.Tensor("int64", new BigInt64Array([BigInt(seqLen)]), [1]);

    const speed = parseFloat(speedRange.value);
    const noiseScale = 0.667;
    const noiseW = 0.8;
    const scalesArray = new Float32Array([noiseScale, 1.0 / Math.max(speed, 0.1), noiseW]);
    const scalesTensor = new ort.Tensor("float32", scalesArray, [3]);

    const speakerId = parseInt(speakerSelect.value, 10);
    const sidTensor = new ort.Tensor("int64", new BigInt64Array([BigInt(speakerId)]), [1]);

    const feeds = {
      input: inputIdsTensor,
      input_lengths: inputLengthsTensor,
      scales: scalesTensor,
      sid: sidTensor,
    };

    // 3. Run Inference
    const results = await ortSession.run(feeds);
    const audioData = results.output.data; // Float32Array
    const inferenceTimeMs = performance.now() - startTime;

    // 4. Audio peak normalization
    let maxVal = 0;
    for (let i = 0; i < audioData.length; i++) {
      const abs = Math.abs(audioData[i]);
      if (abs > maxVal) maxVal = abs;
    }
    const samples = new Float32Array(audioData.length);
    if (maxVal > 1.0) {
      for (let i = 0; i < audioData.length; i++) samples[i] = audioData[i] / maxVal;
    } else if (maxVal > 0.01) {
      for (let i = 0; i < audioData.length; i++) samples[i] = audioData[i] * 0.95;
    } else {
      samples.set(audioData);
    }

    // 5. Encode to WAV
    const wavBlob = encodeWav(samples, 22050);
    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
    currentBlobUrl = URL.createObjectURL(wavBlob);

    // 6. Play and update UI
    audioPlayer.src = currentBlobUrl;
    audioPlayer.play();
    btnDownload.href = currentBlobUrl;
    btnDownload.download = `arbotts_${speakerSelect.options[speakerSelect.selectedIndex].text.toLowerCase()}_${Date.now()}.wav`;
    btnDownload.style.display = "inline-flex";

    // 7. Update Metrics
    const audioDurationSec = samples.length / 22050;
    const rtf = (inferenceTimeMs / 1000) / audioDurationSec;

    statLatency.textContent = `${Math.round(inferenceTimeMs)} ms`;
    statDuration.textContent = `${audioDurationSec.toFixed(2)} dtk`;
    statRtf.textContent = rtf.toFixed(3);
  } catch (err) {
    console.error("Synthesize error:", err);
    alert(`Terjadi kesalahan saat sintesis: ${err.message}`);
  } finally {
    btnSynthesize.disabled = false;
    btnSynthesize.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Suarakan`;
  }
}

// Event Listeners
speedRange.addEventListener("input", (e) => {
  speedVal.textContent = `${parseFloat(e.target.value).toFixed(2)}x`;
});

btnSynthesize.addEventListener("click", synthesize);

sampleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    textInput.value = chip.getAttribute("data-text");
    textInput.focus();
  });
});

// Startup initialization
window.addEventListener("DOMContentLoaded", () => {
  initModel();
});
