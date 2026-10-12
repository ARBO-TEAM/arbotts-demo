/**
 * ArboTTS Client-Side Acoustic DSP & Voice Cloning Morpher
 *
 * Provides:
 * 1. SOLA (Synchronized Overlap-Add) pitch shifting.
 * 2. Formant and EQ filtering via Web Audio Biquad / IIR filters.
 * 3. Reference audio analysis (F0 pitch & timbre centroid) for in-browser voice cloning.
 */

export const SPEAKERS = {
  arbo: {
    id: 0,
    gender: "male",
    name: "Arbo",
    persona: "Penyiar Berita Formal",
    icon: "🎙️",
    description: "Berwibawa, konsonan tegas, dan resonansi seimbang.",
    dsp: {}
  },
  bimo: {
    id: 0,
    gender: "male",
    name: "Bimo",
    persona: "Baritone Berat & Berwibawa",
    icon: "📢",
    description: "Resonansi dada tebal, berbobot, wibawa matang untuk profil & dokumenter.",
    dsp: {
      pitch_shift_semitones: -1.5,
      lowpass_warmth_hz: 5500
    }
  },
  dimas: {
    id: 0,
    gender: "male",
    name: "Dimas",
    persona: "Pria Muda Kasual & Energik",
    icon: "⚡",
    description: "Tempo dinamis, ramah, artikulasi konsonan letup jernih.",
    dsp: {
      pitch_shift_semitones: 1.0
    }
  },
  danu: {
    id: 0,
    gender: "male",
    name: "Danu",
    persona: "Narator Tenang & Santun",
    icon: "☕",
    description: "Tekstur hangat, tempo lembut, intonasi menenangkan untuk narasi.",
    dsp: {
      pitch_shift_semitones: -0.7,
      lowpass_warmth_hz: 6000
    }
  },
  arba: {
    id: 0,
    gender: "female",
    name: "Arba",
    persona: "Presenter Berita Profesional",
    icon: "👩",
    description: "Artikulasi jernih, santun, lugas dengan kehangatan mid-range.",
    dsp: {
      pitch_shift_semitones: 9.2,
      highpass_cut_hz: 180,
      presence_boost_hz: 3800,
      presence_gain: 0.3,
      formant_peak_hz: 1400,
      formant_gain: 0.25
    }
  },
  sita: {
    id: 0,
    gender: "female",
    name: "Sita",
    persona: "Asisten Interaktif Cerdas",
    icon: "🤖",
    description: "Ceria, bersahabat, tempo percakapan interaktif cerdas.",
    dsp: {
      pitch_shift_semitones: 11.2,
      highpass_cut_hz: 200,
      presence_boost_hz: 4200,
      presence_gain: 0.35,
      formant_peak_hz: 1600,
      formant_gain: 0.3
    }
  },
  maya: {
    id: 0,
    gender: "female",
    name: "Maya",
    persona: "Narator Tenang & Storyteller",
    icon: "📖",
    description: "Lembut, santai, tekstur hangat dengan ritme halus untuk dongeng.",
    dsp: {
      pitch_shift_semitones: 8.2,
      highpass_cut_hz: 160,
      formant_peak_hz: 1300,
      formant_gain: 0.2,
      lowpass_warmth_hz: 6000
    }
  }
};

/**
 * Linear resampler
 */
function resample(samples, ratio) {
  if (Math.abs(ratio - 1.0) < 0.001) return samples;
  const newLen = Math.round(samples.length / ratio);
  const out = new Float32Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, samples.length - 1);
    const frac = srcIdx - idx0;
    out[i] = samples[idx0] * (1 - frac) + samples[idx1] * frac;
  }
  return out;
}

/**
 * SOLA (Synchronized Overlap-Add) Time Stretch
 */
function solaStretch(input, alpha, sampleRate = 22050) {
  if (Math.abs(alpha - 1.0) < 0.01) return input;
  const winSize = Math.round(sampleRate * 0.025); // ~25ms
  const hopOut = Math.round(winSize / 2);
  const hopIn = Math.round(hopOut / alpha);
  const maxSearch = Math.round(sampleRate * 0.008);

  const numHops = Math.floor((input.length - winSize - maxSearch) / hopIn);
  if (numHops <= 1) return input;

  const outLen = numHops * hopOut + winSize;
  const out = new Float32Array(outLen);
  const window = new Float32Array(winSize);
  for (let i = 0; i < winSize; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (winSize - 1)));
  }

  for (let i = 0; i < winSize; i++) {
    out[i] = input[i] * window[i];
  }

  let inPos = hopIn;
  let outPos = hopOut;

  for (let h = 1; h < numHops; h++) {
    let bestOffset = 0;
    let maxCorr = -Infinity;
    for (let delta = -maxSearch; delta <= maxSearch; delta++) {
      const curIn = inPos + delta;
      if (curIn < 0 || curIn + winSize > input.length) continue;
      let corr = 0;
      for (let i = 0; i < winSize; i += 2) {
        corr += out[outPos + i] * input[curIn + i];
      }
      if (corr > maxCorr) {
        maxCorr = corr;
        bestOffset = delta;
      }
    }

    const bestIn = inPos + bestOffset;
    for (let i = 0; i < winSize; i++) {
      out[outPos + i] += input[bestIn + i] * window[i];
    }

    inPos += hopIn;
    outPos += hopOut;
  }

  return out;
}

/**
 * Pitch shift Float32Array PCM samples by semitones.
 */
export function pitchShiftAudio(samples, semitones, sampleRate = 22050) {
  if (Math.abs(semitones) < 0.05) return samples;
  const pitchRatio = Math.pow(2, semitones / 12);
  const resampled = resample(samples, pitchRatio);
  const stretched = solaStretch(resampled, pitchRatio, sampleRate);
  return stretched;
}

/**
 * Peak normalize audio to target amplitude (default 0.95)
 */
export function peakNormalize(samples, targetPeak = 0.95) {
  let maxVal = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxVal) maxVal = abs;
  }
  if (maxVal < 1e-4) return samples;

  const out = new Float32Array(samples.length);
  const scale = targetPeak / maxVal;
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] * scale;
  }
  return out;
}

/**
 * Apply full acoustic DSP recipe to synthesized audio.
 */
export async function applyAcousticDsp(samples, sampleRate, dspRecipe) {
  if (!dspRecipe || Object.keys(dspRecipe).length === 0) {
    return peakNormalize(samples);
  }

  let processed = samples;

  // 1. Pitch shift
  const semitones = dspRecipe.pitch_shift_semitones || 0;
  if (Math.abs(semitones) >= 0.05) {
    processed = pitchShiftAudio(processed, semitones, sampleRate);
  }

  // 2. Web Audio Biquad Equalization
  if (typeof window !== "undefined" && (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
    if (
      dspRecipe.presence_boost_hz ||
      dspRecipe.lowpass_warmth_hz ||
      dspRecipe.highpass_cut_hz ||
      dspRecipe.formant_peak_hz
    ) {
      try {
        const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const offlineCtx = new Ctx(1, processed.length, sampleRate);
        const buffer = offlineCtx.createBuffer(1, processed.length, sampleRate);
        buffer.copyToChannel(processed, 0);

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        let lastNode = source;

        // Cut male chest resonance for female personas
        if (dspRecipe.highpass_cut_hz) {
          const highpass = offlineCtx.createBiquadFilter();
          highpass.type = "highpass";
          highpass.frequency.value = dspRecipe.highpass_cut_hz;
          highpass.Q.value = 0.707;
          lastNode.connect(highpass);
          lastNode = highpass;
        }

        // Female formant enhancement
        if (dspRecipe.formant_peak_hz) {
          const formant = offlineCtx.createBiquadFilter();
          formant.type = "peaking";
          formant.frequency.value = dspRecipe.formant_peak_hz;
          formant.gain.value = (dspRecipe.formant_gain || 0.25) * 12; // dB
          formant.Q.value = 1.2;
          lastNode.connect(formant);
          lastNode = formant;
        }

        if (dspRecipe.presence_boost_hz) {
          const presence = offlineCtx.createBiquadFilter();
          presence.type = "peaking";
          presence.frequency.value = dspRecipe.presence_boost_hz;
          presence.gain.value = (dspRecipe.presence_gain || 0.25) * 12; // dB
          presence.Q.value = 1.0;
          lastNode.connect(presence);
          lastNode = presence;
        }

        if (dspRecipe.lowpass_warmth_hz) {
          const lowpass = offlineCtx.createBiquadFilter();
          lowpass.type = "lowpass";
          lowpass.frequency.value = dspRecipe.lowpass_warmth_hz;
          lowpass.Q.value = 0.707;
          lastNode.connect(lowpass);
          lastNode = lowpass;
        }

        lastNode.connect(offlineCtx.destination);
        source.start(0);

        const rendered = await offlineCtx.startRendering();
        processed = rendered.getChannelData(0);
      } catch (err) {
        console.warn("OfflineAudioContext filtering bypassed:", err);
      }
    }
  }

  return peakNormalize(processed);
}

/**
 * Estimate fundamental frequency (F0) from mono PCM channel via normalized autocorrelation.
 */
export function estimateF0(channelData, sampleRate) {
  const minFreq = 70;   // Lowest human voice ~70 Hz
  const maxFreq = 400;  // Highest speech fundamental ~400 Hz
  const minLag = Math.floor(sampleRate / maxFreq);
  const maxLag = Math.floor(sampleRate / minFreq);

  // Take up to 2 seconds segment from the center
  const center = Math.floor(channelData.length / 2);
  const frameLen = Math.min(Math.floor(sampleRate * 1.5), channelData.length);
  const start = Math.max(0, center - Math.floor(frameLen / 2));
  const segment = channelData.slice(start, start + frameLen);

  let bestLag = 0;
  let maxCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let energy1 = 0;
    let energy2 = 0;
    const step = 2; // Speed up calculation
    for (let i = 0; i < segment.length - lag; i += step) {
      corr += segment[i] * segment[i + lag];
      energy1 += segment[i] * segment[i];
      energy2 += segment[i + lag] * segment[i + lag];
    }
    const norm = Math.sqrt(energy1 * energy2) || 1e-6;
    const normCorr = corr / norm;
    if (normCorr > maxCorr) {
      maxCorr = normCorr;
      bestLag = lag;
    }
  }

  if (maxCorr > 0.35 && bestLag > 0) {
    return sampleRate / bestLag;
  }
  return 130; // Fallback median F0
}

/**
 * Estimate spectral centroid (brightness/warmth)
 */
export function estimateSpectralCentroid(channelData, sampleRate) {
  // Approximate centroid by high-frequency energy ratio
  let highEnergy = 0;
  let totalEnergy = 0;
  for (let i = 1; i < channelData.length; i++) {
    const diff = channelData[i] - channelData[i - 1]; // High-pass derivative
    highEnergy += diff * diff;
    totalEnergy += channelData[i] * channelData[i];
  }
  const ratio = (highEnergy / (totalEnergy || 1e-6));
  // Map ratio to approximate centroid in Hz
  return Math.min(5000, Math.max(800, Math.round(ratio * 1200)));
}

/**
 * Analyze user uploaded reference audio for Voice Cloning.
 */
export function analyzeReferenceAudio(audioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  const sr = audioBuffer.sampleRate;
  const duration = audioBuffer.duration;

  const f0 = estimateF0(channelData, sr);
  const centroid = estimateSpectralCentroid(channelData, sr);

  // Gender classification based on pitch threshold
  // Male median F0 is typically 85-155 Hz, Female 165-255 Hz
  const isFemale = f0 >= 165;
  const baseSpeakerId = isFemale ? 1 : 0;

  // Semitone difference relative to Arbo base model (~120 Hz)
  const semitones = Math.max(-4.0, Math.min(14.0, 12 * Math.log2(f0 / 120)));

  const recipe = {
    pitch_shift_semitones: parseFloat(semitones.toFixed(2))
  };

  if (isFemale) {
    recipe.highpass_cut_hz = 180;
    recipe.formant_peak_hz = 1450;
    recipe.formant_gain = 0.25;
    recipe.presence_boost_hz = 3800;
    recipe.presence_gain = 0.3;
  } else {
    if (centroid > 3200) {
      recipe.presence_boost_hz = 3500;
      recipe.presence_gain = 0.2;
    } else if (centroid < 1800) {
      recipe.lowpass_warmth_hz = 5500;
    }
  }

  return {
    duration,
    sampleRate: sr,
    f0: Math.round(f0),
    centroid,
    gender: isFemale ? "female" : "male",
    baseSpeakerId,
    recipe
  };
}
