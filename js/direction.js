const API_BASE = "https://api.alquran.cloud/v1";
const AUDIO_BASE = "https://cdn.islamic.network/quran/audio/128/ar.alafasy";
const AYAHS_PER_PAGE = 10;
const surahSelect = document.getElementById("surah-select");
const surahPicker = document.getElementById("surah-picker");
const surahSearch = document.getElementById("surah-search");
const surahOptions = document.getElementById("surah-options");
const ayahRangeSelect = document.getElementById("ayah-range");
const surahInformation = document.getElementById("surah-information");
const surahEnglishName = document.getElementById("surah-english-name");
const surahIndonesianName = document.getElementById("surah-indonesian-name");
const surahDetail = document.getElementById("surah-detail");
const surahArabicName = document.getElementById("surah-arabic-name");
const readingRangeLabel = document.getElementById("reading-range-label");
const readingProgress = document.getElementById("reading-progress");
const readingProgressBar = document.getElementById("reading-progress-bar");
const ayahList = document.getElementById("ayah-list");
const previousRangeButton = document.getElementById("previous-range");
const nextRangeButton = document.getElementById("next-range");
const quranStatus = document.getElementById("quran-status");

let surahList = [];
let currentSurah = null;
let currentAyahs = [];
let currentRange = 0;
let activeAudio = null;
let activeAudioButton = null;

// HELPER
function createElement(tag, className = "", text = "") {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== "") {
    element.textContent = text;
  }

  return element;
}

function setStatus(message, type = "default") {
  if (!quranStatus) return;

  quranStatus.textContent = message;

  quranStatus.classList.remove("hidden", "text-red-500", "text-primary");

  if (type === "error") {
    quranStatus.classList.add("text-red-500");
  } else {
    quranStatus.classList.add("text-primary");
  }
}

function hideStatus() {
  if (!quranStatus) return;

  quranStatus.textContent = "";
  quranStatus.classList.add("hidden");
}

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Gagal mengambil data Al-Qur'an.");
  }

  const result = await response.json();

  if (result.code !== 200 || !result.data) {
    throw new Error("Data Al-Qur'an tidak tersedia.");
  }

  return result.data;
}

// REMOVE BASMALAH
function normalizeArabic(text) {
  return text
    .normalize("NFKC")
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/gu, "")
    .replace(/[ٱأإآ]/gu, "ا")
    .replace(/[ى]/gu, "ي")
    .replace(/[ؤ]/gu, "و")
    .replace(/[ئ]/gu, "ي")
    .replace(/\s+/gu, " ")
    .trim();
}

function removeBasmalahPrefix(text) {
  if (!text || typeof text !== "string") return text;

  const normalizedBasmalah = normalizeArabic(
    "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  );

  let normalizedText = "";
  const originalIndexes = [];

  for (let i = 0; i < text.length; i++) {
    const character = text[i];

    if (
      /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/u.test(character)
    ) {
      continue;
    }

    if (/\s/u.test(character)) {
      normalizedText += " ";
      originalIndexes.push(i);
      continue;
    }

    let normalizedCharacter = character
      .normalize("NFKC")
      .replace(/[ٱأإآ]/gu, "ا")
      .replace(/[ى]/gu, "ي")
      .replace(/[ؤ]/gu, "و")
      .replace(/[ئ]/gu, "ي");

    normalizedText += normalizedCharacter;
    originalIndexes.push(i);
  }

  const normalized = normalizedText.trimStart();

  if (!normalized.startsWith(normalizedBasmalah)) {
    return text;
  }

  const lastNormalizedIndex =
    normalizedText.indexOf(normalizedBasmalah) + normalizedBasmalah.length - 1;

  const originalEndIndex = originalIndexes[lastNormalizedIndex];

  if (originalEndIndex === undefined) {
    return text;
  }

  const nextCharacter = text[originalEndIndex + 1];

  if (
    nextCharacter &&
    !/\s/u.test(nextCharacter) &&
    !/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/u.test(nextCharacter)
  ) {
    return text;
  }

  return text.slice(originalEndIndex + 1).trimStart();
}

function getDisplayedArabicText(ayah) {
  if (!currentSurah || !ayah) return ayah?.text || "";

  const isFirstAyah = ayah.numberInSurah === 1;

  const shouldKeepBasmalah =
    currentSurah.number === 1 || currentSurah.number === 9;

  if (!isFirstAyah || shouldKeepBasmalah) {
    return ayah.text;
  }

  return removeBasmalahPrefix(ayah.text);
}

// LOAD SURAH LIST
async function loadSurahList() {
  if (!surahSelect) return;

  try {
    setStatus("Sedang memuat daftar surah...");

    surahList = await fetchJSON(`${API_BASE}/surah`);

    surahSelect.innerHTML = "";

    const defaultOption = createElement("option", "", "Pilih surah");

    defaultOption.value = "";
    defaultOption.disabled = true;
    defaultOption.selected = true;

    surahSelect.appendChild(defaultOption);

    surahList.forEach((surah) => {
      const option = createElement(
        "option",
        "",
        `${surah.number}. ${surah.englishName}`,
      );

      option.value = surah.number;

      surahSelect.appendChild(option);
    });

    hideStatus();
  } catch (error) {
    console.error("Gagal memuat daftar surah:", error);
    setStatus(
      "Daftar surah gagal dimuat. Silakan periksa koneksi internet.",
      "error",
    );
  }
}

// SURAH SEARCH DROPDOWN
function renderSurahOptions(keyword = "") {
  if (!surahOptions) return;

  surahOptions.innerHTML = "";

  const searchTerm = keyword.trim().toLowerCase();

  const filteredSurahs = surahList.filter((surah) => {
    const name = surah.englishName.toLowerCase();
    const number = String(surah.number);

    return name.includes(searchTerm) || number.includes(searchTerm);
  });

  if (!filteredSurahs.length) {
    const emptyMessage = createElement(
      "div",
      "px-3 py-3 text-xs text-black",
      "Surah tidak ditemukan",
    );

    surahOptions.appendChild(emptyMessage);
    return;
  }

  filteredSurahs.forEach((surah) => {
    const option = createElement(
      "button",
      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-black transition hover:bg-primary-light",
    );

    option.type = "button";
    option.role = "option";
    option.dataset.number = surah.number;

    const number = createElement(
      "span",
      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-white",
      surah.number,
    );

    const name = createElement("span", "font-semibold", surah.englishName);

    option.append(number, name);

    option.addEventListener("click", () => {
      selectSurah(surah);
    });

    surahOptions.appendChild(option);
  });
}

function openSurahDropdown() {
  if (!surahOptions || !surahSearch) return;

  renderSurahOptions(surahSearch.value);

  surahOptions.classList.remove("hidden");
  surahSearch.setAttribute("aria-expanded", "true");
}

function closeSurahDropdown() {
  if (!surahOptions || !surahSearch) return;

  surahOptions.classList.add("hidden");
  surahSearch.setAttribute("aria-expanded", "false");
}

function selectSurah(surah) {
  if (!surahSelect || !surahSearch) return;

  surahSelect.value = String(surah.number);
  surahSearch.value = `${surah.number}. ${surah.englishName}`;

  closeSurahDropdown();

  // Memicu event change yang sudah digunakan sebelumnya.
  surahSelect.dispatchEvent(new Event("change", { bubbles: true }));
}

// SURAH INFORMATION
function updateSurahInformation() {
  if (!currentSurah || !surahInformation) return;

  surahInformation.classList.remove("hidden");
  surahInformation.classList.add("flex");

  if (surahEnglishName) {
    surahEnglishName.textContent = "NAMA SURAH";
  }

  if (surahIndonesianName) {
    surahIndonesianName.textContent = `Surah ${currentSurah.englishName}`;
  }

  if (surahArabicName) {
    surahArabicName.textContent = currentSurah.name;
  }

  if (surahDetail) {
    const revelation =
      currentSurah.revelationType === "Meccan" ? "Makkiyah" : "Madaniyah";

    surahDetail.textContent = `${currentSurah.numberOfAyahs} ayat · ${revelation}`;
  }
}

// LOAD SURAH AYAT
async function loadSurah(number) {
  try {
    setStatus("Sedang memuat ayat Al-Qur'an...");

    ayahList.innerHTML = "";

    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }

    const [arabicData, translationData] = await Promise.all([
      fetchJSON(
        `${API_BASE}/surah/${number}/editions/quran-uthmani,id.indonesian`,
      ),
    ]);

    const editions = await fetchJSON(
      `${API_BASE}/surah/${number}/editions/quran-uthmani,id.indonesian,en.transliteration`,
    );

    const arabicSurah = editions[0];
    const translationSurah = editions[1];
    const transliterationSurah = editions[2];

    if (!arabicSurah || !translationSurah || !transliterationSurah) {
      throw new Error("Data surah tidak lengkap.");
    }

    currentSurah = arabicSurah;

    currentAyahs = arabicSurah.ayahs.map((ayah, index) => ({
      ...ayah,
      translation: translationSurah.ayahs[index]?.text || "",
      transliteration: transliterationSurah.ayahs[index]?.text || "",
    }));

    currentRange = 0;

    updateSurahInformation();
    createRangeOptions();
    renderAyahs();

    hideStatus();
  } catch (error) {
    console.error("Gagal memuat surah:", error);

    setStatus("Surah gagal dimuat. Silakan coba kembali.", "error");
  }
}

// RANGE OPTIONS
function getTotalRanges() {
  return Math.ceil(currentAyahs.length / AYAHS_PER_PAGE);
}

function getCurrentRange() {
  const start = currentRange * AYAHS_PER_PAGE;
  const end = Math.min(start + AYAHS_PER_PAGE, currentAyahs.length);

  return {
    start,
    end,
    ayahs: currentAyahs.slice(start, end),
  };
}

function createRangeOptions() {
  if (!ayahRangeSelect) return;

  ayahRangeSelect.innerHTML = "";

  const totalRanges = getTotalRanges();

  for (let i = 0; i < totalRanges; i++) {
    const start = i * AYAHS_PER_PAGE + 1;
    const end = Math.min((i + 1) * AYAHS_PER_PAGE, currentAyahs.length);

    const option = createElement("option", "", `Ayat ${start}–${end}`);

    option.value = i;

    ayahRangeSelect.appendChild(option);
  }

  ayahRangeSelect.value = "0";

  ayahRangeSelect.disabled = false;
}

//  READING PROGRESS
function updateReadingProgress() {
  if (!currentSurah) return;

  const totalRanges = getTotalRanges();
  const { start, end } = getCurrentRange();

  const percentage = (end / currentSurah.numberOfAyahs) * 100;

  if (readingRangeLabel) {
    readingRangeLabel.textContent = `Ayat ${start + 1}–${end} dari ${currentSurah.numberOfAyahs}`;
  }

  if (readingProgress) {
    readingProgress.textContent = `${Math.round(percentage)}%`;
  }

  if (readingProgressBar) {
    readingProgressBar.style.width = `${percentage}%`;
  }

  if (previousRangeButton) {
    previousRangeButton.disabled = currentRange === 0;
  }

  if (nextRangeButton) {
    nextRangeButton.disabled = currentRange >= totalRanges - 1;
  }
}

// AUDIO
function stopActiveAudio() {
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }

  if (activeAudioButton) {
    activeAudioButton.disabled = false;
    activeAudioButton.classList.remove("opacity-50");
    activeAudioButton = null;
  }
}

function playAyahAudio(ayah, button) {
  stopActiveAudio();

  const audio = new Audio(`${AUDIO_BASE}/${ayah.number}.mp3`);

  activeAudio = audio;
  activeAudioButton = button;

  button.disabled = true;
  button.classList.add("opacity-50");

  function resetAudio() {
    if (activeAudio === audio) {
      activeAudio = null;
      activeAudioButton = null;
    }

    button.disabled = false;
    button.classList.remove("opacity-50");
  }

  audio.addEventListener("ended", resetAudio, { once: true });

  audio.addEventListener(
    "error",
    () => {
      resetAudio();
      console.error("Audio ayat gagal dimuat.");
    },
    { once: true },
  );

  audio.play().catch((error) => {
    console.error("Gagal memutar audio:", error);
    resetAudio();
  });
}

// RENDER AYATS
function renderAyahs() {
  if (!ayahList || !currentSurah || !currentAyahs.length) {
    return;
  }

  stopActiveAudio();

  ayahList.innerHTML = "";

  const { ayahs } = getCurrentRange();

  ayahs.forEach((ayah) => {
    const ayahCard = createElement(
      "article",
      "border-b border-primary/10 py-8 last:border-b-0",
    );

    // Header ayat
    const ayahHeader = createElement(
      "div",
      "mb-6 flex items-center justify-between gap-4",
    );

    const ayahNumber = createElement(
      "span",
      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-light text-sm font-bold text-primary-dark",
      ayah.numberInSurah.toString(),
    );

    const audioButton = createElement(
      "button",
      "flex h-10 w-10 shrink-0 items-center justify-center text-primary transition hover:scale-110",
    );

    audioButton.type = "button";
    audioButton.setAttribute("aria-label", "Putar audio ayat");

    audioButton.innerHTML = `
    <svg
        class="h-6 w-6"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
    >
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
    </svg>
    `;

    audioButton.addEventListener("click", () => {
      playAyahAudio(ayah, audioButton);
    });

    ayahHeader.append(ayahNumber, audioButton);

    const arabicText = createElement(
      "p",
      "mb-7 text-right font-serif text-[27px] leading-[2.3] text-[#173B32] sm:text-3xl md:text-[36px]",
    );

    arabicText.dir = "rtl";
    arabicText.lang = "ar";

    arabicText.textContent = getDisplayedArabicText(ayah);

    const latinText = createElement(
      "p",
      "mb-4 text-sm leading-8 text-primary font-medium md:text-base",
      ayah.transliteration,
    );

    latinText.lang = "id-Latn";

    const translation = createElement(
      "p",
      "text-sm leading-8 text-black/65 md:text-base",
      ayah.translation,
    );

    translation.lang = "id";

    ayahCard.append(ayahHeader, arabicText, latinText, translation);

    ayahList.appendChild(ayahCard);
  });

  updateReadingProgress();
}

// CHANGE RANGE
function changeRange(rangeIndex) {
  if (!currentAyahs.length) return;

  const totalRanges = getTotalRanges();

  if (rangeIndex < 0 || rangeIndex >= totalRanges) {
    return;
  }

  currentRange = rangeIndex;

  if (ayahRangeSelect) {
    ayahRangeSelect.value = String(currentRange);
  }

  renderAyahs();
}

// EVENT LISTENERS
function initializeEvents() {
  surahSelect?.addEventListener("change", (event) => {
    const surahNumber = Number(event.target.value);

    if (!surahNumber) return;

    const selectedSurah = surahList.find(
      (surah) => surah.number === surahNumber,
    );

    if (!selectedSurah) return;

    loadSurah(surahNumber);
  });

  ayahRangeSelect?.addEventListener("change", (event) => {
    changeRange(Number(event.target.value));
  });

  previousRangeButton?.addEventListener("click", () => {
    changeRange(currentRange - 1);
  });

  nextRangeButton?.addEventListener("click", () => {
    changeRange(currentRange + 1);
  });

  // Surah Search
  surahSearch?.addEventListener("focus", () => {
    openSurahDropdown();
  });

  surahSearch?.addEventListener("input", () => {
    openSurahDropdown();
  });

  surahSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSurahDropdown();
      surahSearch.blur();
    }
  });

  // Tutup dropdown ketika klik di luar area pencarian.
  document.addEventListener("click", (event) => {
    if (surahPicker && !surahPicker.contains(event.target)) {
      closeSurahDropdown();
    }
  });
}

// INITIALIZATION
async function initializeQuranReader() {
  if (!surahSelect || !ayahRangeSelect || !ayahList) {
    console.error("Elemen pembaca Al-Qur'an tidak ditemukan. Periksa ID HTML.");

    return;
  }

  initializeEvents();
  await loadSurahList();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeQuranReader, {
    once: true,
  });
} else {
  initializeQuranReader();
}
