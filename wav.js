/**
 * Lightweight 16-bit Mono PCM WAV Encoder for Browser Audio.
 */

export function encodeWav(samples, sampleRate = 24000) {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  function writeString(offset, str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, "RIFF");
  // File length minus RIFF identifier & length itself
  view.setUint32(4, 36 + numSamples * 2, true);
  // RIFF type
  writeString(8, "WAVE");

  // Format chunk identifier
  writeString(12, "fmt ");
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // Channels (1 = mono)
  view.setUint16(22, 1, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (SampleRate * NumChannels * BitsPerSample / 8)
  view.setUint32(28, sampleRate * 2, true);
  // Block align (NumChannels * BitsPerSample / 8)
  view.setUint16(32, 2, true);
  // Bits per sample
  view.setUint16(34, 16, true);

  // Data chunk identifier
  writeString(36, "data");
  // Data chunk length
  view.setUint32(40, numSamples * 2, true);

  // Write PCM 16-bit audio samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Clamp sample to [-1.0, 1.0]
    let s = Math.max(-1, Math.min(1, samples[i]));
    // Convert to 16-bit signed integer [-32768, 32767]
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
