# 🎙️ ArboTTS WebAssembly Demo (`arbotts-demo`)

> **100% Client-Side Indonesian Text-to-Speech** running directly in the browser via WebAssembly (WASM SIMD) & ONNX Runtime Web. Zero server computation cost, zero API keys, and privacy-preserving (text never leaves the user's device).

[![GitHub Pages](https://img.shields.io/badge/Demo-Live%20on%20GitHub%20Pages-38bdf8?style=flat&logo=github)](https://freaktopus.github.io/arbotts-demo/)
[![Architecture](https://img.shields.io/badge/Engine-WebAssembly%20SIMD-10b981?style=flat)]()
[![Model Size](https://img.shields.io/badge/Model-32.8%20MB%20(VITS%20V2)-blue?style=flat)]()
[![Server Cost](https://img.shields.io/badge/Server%20Cost-%240%20(Static%20Host)-purple?style=flat)]()

---

## ⚡ Overview

`arbotts-demo` is a standalone, purely static web application designed to demonstrate the power of **[ArboTTS](https://github.com/freaktopus/arboTTS)** without requiring any Python backend, GPU cluster, or active server process:

1. **Pure Client-Side G2P (`g2p.js`)**: An espeak-free, dependency-free Indonesian grapheme-to-phoneme engine implementing standard Indonesian syllabification, stress patterns, number spelling, and lexical exception handling (pepet `/ə/` vs taling `/e/`).
2. **WebAssembly SIMD Execution**: Utilizes `onnxruntime-web` to execute `arbotts_small.onnx` (32.8 MB) directly on the browser thread with a Real-Time Factor (RTF) of **~0.33** (~1.4s synthesis for 4.3s of speech).
3. **IndexedDB Smart Caching**: The 32.8 MB neural model is fetched once and cached in the browser's persistent IndexedDB storage. Subsequent page loads initialize in under **100ms** with zero network overhead.
4. **Zero Server Cost**: Can be hosted 100% free on GitHub Pages, Cloudflare Pages, Vercel, or any static HTTP server.

---

## 🧩 Architecture

```
[ User Input Text ]
        │
        ▼
[ g2p.js (Pure JS Indonesian Frontend) ]
  ├── Number Spelling (e.g. 25000 -> dua puluh lima ribu)
  ├── Syllabification & Penultimate Stress Rules
  └── KBBI Lexical Rules (open-e taling, pepet root correction)
        │  (IPA string -> NFD decomposition)
        ▼
[ Piper Phoneme Framing: BOS, PAD, (id, PAD)..., EOS ]
        │
        ▼
[ onnxruntime-web (WebAssembly SIMD) ]
  ├── Loads arbotts_small.onnx (32.8 MB) from IndexedDB
  ├── Inputs: input, input_lengths, scales, sid (0=Arbo, 1=Arba)
  └── Computes 22,050 Hz Mono Audio Waveform
        │
        ▼
[ wav.js (Client-Side 16-bit PCM WAV Encoder) ]
        │
        ▼
[ HTML5 Audio Playback & Instant Download ]
```

---

## 🚀 Running Locally

No build tools, bundlers, or Node.js installations are strictly required. Simply serve the directory using any static file server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using Bun
bun x serve .
```

Then open `http://localhost:8080` in any modern web browser (Chrome, Edge, Firefox, Safari).

---

## 🌐 Deploying to GitHub Pages

1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/freaktopus/arbotts-demo.git
   git push -u origin main
   ```
2. In your GitHub repository settings:
   - Navigate to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` workflow will automatically deploy the site.

---

## 🔗 Parent Project & Credits

- Main ArboTTS Repository: **[freaktopus/arboTTS](https://github.com/freaktopus/arboTTS)**
- Core Engine: Piper VITS V2 Neural Vocoder
- Developed by Wafik (@freaktopus)
