// ELEMENTS
const citySelect = document.getElementById("provinsi-select");
const locationPicker = document.getElementById("locationPicker");
const locationSearch = document.getElementById("locationSearch");
const locationOptions = document.getElementById("locationOptions");
const loadButton = document.getElementById("load-schedule");
const scheduleBody = document.getElementById("jadwal-body");
const scheduleStatus = document.getElementById("schedule-status");
const selectedCity = document.getElementById("judul-jadwal");
const downloadButton = document.getElementById("downloadButton");
const shareButton = document.getElementById("shareButton");
const shareMenu = document.getElementById("shareMenu");
const API_REGION = "https://www.emsifa.com/api-wilayah-indonesia/v2";
const API_ALADHAN = "https://api.aladhan.com/v1";
const API_NOMINATIM = "https://nominatim.openstreetmap.org/search";
const RAMADAN_YEAR = 2027;
const RAMADAN_MONTHS = [2, 3];
const PRAYER_METHOD = 20;
const REGION_CACHE_KEY = "ramadan2027_indonesia_regions";
const REGION_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000;
const COORDINATE_CACHE_PREFIX = "ramadan2027_coordinates_";
const COORDINATE_CACHE_DURATION = 180 * 24 * 60 * 60 * 1000;

let lastGeocodingRequest = 0;
let currentSchedule = [];
let currentRegion = null;

// GENERAL HELPERS
function cleanTime(value) {
  return value ? String(value).split(" ")[0] : "--:--";
}

function setStatus(message, state = "") {
  if (!scheduleStatus) return;

  scheduleStatus.textContent = message;
  scheduleStatus.dataset.state = state;

  scheduleStatus.classList.toggle("text-red-600", state === "error");
  scheduleStatus.classList.toggle("text-[#829487]", state !== "error");
}

function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character],
  );
}

async function fetchJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Permintaan gagal dengan status ${response.status}`);
  }

  return response.json();
}

function getCachedData(key, duration) {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) return null;

    const cached = JSON.parse(raw);

    if (!cached.timestamp || Date.now() - cached.timestamp > duration) {
      localStorage.removeItem(key);
      return null;
    }

    return cached.data;
  } catch {
    return null;
  }
}

function saveCachedData(key, data) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      }),
    );
  } catch (error) {
    console.warn("Cache tidak dapat disimpan:", error);
  }
}

// LOAD INDONESIA REGIONS
async function fetchIndonesiaRegions() {
  const cachedRegions = getCachedData(REGION_CACHE_KEY, REGION_CACHE_DURATION);

  if (cachedRegions?.length) {
    return cachedRegions;
  }

  setStatus("Mengambil daftar provinsi Indonesia...");

  const provinceResponse = await fetchJSON(`${API_REGION}/provinces.json`);

  const provinces = Array.isArray(provinceResponse)
    ? provinceResponse
    : provinceResponse.data || [];

  if (!provinces.length) {
    throw new Error("Daftar provinsi tidak ditemukan.");
  }

  setStatus(`Memuat kabupaten dan kota dari ${provinces.length} provinsi...`);

  const results = await Promise.allSettled(
    provinces.map(async (province) => {
      const response = await fetchJSON(
        `${API_REGION}/regencies/${province.id}.json`,
      );

      const regencies = Array.isArray(response)
        ? response
        : response.data || [];

      return {
        province,
        regencies,
      };
    }),
  );

  const regionGroups = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((group) => group.regencies.length > 0);

  if (!regionGroups.length) {
    throw new Error("Daftar kabupaten/kota gagal dimuat.");
  }

  saveCachedData(REGION_CACHE_KEY, regionGroups);

  return regionGroups;
}

function renderRegionOptions(regionGroups) {
  citySelect.innerHTML = "";

  const placeholder = document.createElement("option");

  placeholder.value = "";
  placeholder.textContent = "Pilih Kota / Kabupaten";
  placeholder.disabled = true;
  placeholder.selected = true;

  citySelect.appendChild(placeholder);

  let totalRegions = 0;

  regionGroups.forEach(({ province, regencies }) => {
    const optgroup = document.createElement("optgroup");

    optgroup.label = province.name;

    regencies.forEach((regency) => {
      const option = document.createElement("option");

      option.value = regency.id;
      option.textContent = regency.name;
      option.dataset.province = province.name;
      option.dataset.regionId = regency.id;

      optgroup.appendChild(option);

      totalRegions += 1;
    });

    citySelect.appendChild(optgroup);
  });

  // Prioritaskan wilayah Jakarta sebagai pilihan awal.
  const jakartaOption = Array.from(citySelect.options).find(
    (option) =>
      option.dataset.province === "DKI Jakarta" &&
      /Jakarta Pusat/i.test(option.textContent),
  );

  if (jakartaOption) {
    citySelect.value = jakartaOption.value;
  } else {
    const firstRegion = citySelect.querySelector("optgroup option");

    if (firstRegion) {
      citySelect.value = firstRegion.value;
    }
  }

  updateSelectedRegion();
  syncLocationSearchValue();

  setStatus(
    `${totalRegions} pilihan kabupaten/kota dari ${regionGroups.length} provinsi.`,
  );
}

// SEARCHABLE LOCATION DROPDOWN
function syncLocationSearchValue() {
  if (!citySelect || !locationSearch) return;

  const selectedOption = citySelect.selectedOptions[0];

  locationSearch.value =
    selectedOption && selectedOption.value
      ? selectedOption.textContent.trim()
      : "";
}

function renderLocationOptions(keyword = "") {
  if (!citySelect || !locationOptions) return;

  const searchTerm = keyword.trim().toLowerCase();

  locationOptions.innerHTML = "";

  let totalResults = 0;

  Array.from(citySelect.querySelectorAll("optgroup")).forEach((group) => {
    const matchingOptions = Array.from(group.querySelectorAll("option")).filter(
      (option) => {
        const searchableText =
          `${option.textContent} ${group.label}`.toLowerCase();

        return searchableText.includes(searchTerm);
      },
    );

    if (!matchingOptions.length) return;

    const groupWrapper = document.createElement("div");

    const groupLabel = document.createElement("p");
    groupLabel.className =
      "px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#829487]";
    groupLabel.textContent = group.label;

    groupWrapper.appendChild(groupLabel);

    matchingOptions.forEach((option) => {
      const button = document.createElement("button");

      button.type = "button";
      button.role = "option";
      button.className =
        "block w-full rounded px-3 py-2.5 text-left text-xs font-medium text-[#294C3E] transition hover:bg-[#EAF6EF] hover:text-primary";
      button.textContent = option.textContent.trim();

      button.setAttribute(
        "aria-selected",
        String(option.value === citySelect.value),
      );

      button.addEventListener("click", () => {
        citySelect.value = option.value;
        syncLocationSearchValue();
        closeLocationDropdown();

        citySelect.dispatchEvent(new Event("change", { bubbles: true }));
      });

      groupWrapper.appendChild(button);
      totalResults += 1;
    });

    locationOptions.appendChild(groupWrapper);
  });

  if (totalResults === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.className = "px-3 py-4 text-center text-xs text-[#829487]";
    emptyMessage.textContent = "Lokasi tidak ditemukan.";

    locationOptions.appendChild(emptyMessage);
  }
}

function openLocationDropdown() {
  if (!locationOptions || !locationSearch) return;

  locationOptions.classList.remove("hidden");
  locationSearch.setAttribute("aria-expanded", "true");

  renderLocationOptions();
}

function closeLocationDropdown() {
  if (!locationOptions || !locationSearch) return;

  locationOptions.classList.add("hidden");
  locationSearch.setAttribute("aria-expanded", "false");
  syncLocationSearchValue();
}

// LOCATION SEARCH EVENTS
locationSearch?.addEventListener("focus", () => {
  locationSearch.value = "";
  openLocationDropdown();
});

locationSearch?.addEventListener("click", () => {
  openLocationDropdown();
});

locationSearch?.addEventListener("input", () => {
  openLocationDropdown();
  renderLocationOptions(locationSearch.value);
});

locationSearch?.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeLocationDropdown();
    locationSearch.blur();
  }
});

document.addEventListener("click", (event) => {
  if (locationPicker && !locationPicker.contains(event.target)) {
    closeLocationDropdown();
  }
});

async function loadIndonesiaCities() {
  if (!citySelect) return;

  citySelect.innerHTML = `
    <option value="">Memuat daftar wilayah Indonesia...</option>
  `;

  try {
    const regionGroups = await fetchIndonesiaRegions();

    renderRegionOptions(regionGroups);
  } catch (error) {
    console.error("Gagal memuat daftar wilayah:", error);

    citySelect.innerHTML = `
      <option value="">Gagal memuat wilayah</option>
    `;

    setStatus(
      "Daftar wilayah gagal dimuat. Periksa koneksi internet, lalu muat ulang halaman.",
      "error",
    );
  }
}

// SELECTED REGION
function getSelectedRegion() {
  const option = citySelect?.selectedOptions?.[0];

  if (!option || !option.value) {
    throw new Error("Silakan pilih kota atau kabupaten.");
  }

  return {
    id: option.dataset.regionId,
    name: option.textContent.trim(),
    province: option.dataset.province,
  };
}

function updateSelectedRegion() {
  if (!citySelect || !selectedCity) return;

  const option = citySelect.selectedOptions[0];

  if (!option || !option.value) {
    selectedCity.textContent = "JADWAL IMSAKIYAH";
    return;
  }

  selectedCity.textContent = option.textContent.toUpperCase();
}

citySelect?.addEventListener("change", () => {
  updateSelectedRegion();
  syncLocationSearchValue();

  currentSchedule = [];
  currentRegion = null;

  scheduleBody.innerHTML = `
    <tr>
      <td colspan="8" class="p-6 text-center">
        Klik tombol Tampilkan Jadwal untuk memuat jadwal wilayah ini.
      </td>
    </tr>
  `;

  setStatus("Wilayah dipilih. Klik Tampilkan Jadwal untuk melanjutkan.");
});

// GEOCODING - OPENSTREETMAP NOMINATIM
function getCoordinateCacheKey(region) {
  return COORDINATE_CACHE_PREFIX + String(region.id);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function geocodeRegion(region) {
  const cacheKey = getCoordinateCacheKey(region);

  const cachedCoordinates = getCachedData(cacheKey, COORDINATE_CACHE_DURATION);

  if (
    cachedCoordinates &&
    Number.isFinite(cachedCoordinates.latitude) &&
    Number.isFinite(cachedCoordinates.longitude)
  ) {
    return {
      ...cachedCoordinates,
      fromCache: true,
    };
  }

  // membatasi penggunaan publik maksimal 1 request/detik.
  const elapsed = Date.now() - lastGeocodingRequest;

  if (elapsed < 1100) {
    await wait(1100 - elapsed);
  }

  const query = [region.name, region.province, "Indonesia"].join(", ");

  const url = new URL(API_NOMINATIM);

  url.search = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "id",
    addressdetails: "1",
  }).toString();

  lastGeocodingRequest = Date.now();

  const results = await fetchJSON(url);

  if (!Array.isArray(results) || !results.length) {
    throw new Error(`Koordinat untuk ${region.name} tidak ditemukan.`);
  }

  const result = results[0];

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Koordinat wilayah tidak valid.");
  }

  const coordinates = {
    latitude,
    longitude,
    displayName: result.display_name || query,
  };

  saveCachedData(cacheKey, coordinates);

  return {
    ...coordinates,
    fromCache: false,
  };
}

// ALADHAN API - CALENDAR BY COORDINATES
async function fetchMonthByCoordinates(year, month, latitude, longitude) {
  const url = new URL(`${API_ALADHAN}/calendar/${year}/${month}`);

  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    method: String(PRAYER_METHOD),
  }).toString();

  const payload = await fetchJSON(url);

  if (payload.code !== 200 || !Array.isArray(payload.data)) {
    throw new Error("AlAdhan tidak mengembalikan data kalender yang valid.");
  }

  return payload.data;
}

// ALADHAN API - FALLBACK BY ADDRESS
async function fetchMonthByAddress(year, month, region) {
  const address = [region.name, region.province, "Indonesia"].join(", ");

  const url = new URL(`${API_ALADHAN}/calendarByAddress/${year}/${month}`);

  url.search = new URLSearchParams({
    address,
    method: String(PRAYER_METHOD),
  }).toString();

  const payload = await fetchJSON(url);

  if (payload.code !== 200 || !Array.isArray(payload.data)) {
    throw new Error("AlAdhan tidak dapat menemukan jadwal berdasarkan alamat.");
  }

  return payload.data;
}

// FETCH RAMADAN CALENDAR
async function fetchRamadanCalendar(region) {
  let monthlyData = [];
  let source = "coordinates";
  let coordinateInfo = null;

  try {
    setStatus(`Mencari koordinat ${region.name} melalui OpenStreetMap...`);

    coordinateInfo = await geocodeRegion(region);

    setStatus(`Koordinat ditemukan. Mengambil jadwal salat ${region.name}...`);

    const results = await Promise.all(
      RAMADAN_MONTHS.map((month) =>
        fetchMonthByCoordinates(
          RAMADAN_YEAR,
          month,
          coordinateInfo.latitude,
          coordinateInfo.longitude,
        ),
      ),
    );

    monthlyData = results.flat();
  } catch (coordinateError) {
    console.warn("Metode koordinat gagal, mencoba alamat:", coordinateError);

    source = "address";

    setStatus(
      "Koordinat tidak dapat digunakan. Mencoba pencarian alamat melalui AlAdhan...",
    );

    const results = await Promise.all(
      RAMADAN_MONTHS.map((month) =>
        fetchMonthByAddress(RAMADAN_YEAR, month, region),
      ),
    );

    monthlyData = results.flat();
  }

  const ramadanDays = monthlyData
    .filter((day) => Number(day.date?.hijri?.month?.number) === 9)
    .sort(
      (a, b) =>
        Number(a.date?.hijri?.day || 0) - Number(b.date?.hijri?.day || 0),
    );

  return {
    days: ramadanDays,
    source,
    coordinateInfo,
  };
}

// RENDER SCHEDULE
function renderRows(days) {
  if (!days.length) {
    scheduleBody.innerHTML = `
      <tr>
        <td colspan="8" class="p-6 text-center">
          Data jadwal Ramadan 1448 H belum ditemukan.
        </td>
      </tr>
    `;

    return;
  }

  scheduleBody.innerHTML = days
    .map((day, index) => {
      const timings = day.timings || {};
      const hijri = day.date?.hijri;

      const hijriDate = hijri
        ? `${hijri.day} ${hijri.month?.en || "Ramadan"} ${hijri.year} H`
        : `Hari ${index + 1}`;

      return `
        <tr class="group border-b border-[#EDF0E9] text-center text-white transition hover:bg-accent hover:text-primary hover:font-bold">
          <td class="p-4 text-white  group-hover:text-primary">
            ${index + 1}
          </td>

          <td class="sticky left-0 z-10 bg-primary group-hover:bg-transparent p-4 text-white group-hover:text-primary lg:static">
            ${escapeHTML(hijriDate)}
          </td>

          <td class="p-4 text-white  group-hover:text-primary">
            ${escapeHTML(cleanTime(timings.Imsak))}
          </td>

          <td class="p-4 text-white  group-hover:text-primary">
            ${escapeHTML(cleanTime(timings.Fajr))}
          </td>

          <td class="p-4 text-white  group-hover:text-primary">
            ${escapeHTML(cleanTime(timings.Dhuhr))}
          </td>

          <td class="p-4 text-white  group-hover:text-primary">
            ${escapeHTML(cleanTime(timings.Asr))}
          </td>

          <td class="p-4 text-white  group-hover:text-primary">
            ${escapeHTML(cleanTime(timings.Maghrib))}
          </td>

          <td class="p-4 text-white  group-hover:text-primary">
            ${escapeHTML(cleanTime(timings.Isha))}
          </td>
        </tr>
      `;
    })
    .join("");
}

// LOAD SCHEDULE
async function loadSchedule() {
  if (!citySelect || !loadButton || !scheduleBody) {
    return;
  }

  let region;

  try {
    region = getSelectedRegion();
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }

  currentSchedule = [];
  currentRegion = region;

  loadButton.disabled = true;
  loadButton.textContent = "Memuat jadwal...";

  scheduleBody.innerHTML = `
    <tr>
      <td colspan="8" class="p-6 text-center">
        Sedang mengambil jadwal imsakiyah...
      </td>
    </tr>
  `;

  updateSelectedRegion();

  try {
    const result = await fetchRamadanCalendar(region);

    currentSchedule = result.days;

    renderRows(currentSchedule);

    if (!currentSchedule.length) {
      setStatus(
        "Jadwal Ramadan 1448 H tidak ditemukan untuk wilayah ini.",
        "error",
      );

      return;
    }

    const sourceMessage =
      result.source === "coordinates"
        ? "berdasarkan koordinat wilayah"
        : "berdasarkan alamat wilayah (fallback)";

    setStatus(
      `Jadwal ${region.name}, ${region.province} berhasil dimuat (${currentSchedule.length} hari), ${sourceMessage}. Metode perhitungan Kemenag RI.`,
    );
  } catch (error) {
    console.error("Gagal memuat jadwal imsakiyah:", error);

    scheduleBody.innerHTML = `
      <tr>
        <td colspan="8" class="p-6 text-center">
          Jadwal gagal dimuat. Silakan periksa koneksi internet dan coba kembali.
        </td>
      </tr>
    `;

    setStatus(`Gagal memuat jadwal ${region.name}. ${error.message}`, "error");
  } finally {
    loadButton.disabled = false;

    loadButton.innerHTML = `
      Tampilkan Jadwal
    `;
  }
}

loadButton?.addEventListener("click", loadSchedule);

// DOWNLOAD SCHEDULE - PDF
async function downloadSchedule() {
  const mainContent = document.getElementById("jadwal");

  if (!currentSchedule.length || !currentRegion) {
    setStatus("Muat jadwal terlebih dahulu sebelum mengunduh.", "error");

    return;
  }

  if (!mainContent) {
    setStatus("Konten jadwal tidak ditemukan.", "error");
    return;
  }

  if (typeof html2pdf === "undefined") {
    setStatus("Library PDF gagal dimuat. Silakan coba kembali.", "error");

    return;
  }

  if (downloadButton) {
    downloadButton.disabled = true;
  }

  try {
    const safeName = currentRegion.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const options = {
      margin: [8, 8, 8, 8],

      filename: `jadwal-imsakiyah-${safeName}-ramadan-2027.pdf`,

      image: {
        type: "jpeg",
        quality: 0.98,
      },

      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#f0faf5",
        scrollX: 0,
        scrollY: 0,

        onclone: (clonedDocument) => {
          const clonedWrapper = clonedDocument.getElementById(
            "scheduleTableWrapper",
          );

          if (clonedWrapper) {
            clonedWrapper.style.maxHeight = "none";
            clonedWrapper.style.height = "auto";
            clonedWrapper.style.overflow = "visible";
          }
        },

        ignoreElements: (element) => element.id === "share",
      },

      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "landscape",
      },

      pagebreak: {
        mode: ["css", "legacy"],
      },
    };

    await html2pdf().set(options).from(mainContent).save();

    setStatus("Jadwal berhasil diunduh dalam format PDF.");
  } catch (error) {
    console.error("Gagal membuat PDF:", error);

    setStatus("PDF gagal dibuat. Silakan coba kembali.", "error");
  } finally {
    if (downloadButton) {
      downloadButton.disabled = false;
    }
  }
}

downloadButton?.addEventListener("click", downloadSchedule);

// SHARE SCHEDULE
function getShareText() {
  if (!currentRegion) {
    return "Jadwal Imsakiyah Ramadan 1448 H";
  }

  return (
    `Jadwal Imsakiyah Ramadan 1448 H - ` +
    `${currentRegion.name}, ${currentRegion.province}`
  );
}

function shareWhatsApp() {
  const text = encodeURIComponent(`${getShareText()}\n${window.location.href}`);

  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
}

function shareTwitter() {
  const text = encodeURIComponent(getShareText());
  const url = encodeURIComponent(window.location.href);

  window.open(
    `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    "_blank",
    "noopener,noreferrer",
  );
}

function shareFacebook() {
  const url = encodeURIComponent(window.location.href);

  window.open(
    `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    "_blank",
    "noopener,noreferrer",
  );
}

function shareEmail() {
  const subject = encodeURIComponent(getShareText());

  const body = encodeURIComponent(
    `${getShareText()}\n\n${window.location.href}`,
  );

  window.location.href = `mailto:?subject=${subject}&body=${body}`;
}

// SHARE MENU EVENTS
shareButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!shareMenu) return;

  const isOpening = shareMenu.classList.contains("hidden");

  shareMenu.classList.toggle("hidden", !isOpening);

  shareButton.setAttribute("aria-expanded", String(isOpening));
});

// SHARE ACTIONS
const shareActions = {
  whatsapp: shareWhatsApp,
  twitter: shareTwitter,
  facebook: shareFacebook,
  email: shareEmail,
};

shareMenu?.querySelectorAll("[data-share]").forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const action = button.dataset.share;

    closeShareMenu();

    if (shareActions[action]) {
      shareActions[action]();
    }
  });
});

// CLOSE SHARE MENU
function closeShareMenu() {
  if (!shareMenu) return;

  shareMenu.classList.add("hidden");
  shareButton?.setAttribute("aria-expanded", "false");
}

// CLOSE WHEN CLICKING OUTSIDE
document.addEventListener("click", (event) => {
  if (
    shareMenu &&
    shareButton &&
    !shareMenu.contains(event.target) &&
    !shareButton.contains(event.target)
  ) {
    closeShareMenu();
  }
});

// CLOSE WITH ESCAPE
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeShareMenu();
  }
});

// GLOBAL FUNCTIONS
window.loadJadwalPuasaSholat = loadSchedule;
window.downloadJadwal = downloadSchedule;

window.shareWhatsApp = shareWhatsApp;
window.shareTwitter = shareTwitter;
window.shareFacebook = shareFacebook;
window.shareEmail = shareEmail;

// INITIALIZE
async function initializeReminder() {
  if (!citySelect || !scheduleBody) return;

  scheduleBody.innerHTML = `
    <tr>
      <td colspan="8" class="p-6 text-center text-white">
        Pilih Kabupaten/Kota terlebih dahulu dan klik Tampilkan Jadwal...
      </td>
    </tr>
  `;

  await loadIndonesiaCities();

  updateSelectedRegion();
}

initializeReminder();
