# 🎙️ ArboTTS Studio Web Demo (`arbotts-demo`)

> **100% Client-Side Bilingual (Indonesian & English) Text-to-Speech & Voice Cloning** powered by the ultra-lightweight **Paradee-8M** model — **~9 MB INT8 ONNX** (reduced from 63.5 MB, an **85% download reduction!**) running at **24 kHz** high-fidelity studio quality with **< 50 ms latency** on modern CPUs via WebAssembly (WASM SIMD) & ONNX Runtime Web. Zero server computation cost, zero API keys, and complete privacy: 100% in-browser execution with IndexedDB caching — user audio and text never leave the device, and the demo even works fully offline after the first load.

[![GitHub Pages](https://img.shields.io/badge/Demo-Live%20on%20GitHub%20Pages-38bdf8?style=flat&logo=github)](https://arbo-team.github.io/arbotts-demo/)
[![Architecture](https://img.shields.io/badge/Engine-WebAssembly%20SIMD-10b981?style=flat)]()
[![Model Size](https://img.shields.io/badge/Model-9%20MB%20INT8%20Paradee--8M-blue?style=flat)]()
[![Sample Rate](https://img.shields.io/badge/Audio-24%20kHz%20Studio-critical?style=flat)]()
[![Bilingual](https://img.shields.io/badge/Languages-ID%20%7C%20EN-orange?style=flat)]()
[![Voice Cloning](https://img.shields.io/badge/Feature-In--Browser%20Voice%20Cloning-purple?style=flat)]()
[![Server Cost](https://img.shields.io/badge/Server%20Cost-%240%20(Static%20Host)-success?style=flat)]()

---

## 📋 Key Specifications

| Spec | Value |
| --- | --- |
| **Model** | Paradee-8M (`models/arbo_paradee_8m.onnx`) |
| **Size** | ~9 MB INT8 ONNX (reduced from 63.5 MB — an **85% download reduction!**) |
| **Output** | 24,000 Hz high-fidelity 32-bit float audio |
| **Latency** | < 50 ms on modern CPUs via WebAssembly SIMD |
| **Bilingual G2P** | Native Indonesian rule-based pepet/taling + English lexicon & fallback G2P |
| **Offline & Private** | 100% in-browser execution with IndexedDB caching — nothing ever leaves the device |

---

## ⚡ Overview

`arbotts-demo` brings the full functionality of **[ArboTTS Studio](https://github.com/ARBO-TEAM/arboTTS)** directly into any modern web browser without requiring a backend server, Python runtime, or GPU instance:

1. **🇮🇩 & 🇬🇧 Bilingual Synthesis (Language Switcher)**:
   - **Indonesian (`id`)**: Native rule-based grapheme-to-phoneme engine with syllabification, penultimate stress, and KBBI lexical exception handling (pepet `/ə/` vs taling `/e/`).
   - **English (`en`)**: Client-side lexicon with 1,066 common vocabulary IPA transcriptions (`en_dict.js`) and rule-based letter-to-sound fallback.
2. **🎭 7 Studio Voice Personas**:
   - **⭐ Primary Male (Recommended)**:
     - 🎙️ **Arbo**: Formal broadcast announcer with deep resonance and authoritative cadence.
     - 📢 **Bimo**: Deep baritone voice with rich chest resonance for corporate VO & documentaries.
     - ⚡ **Dimas**: Casual and energetic young male tone for smart assistants and modern videos.
     - ☕ **Danu**: Polite, gentle, and calm cadence for storytelling and audiobooks.
   - **👩 Additional Female**:
     - 👩 **Arba**: Professional news presenter with crisp and polite mid-range clarity.
     - 🤖 **Sita**: Bright, cheerful, and interactive virtual assistant cadence.
     - 📖 **Maya**: Soft and velvety narrator for bedtime stories and relaxing meditation.
3. **🎙️ In-Browser Voice Cloning**:
   - Users can drag-and-drop or select a 5–15 second audio sample (`.wav`, `.mp3`, `.m4a`, `.ogg`).
   - The browser analyzes the acoustic signature (F0 pitch estimation and spectral centroid) in local memory via Web Audio API.
   - Synthesizes arbitrary target sentences with the matched base neural speaker and applies client-side acoustic timbre adaptation.
   - **100% Private**: Audio never touches any external server or network.
4. **WebAssembly SIMD Execution**:
   - Executes `arbo_paradee_8m.onnx` (**~9 MB INT8**, reduced from 63.5 MB — an 85% download reduction!) via `onnxruntime-web` directly on the client machine with **< 50 ms latency** on modern CPUs.
5. **IndexedDB Smart Caching & Offline Privacy**:
   - Downloads the ~9 MB Paradee-8M neural model once and persists it in the browser's IndexedDB (`ArboTTS_Cache_v2`). Subsequent page reloads initialize in **under 100ms** with zero network transfer.
   - **Offline & Private**: 100% in-browser execution with IndexedDB caching — synthesis, voice cloning, and model inference never touch a server.

---

## 🧩 Architecture

```
[ User Input Text (ID / EN) ]
        │
        ▼
[ Bilingual G2P Frontend (g2p.js & en_dict.js) ]
  ├── Indonesian Syllabification & Pepet/Taling Disambiguation
  ├── English IPA Lexicon & Grapheme Fallback Rules
  └── Number Spelling & Normalization
        │  (IPA String -> NFD Decomposition)
        ▼
[ Piper Token Framing: BOS, PAD, (id, PAD)..., EOS ]
        │
        ▼
[ onnxruntime-web (WebAssembly SIMD Engine) ]
  ├── arbo_paradee_8m.onnx (~9 MB INT8) loaded from IndexedDB
  ├── Paradee-8M Neural Vocoder Evaluation (INT8)
  └── 24,000 Hz 32-bit Float Audio Output
        │
        ▼
[ Client-Side DSP Morpher & Voice Cloning (dsp.js) ]
  ├── SOLA (Synchronized Overlap-Add) Pitch Shift
  ├── Web Audio Biquad Filter (Presence Boost / Warmth Lowpass)
  └── Peak Normalization (0.95 Amplitude)
        │
        ▼
[ wav.js (16-bit PCM WAV Encoder) ]
        │
        ▼
[ HTML5 Audio Player, Real-Time Metrics & WAV Download ]
```

---

## 🚀 Running Locally

No build tools or server dependencies required. Serve the folder using any static HTTP server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .

# Using Bun
bun x serve .
```

Open `http://localhost:8080` in Chrome, Edge, Firefox, or Safari.

---

## 🌐 Deployment to GitHub Pages

The repository contains an automated GitHub Actions deployment workflow (`.github/workflows/deploy.yml`):

```bash
git remote add origin https://github.com/ARBO-TEAM/arbotts-demo.git
git push -u origin main
```

Ensure GitHub Pages is set to **GitHub Actions** in repository **Settings** > **Pages**.

---

## 🔗 Parent Project & Credits

- Main ArboTTS Repository: **[ARBO-TEAM/arboTTS](https://github.com/ARBO-TEAM/arboTTS)**
- Core Engine: Paradee-8M — ~9 MB INT8-quantized neural vocoder at 24 kHz, built on the Piper VITS architecture
- Developed by **ARBO-TEAM** (@wafik)
