/**
 * ArboTTS Pure JavaScript Bilingual (Indonesian & English) G2P Engine
 *
 * Fully client-side, zero-dependency ES module.
 * Reproduces the exact phoneme representation and token framing required by ArboTTS ONNX models.
 */

import { EN_LEXICON } from "./en_dict.js";

// Framing constants
export const PAD_ID = 0;
export const BOS_ID = 1;
export const EOS_ID = 2;

// Piper punctuation marks
export const PUNCTUATION_MARKS = "!'(),-.:;?\"";

const PUNCT_REWRITE = {
  "“": '"', "”": '"',
  "‘": "'", "’": "'"
};
const PUNCT_DROPPED = new Set(["—", "–", "…"]);

const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u"]);

// Consonants longest first. Note 'ɡ' is U+0261 (LATIN SMALL LETTER SCRIPT G)
const CONSONANTS = [
  ["ngg", "ŋɡ"],
  ["ng", "ŋ"],
  ["ny", "ɲ"],
  ["sy", "ʃ"],
  ["kh", "x"],
  ["gh", "ɣ"],
  ["b", "b"], ["c", "tʃ"], ["d", "d"], ["f", "f"], ["g", "ɡ"],
  ["h", "h"], ["j", "dʒ"], ["k", "k"], ["l", "l"], ["m", "m"],
  ["n", "n"], ["p", "p"], ["q", "k"], ["r", "r"], ["s", "s"], ["t", "t"],
  ["v", "v"], ["w", "w"], ["x", "ks"], ["y", "j"], ["z", "z"],
];
const CONSONANT_MAP = Object.fromEntries(CONSONANTS);
const MAX_CONSONANT = Math.max(...CONSONANTS.map(([k]) => k.length));

const DIPHTHONGS = {
  "ai": "aɪ",
  "au": "aʊ",
  "oi": "ɔɪ",
};

const MONOPHTHONGS = {
  "a": "a", "i": "i", "o": "o", "u": "u"
};

const STRESS_PRIMARY = "ˈ";
const STRESS_SECONDARY = "ˌ";

const ONSET_CLUSTERS = new Set([
  "pr", "br", "tr", "dr", "kr", "gr", "fr", "sr", "vr",
  "pl", "bl", "kl", "gl", "fl", "sl",
]);

const PREFIX_SYLLABLES = new Set([
  "me", "mem", "men", "meng", "meny",
  "pe", "pem", "pen", "peng", "peny", "per", "pel",
  "be", "ber", "bel", "te", "ter", "ke", "se",
]);

const UNSTRESSED_WORDS = new Set(["yang", "di", "ke", "dan", "si"]);

// Lexicon for e-pepet and e-taling corrections
const OPEN_E_EXCEPTIONS = new Set([
  "sate", "tempe", "sore", "kafe", "jahe", "lele", "tante", "kue", "kode",
  "mode", "ide", "tape", "toge", "onde", "bemo", "sate-sate", "tempe-tempe"
]);

const PEPET_ROOTS = new Set([
  "dengan", "penuh", "beli", "membeli", "dibeli", "pembeli", "pembelian",
  "beri", "memberi", "diberi", "pemberian", "temu", "bertemu", "menemui",
  "kenal", "mengenal", "dikenal", "terkenal", "pegang", "memegang", "dipegang",
  "tekan", "menekan", "ditekan", "tekanan", "renang", "berenang", "perenang",
  "senin", "selasa", "kemarin", "sebentar", "sekarang", "selamat", "semoga",
  "selalu", "semua", "seperti", "sedang", "sendiri", "sembilan", "sepuluh",
  "sebelas", "seratus", "seribu", "sedikit", "tersebut", "pemerintah", "negeri",
  "beras", "kera", "tepi", "teman", "lezat", "dekat", "besar", "cepat",
  "tepat", "berat", "lebat", "tebal", "gelap", "terang", "tenang", "senang",
  "selat", "tepuk", "remuk", "belut", "semut", "leher", "lemah", "kering",
  "keluar", "kembali", "kertas", "kepala", "kelapa", "keluarga", "belum",
  "benar", "benci", "benda", "bengkok", "bentak", "bentang", "bentuk",
  "berani", "berapa", "berkas", "berkat", "bersih", "betul", "cegah",
  "cekik", "celaka", "celana", "cemburu", "cemas", "cengkeram", "cerah",
  "cerita", "cermat", "cermin", "derajat", "deras", "derita", "dermaga",
  "gedung", "geli", "gempa", "gemetar", "gerak", "geram", "gerbang", "gereja",
  "gertak", "hela", "hembus", "hening", "hentak", "henti", "jelajah",
  "jelas", "jelita", "jemput", "jemur", "jendela", "jenderal", "jengkal",
  "jengkel", "jerapah", "jerat", "jerit", "jeruk", "kelabu", "kelasi",
  "kelelawar", "keledai", "kelinci", "kelompok", "keluh", "kemari", "kemarau",
  "kemas", "kembang", "kembar", "kempa", "kempis", "kemudi", "kendali",
  "kendaraan", "kendur", "kental", "kentang", "kentut", "kenyal", "kenyang",
  "kepada", "kepal", "keping", "kepiting", "kepul", "kerak", "keramas",
  "keranjang", "kerbau", "kerikil", "keringat", "keripik", "keris", "keriting",
  "kerudung", "kerumun", "kesal", "kesan", "kesatria", "ketam", "ketat",
  "ketemu", "ketik", "ketika", "ketua", "ketuk", "ketupat", "lebah", "lebam",
  "lebar", "lebih", "lecut", "ledak", "lega", "legam", "lekat", "lekuk", "lelah",
  "lelaki", "leluasa", "lemak", "lemari", "lembab", "lembar", "lembut",
  "lempeng", "lencana", "lengah", "lengan", "lengkap", "lengkung", "lenyap",
  "lepas", "lereng", "lesu", "letak", "letup", "letus", "medan", "megah",
  "melati", "melarat", "menara", "mendarat", "menit", "mentah", "menteri",
  "merak", "merang", "merpati", "mesin", "meski", "mesra", "mewah",
  "neraka", "pedang", "pedas", "pedati", "peduli", "pegawai", "pekan",
  "pelan", "pelangi", "pelat", "pelatuk", "pelopor", "peluit", "peluk", "peluru",
  "pematang", "pemeo", "penat", "pendek", "pendekar", "pendeta", "pengantin",
  "penjara", "perahu", "perak", "perang", "perangkap", "perban", "perca",
  "percaya", "percik", "perdana", "perempuan", "pergi", "perih", "periksa",
  "perintah", "peristiwa", "perkara", "perkasa", "perlahan", "perlu",
  "permaisuri", "pernah", "perosot", "persen", "persis", "pertama", "pertiwi",
  "perut", "pesan", "pesantren", "pesat", "pesona", "petak", "petang", "petani",
  "peti", "petik", "petir", "petualang", "petunjuk", "rebah", "rebung", "rebus",
  "reda", "redam", "redup", "regan", "regang", "regu", "rehat", "rejam", "rekat",
  "rela", "relung", "remang", "remas", "remeh", "rempah", "remuk", "rencana",
  "rendah", "rendam", "rendang", "renggut", "renik", "rentan", "rentang",
  "renten", "renung", "repot", "resah", "resap", "resmi", "rezeki", "sebab",
  "sebal", "sebat", "sebelah", "seberang", "sebut", "sedap", "sedih", "sedot",
  "seduh", "segala", "segan", "segar", "segel", "segera", "segi", "seharga",
  "sehat", "sejak", "sejarah", "sejati", "sejengkal", "sejuk", "sekali",
  "sekat", "sekedar", "sekeliling", "sekejap", "sekolah", "sekoteng", "sekrup",
  "sela", "selada", "selam", "selang", "selaput", "selatan", "selempang",
  "selendang", "selenggara", "selesai", "selidik", "selimut", "selip",
  "selisih", "selokan", "selongsong", "seloroh", "seluler", "selundup", "seluruh",
  "semak", "semalam", "semangat", "semangka", "semarak", "semat", "sembah",
  "sembelih", "sembelit", "semberani", "semboyan", "sembuh", "sembunyi",
  "sembur", "semen", "semena", "semenanjung", "sementara", "semerbak", "semesta",
  "semi", "semir", "semprot", "sempurna", "semrawut", "senam", "senapan",
  "senat", "senda", "sendang", "sendu", "sengaja", "sengat", "senggol",
  "sengit", "sengketa", "seni", "seniman", "senja", "senjata", "sentak",
  "sentil", "sentimen", "sentosa", "sentra", "sentuh", "senyap", "senyum",
  "sepak", "sepakat", "sepanjang", "sepantun", "separuh", "sepat", "sepatu",
  "sepi", "sepoi", "seragam", "serah", "serai", "serak", "seram", "serambi",
  "serang", "serap", "serat", "serba", "serbak", "serban", "serbuan", "serbuk",
  "serdadu", "serentak", "sergap", "seri", "serikat", "sering", "serius",
  "serpih", "serta", "seru", "seruling", "sesak", "sesal", "sesap", "sesar",
  "sesat", "setan", "setara", "setia", "setiap", "setir", "setrika", "setrum",
  "setuju", "tebak", "tebang", "tebas", "tebat", "tebing", "tebu", "tebus",
  "teduh", "tegah", "tegar", "tegun", "tegur", "teka", "tekad", "tekat",
  "tekik", "teko", "tekuk", "tekur", "telaah", "teladan", "telaga", "telah",
  "telanjang", "telanjur", "telantar", "telap", "telapak", "telaten", "teliti",
  "telor", "teluk", "telungkup", "telunjuk", "telur", "tembaga", "tembak",
  "tembakau", "tembam", "tembelang", "tembereh", "tembereng", "tembesu",
  "tembiang", "tembikar", "tembilang", "tembuni", "tembus", "tempa", "tempat",
  "tempawan", "tempayan", "tempeh", "tempel", "temperamen", "tempias",
  "tempik", "tempo", "tempuh", "tempur", "tempurung", "tenaga", "tengadah",
  "tengger", "tengik", "tengkar", "tengking", "tengkorak", "tengku",
  "tengkulak", "tengkuk", "tengkurap", "tengok", "tengsin", "tengu", "tenis",
  "tentamen", "tentang", "tentara", "tenteng", "tenteram", "tentu", "tenun",
  "tenung", "tepak", "tepam", "tepas", "tepaut", "tepekur", "tepis", "tepung",
  "teraju", "terak", "teral", "terali", "teram", "teran", "terap", "terapung",
  "teras", "terasi", "teratai", "terawang", "terba", "terbis", "terbus", "teri",
  "teriak", "terik", "terka", "terkam", "terkapar", "terkup", "terlak",
  "terlanjur", "terlentang", "terma", "terman", "termangu", "termas", "terpa",
  "terpas", "terpaan", "terpekur", "terpencil", "terpelanting", "terpeluk",
  "terpening", "terperanjat", "terperosok", "terpesona", "terpincut", "terpuk",
  "terputus", "tersangka", "tersaput", "terselip", "tersengal", "tersenyum",
  "terserah", "tersesat", "tersiksa", "tersinggung", "tersungkur", "tertata",
  "terung", "teruntum", "terup", "terus", "tetak", "tetal", "tetampah",
  "tetamu", "tetangga", "tetap", "tetapi", "tetas", "tetes", "tetiba", "tetirah"
]);

const PEPET_PREFIXES = [
  "meng", "meny", "peng", "peny", "mem", "men", "pem", "pen",
  "ber", "ter", "per", "bel", "pel", "me", "pe", "se", "ke", "di"
];

const CLITICS = ["-nya", "-ku", "-mu", "-lah", "-kah", "-pun", "-tah"];

const UNITS = ["nol", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan"];
const SCALES = [
  [1_000_000_000, "miliar"],
  [1_000_000, "juta"],
  [1_000, "ribu"],
];

/**
 * Spells a non-negative integer in Indonesian words.
 */
export function spellNumber(value) {
  if (value < 0) return [String(value)];
  if (value < 10) return [UNITS[value]];
  if (value < 20) {
    if (value === 10) return ["sepuluh"];
    if (value === 11) return ["sebelas"];
    return [UNITS[value - 10], "belas"];
  }
  if (value < 100) {
    const tens = Math.floor(value / 10);
    const unit = value % 10;
    const words = [UNITS[tens], "puluh"];
    if (unit > 0) words.push(UNITS[unit]);
    return words;
  }
  if (value < 1000) {
    const hundreds = Math.floor(value / 100);
    const rest = value % 100;
    const words = hundreds === 1 ? ["seratus"] : [UNITS[hundreds], "ratus"];
    if (rest > 0) words.push(...spellNumber(rest));
    return words;
  }
  for (const [scale, name] of SCALES) {
    if (value >= scale) {
      const count = Math.floor(value / scale);
      const rest = value % scale;
      let words;
      if (count === 1 && name === "ribu") {
        words = ["seribu"];
      } else {
        words = [...spellNumber(count), name];
      }
      if (rest > 0) words.push(...spellNumber(rest));
      return words;
    }
  }
  return String(value).split("").map((d) => UNITS[parseInt(d, 10)]);
}

/**
 * Splits word into units [(kind, grapheme)]
 */
function getUnits(word) {
  const units = [];
  let index = 0;
  const len = word.length;

  while (index < len) {
    const char = word[index];
    if (VOWEL_LETTERS.has(char)) {
      const pair = word.slice(index, index + 2);
      if (DIPHTHONGS[pair]) {
        units.push(["V", pair]);
        index += 2;
        continue;
      }
      units.push(["V", char]);
      index += 1;
      continue;
    }

    let matched = false;
    for (let width = Math.min(MAX_CONSONANT, len - index); width > 0; width--) {
      const cand = word.slice(index, index + width);
      if (CONSONANT_MAP[cand]) {
        units.push(["C", cand]);
        index += width;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    units.push(["?", char]);
    index += 1;
  }
  return units;
}

/**
 * Syllabifies an Indonesian word.
 */
function syllabify(word) {
  const units = getUnits(word);
  const vowelIndices = [];
  for (let i = 0; i < units.length; i++) {
    if (units[i][0] === "V") vowelIndices.push(i);
  }
  if (vowelIndices.length === 0) return units.length ? [units] : [];

  const boundaries = [];
  for (let i = 0; i < vowelIndices.length - 1; i++) {
    const first = vowelIndices[i];
    const second = vowelIndices[i + 1];
    const gap = units.slice(first + 1, second);
    if (gap.length === 0) {
      boundaries.push(second);
    } else if (gap.length === 1) {
      boundaries.push(second - 1);
    } else {
      const tail = gap.slice(-2).map(([, g]) => g).join("");
      if (gap.length === 2 && ONSET_CLUSTERS.has(tail)) {
        boundaries.push(second - 2);
      } else {
        boundaries.push(second - 1);
      }
    }
  }

  const syllables = [];
  let start = 0;
  for (const b of boundaries) {
    syllables.push(units.slice(start, b));
    start = b;
  }
  syllables.push(units.slice(start));
  return syllables.filter((s) => s.length > 0);
}

/**
 * Computes stress marks for syllables.
 */
function getStressPattern(syllables, word) {
  const count = syllables.length;
  if (count === 0) return [];
  const marks = new Array(count).fill("");
  if (UNSTRESSED_WORDS.has(word)) return marks;

  const primary = count >= 2 ? count - 2 : 0;
  marks[primary] = STRESS_PRIMARY;

  const firstSpelling = syllables[0].map(([, g]) => g).join("");
  const secondary = PREFIX_SYLLABLES.has(firstSpelling) ? 1 : 0;
  if (secondary <= primary - 2) {
    marks[secondary] = STRESS_SECONDARY;
  }
  return marks;
}

function getCandidates(word) {
  let w = word.toLowerCase().trim().replace(/^[^\w]+|[^\w]+$/g, "");
  if (!w) return [];
  const candidates = [w];

  for (const cl of CLITICS) {
    if (w.endsWith(cl)) {
      const base = w.slice(0, -cl.length);
      candidates.push(base);
      w = base;
      break;
    }
  }

  if (w.includes("-")) {
    const parts = w.split("-");
    candidates.push(...parts);
    w = parts[0];
  }

  for (const pref of PEPET_PREFIXES) {
    if (w.startsWith(pref) && w.length > pref.length + 2) {
      const rem = w.slice(pref.length);
      candidates.push(rem);
      if (pref === "meng" || pref === "peng") candidates.push("k" + rem);
      else if (pref === "mem" || pref === "pem") candidates.push("p" + rem);
      else if (pref === "men" || pref === "pen") candidates.push("t" + rem);
      else if (pref === "meny" || pref === "peny") candidates.push("s" + rem);
      else if (pref === "ber" && rem.startsWith("e")) candidates.push("r" + rem.slice(1));
      break;
    }
  }
  return candidates;
}

/**
 * Convert a single word to espeak-shaped IPA with Indonesian lexical rules.
 */
function wordToIpa(word) {
  const syllables = syllabify(word);
  if (!syllables.length) return "";
  const marks = getStressPattern(syllables, word);
  const flat = syllables.flat();

  let isPepetRoot = false;
  const candidates = getCandidates(word);
  for (const c of candidates) {
    if (PEPET_ROOTS.has(c)) {
      isPepetRoot = true;
      break;
    }
  }

  const cleanWord = word.toLowerCase().trim().replace(/^[^\w]+|[^\w]+$/g, "");
  const isOpenEFinal = (cleanWord !== "ke" && cleanWord.endsWith("e") && cleanWord.length >= 3) ||
                       OPEN_E_EXCEPTIONS.has(cleanWord);

  let position = 0;
  const pieces = [];

  for (let sIdx = 0; sIdx < syllables.length; sIdx++) {
    const syllable = syllables[sIdx];
    const mark = marks[sIdx];
    const stressed = mark !== "";
    let emittedMark = false;
    const isFinalSyllable = (sIdx === syllables.length - 1);

    for (let uIdx = 0; uIdx < syllable.length; uIdx++) {
      const [kind, grapheme] = syllable[uIdx];
      const nextLetter = position + 1 < flat.length ? flat[position + 1][1] : "";
      position += 1;

      if (kind === "V") {
        if (!emittedMark) {
          pieces.push(mark);
          emittedMark = true;
        }

        if (DIPHTHONGS[grapheme]) {
          pieces.push(DIPHTHONGS[grapheme]);
        } else if (grapheme === "e") {
          if (isOpenEFinal && isFinalSyllable) {
            pieces.push("e");
          } else if (isPepetRoot) {
            pieces.push("ə");
          } else {
            pieces.push(stressed ? "ɛ" : "ə");
          }
        } else if (grapheme === "o" && nextLetter === "r") {
          pieces.push("ɔ");
        } else {
          pieces.push(MONOPHTHONGS[grapheme] || grapheme);
        }
      } else if (kind === "C") {
        pieces.push(CONSONANT_MAP[grapheme] || grapheme);
      } else {
        pieces.push(grapheme);
      }
    }
  }

  return pieces.join("");
}

/**
 * Tokenize input text.
 */
function tokenize(text) {
  const tokens = [];
  const wordRe = /[0-9]+|[^\W\d_]+/u;
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      tokens.push(["space", " "]);
      index += 1;
      continue;
    }

    const rest = text.slice(index);
    const m = rest.match(wordRe);
    if (m && m.index === 0) {
      const val = m[0];
      tokens.push([/^[0-9]/.test(val) ? "number" : "word", val]);
      index += val.length;
      continue;
    }

    if (PUNCT_REWRITE[char]) {
      tokens.push(["punct", PUNCT_REWRITE[char]]);
    } else if (PUNCT_DROPPED.has(char)) {
      // drop
    } else if (PUNCTUATION_MARKS.includes(char)) {
      tokens.push(["punct", char]);
    } else {
      tokens.push(["other", char]);
    }
    index += 1;
  }
  return tokens;
}

const EN_NUM_ONES = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
];
const EN_NUM_TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/**
 * Spell an integer number in English words.
 */
export function spellNumberEn(n) {
  if (n < 0) return ["minus", ...spellNumberEn(-n)];
  if (n < 20) return [EN_NUM_ONES[n]];
  if (n < 100) {
    const rem = n % 10;
    return rem === 0 ? [EN_NUM_TENS[Math.floor(n / 10)]] : [EN_NUM_TENS[Math.floor(n / 10)], EN_NUM_ONES[rem]];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const res = [EN_NUM_ONES[h], "hundred"];
    if (rem > 0) res.push(...spellNumberEn(rem));
    return res;
  }
  if (n < 1000000) {
    const th = Math.floor(n / 1000);
    const rem = n % 1000;
    const res = [...spellNumberEn(th), "thousand"];
    if (rem > 0) res.push(...spellNumberEn(rem));
    return res;
  }
  return [n.toString()];
}

/**
 * Convert an English word into IPA string using lexicon or rule-based fallback.
 */
export function englishWordToIpa(word) {
  const w = word.toLowerCase().trim();
  if (!w) return "";
  if (EN_LEXICON[w]) return EN_LEXICON[w];

  // Heuristic rule fallback for out-of-lexicon English words
  let ipa = w
    .replace(/tion\b/g, "ʃən")
    .replace(/sion\b/g, "ʒən")
    .replace(/cious\b/g, "ʃəs")
    .replace(/tious\b/g, "ʃəs")
    .replace(/ing\b/g, "ɪŋ")
    .replace(/ed\b/g, "d")
    .replace(/th/g, "θ")
    .replace(/sh/g, "ʃ")
    .replace(/ch/g, "tʃ")
    .replace(/ph/g, "f")
    .replace(/ee/g, "iː")
    .replace(/oo/g, "uː")
    .replace(/ea/g, "iː")
    .replace(/oa/g, "oʊ")
    .replace(/ai/g, "eɪ")
    .replace(/ay/g, "eɪ")
    .replace(/igh/g, "aɪ")
    .replace(/qu/g, "kw")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/g/g, "ɡ")
    .replace(/r/g, "ɹ")
    .replace(/a/g, "æ")
    .replace(/e/g, "ɛ")
    .replace(/i/g, "ɪ")
    .replace(/o/g, "ɒ")
    .replace(/u/g, "ʌ");
  return ipa;
}

/**
 * Phonemize text to IPA string.
 * @param {string} text - Input text
 * @param {string} lang - Language code ("id" or "en")
 */
export function phonemizeToIpa(text, lang = "id") {
  if (!text || !text.trim()) return "";
  const normalized = text.normalize("NFC");
  const tokens = tokenize(normalized);
  const pieces = [];
  const isEn = (lang === "en");

  for (const [kind, val] of tokens) {
    if (kind === "space") {
      pieces.push(" ");
    } else if (kind === "punct") {
      pieces.push(val);
    } else if (kind === "number") {
      const numVal = parseInt(val, 10);
      if (isEn) {
        const words = spellNumberEn(isNaN(numVal) ? 0 : numVal);
        pieces.push(words.map((w) => englishWordToIpa(w)).join(" "));
      } else {
        const words = spellNumber(isNaN(numVal) ? 0 : numVal);
        pieces.push(words.map((w) => wordToIpa(w)).join(" "));
      }
    } else if (kind === "word") {
      if (isEn) {
        pieces.push(englishWordToIpa(val));
      } else {
        pieces.push(wordToIpa(val.toLowerCase()));
      }
    }
  }

  return pieces.join("").replace(/ {2,}/g, " ").trim();
}

/**
 * Convert text into phoneme IDs array for ArboTTS ONNX models.
 * @param {string} text - Input text
 * @param {Record<string, number[]>} phonemeIdMap - Mapping from symbol to [id] from *.onnx.json
 * @param {string} lang - Language code ("id" or "en")
 * @returns {BigInt64Array} Formatted phoneme token IDs
 */
export function textToPhonemeIds(text, phonemeIdMap, lang = "id") {
  const ipa = phonemizeToIpa(text, lang);
  if (!ipa) return new BigInt64Array([BigInt(BOS_ID), BigInt(PAD_ID), BigInt(EOS_ID)]);

  // Normalize to NFD decomposing codepoints
  const symbols = Array.from(ipa.normalize("NFD"));

  // Build standard Piper framing: BOS, PAD, (id, PAD)..., EOS
  const ids = [BigInt(BOS_ID), BigInt(PAD_ID)];

  for (const sym of symbols) {
    const entry = phonemeIdMap[sym];
    if (entry && entry.length > 0) {
      ids.push(BigInt(entry[0]));
      ids.push(BigInt(PAD_ID));
    }
  }

  ids.push(BigInt(EOS_ID));
  return new BigInt64Array(ids);
}
