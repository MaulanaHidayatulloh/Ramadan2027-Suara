// -- MOBILE NAVIGATION --
const menuToggle = document.getElementById("menu-toggle");
const mobileMenu = document.getElementById("mobile-menu");
const menuIcon = document.getElementById("menu-icon");
const menuBackdrop = document.getElementById("mobile-menu-backdrop");

function openMobileMenu() {
  mobileMenu.classList.remove("hidden");
  menuBackdrop.classList.remove("hidden");
  menuToggle.setAttribute("aria-expanded", "true");
  menuToggle.setAttribute("aria-label", "Tutup menu navigasi");
  menuIcon.innerHTML = `
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="m6 6 12 12M18 6 6 18"
    />
  `;
}

function closeMobileMenu() {
  mobileMenu.classList.add("hidden");
  menuBackdrop.classList.add("hidden");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Buka menu navigasi");
  menuIcon.innerHTML = `
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M4 6h16M4 12h16M4 18h16"
    />
  `;
}

if (menuToggle && mobileMenu && menuIcon && menuBackdrop) {
  menuToggle.addEventListener("click", () => {
    const isOpen = !mobileMenu.classList.contains("hidden");

    if (isOpen) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  menuBackdrop.addEventListener("click", closeMobileMenu);
  document.querySelectorAll(".mobile-nav-link").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileMenu();
    }
  });
}

// -- PRAYER TIMES CONFIGURATION --
// Default location: Jakarta
const DEFAULT_LOCATION = {
  latitude: -6.2088,
  longitude: 106.8456,
  name: "Jakarta",
  description: "Lokasi default",
};

let prayerData = null;
let countdownInterval = null;
const locationName = document.getElementById("location-name");
const locationDescription = document.getElementById("location-description");

// Prayer elements
const prayerDate = document.getElementById("prayer-date");
const prayerStatus = document.getElementById("prayer-status");
const refreshLocation = document.getElementById("refresh-location");

// FORMAT TIME
function formatTime(time) {
  if (!time) return "--:--";
  return String(time).split(" ")[0];
}

// FORMAT DATE
function formatDate() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

// GET LOCATION NAME
async function getLocationName(latitude, longitude) {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`,
    );

    if (!response.ok) {
      throw new Error("Gagal mengambil nama lokasi");
    }

    const data = await response.json();

    const city =
      data.city ||
      data.locality ||
      data.localityInfo?.administrative?.[0]?.name ||
      data.principalSubdivision ||
      "Lokasi Anda";

    const region = data.principalSubdivision || "Indonesia";

    return {
      name: city,
      description: `${region}, Indonesia`,
    };
  } catch (error) {
    console.error("Location name error:", error);

    return {
      name: "Lokasi Anda",
      description: "Lokasi berhasil dideteksi",
    };
  }
}

// GET PRAYER TIMES
async function getPrayerTimes(latitude, longitude) {
  try {
    prayerStatus.textContent = "Mengambil jadwal salat...";
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();

    const response = await fetch(
      `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=20`,
    );

    if (!response.ok) {
      throw new Error("Tidak dapat mengambil jadwal salat");
    }

    const result = await response.json();

    if (result.code !== 200 || !result.data) {
      throw new Error("Data jadwal salat tidak tersedia");
    }

    prayerData = result.data.timings;
    updatePrayerWidget(result.data);
    startCountdown(latitude, longitude);

    prayerStatus.textContent =
      "Jadwal salat diperbarui berdasarkan lokasi Anda.";
  } catch (error) {
    console.error("Prayer API error:", error);

    prayerStatus.textContent =
      "Gagal memuat jadwal salat. Silakan coba perbarui lokasi.";
  }
}

// UPDATE PRAYER WIDGET
function updatePrayerWidget(data) {
  const timings = data.timings;

  const prayerTimes = {
    imsak: timings.Imsak,
    fajr: timings.Fajr,
    dhuhr: timings.Dhuhr,
    asr: timings.Asr,
    maghrib: timings.Maghrib,
    isha: timings.Isha,
  };

  Object.entries(prayerTimes).forEach(([name, time]) => {
    const element = document.getElementById(`prayer-${name}`);

    if (element) {
      element.textContent = formatTime(time);
    }
  });

  prayerDate.textContent = data.date?.readable || formatDate();
  updateActivePrayer();
}

// ACTIVE PRAYER
function updateActivePrayer() {
  if (!prayerData) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const prayerSchedule = [
    { id: "imsak", time: prayerData.Imsak },
    { id: "fajr", time: prayerData.Fajr },
    { id: "dhuhr", time: prayerData.Dhuhr },
    { id: "asr", time: prayerData.Asr },
    { id: "maghrib", time: prayerData.Maghrib },
    { id: "isha", time: prayerData.Isha },
  ];

  document.querySelectorAll(".prayer-item").forEach((item) => {
    item.classList.remove("prayer-active");
  });

  let activePrayer = null;

  prayerSchedule.forEach((prayer) => {
    const [hours, minutes] = formatTime(prayer.time).split(":").map(Number);

    const prayerMinutes = hours * 60 + minutes;

    if (currentMinutes >= prayerMinutes) {
      activePrayer = prayer.id;
    }
  });

  if (activePrayer) {
    const activeElement = document.getElementById(
      `prayer-${activePrayer}-item`,
    );

    if (activeElement) {
      activeElement.classList.add("prayer-active");
    }
  }
}

// MAGHRIB & IMSAK COUNTDOWN
function startCountdown(latitude, longitude) {
  if (!prayerData || !prayerData.Maghrib || !prayerData.Imsak) return;

  clearInterval(countdownInterval);

  let tomorrowTimings = null;
  let tomorrowRequest = null;
  let scheduleDate = new Date().toDateString();

  async function getTomorrowTimings() {
    if (tomorrowTimings) return tomorrowTimings;
    if (tomorrowRequest) return tomorrowRequest;

    tomorrowRequest = (async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const day = String(tomorrow.getDate()).padStart(2, "0");
      const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
      const year = tomorrow.getFullYear();

      const response = await fetch(
        `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${latitude}&longitude=${longitude}&method=20`,
      );

      if (!response.ok) {
        throw new Error("Gagal mengambil jadwal salat besok");
      }

      const result = await response.json();

      if (result.code !== 200 || !result.data) {
        throw new Error("Jadwal salat besok tidak tersedia");
      }

      tomorrowTimings = result.data.timings;

      return tomorrowTimings;
    })();

    try {
      return await tomorrowRequest;
    } catch (error) {
      tomorrowRequest = null;
      throw error;
    }
  }

  function createTarget(time, date) {
    const [hours, minutes] = formatTime(time).split(":").map(Number);
    const target = new Date(date);
    target.setHours(hours, minutes, 0, 0);

    return target;
  }

  async function updateCountdown() {
    const now = new Date();

    if (now.toDateString() !== scheduleDate) {
      getPrayerTimes(latitude, longitude);
      return;
    }

    const todayMaghrib = createTarget(prayerData.Maghrib, now);

    let target;
    let targetName;

    if (now < todayMaghrib) {
      target = todayMaghrib;
      targetName = "Maghrib";
    } else {
      try {
        const tomorrow = await getTomorrowTimings();
        const tomorrowDate = new Date(now);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrowImsak = createTarget(tomorrow.Imsak, tomorrowDate);
        const tomorrowMaghrib = createTarget(tomorrow.Maghrib, tomorrowDate);

        if (now < tomorrowImsak) {
          target = tomorrowImsak;
          targetName = "Imsak";
        } else {
          target = tomorrowMaghrib;
          targetName = "Maghrib";
        }
      } catch (error) {
        console.error("Countdown error:", error);
        document.getElementById("countdown-caption").textContent =
          "Jadwal Imsak besok belum dapat dimuat.";
        return;
      }
    }

    const difference = Math.max(0, target.getTime() - now.getTime());
    const totalSeconds = Math.floor(difference / 1000);
    const remainingHours = Math.floor(totalSeconds / 3600);
    const remainingMinutes = Math.floor((totalSeconds % 3600) / 60);
    const remainingSeconds = totalSeconds % 60;

    document.getElementById("count-hours").textContent = String(
      remainingHours,
    ).padStart(2, "0");

    document.getElementById("count-minutes").textContent = String(
      remainingMinutes,
    ).padStart(2, "0");

    document.getElementById("count-seconds").textContent = String(
      remainingSeconds,
    ).padStart(2, "0");

    document.getElementById("countdown-title").textContent =
      targetName === "Imsak"
        ? "Menuju Waktu Imsak Dalam"
        : "Waktu Berbuka Dalam";

    document.getElementById("countdown-caption").textContent =
      targetName === "Imsak"
        ? "Menghitung waktu menuju Imsak"
        : "Menghitung waktu menuju berbuka puasa";
  }

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

// LOAD LOCATION
async function loadLocation(latitude, longitude, isDefault = false) {
  const location = isDefault
    ? {
        name: DEFAULT_LOCATION.name,
        description: DEFAULT_LOCATION.description,
      }
    : await getLocationName(latitude, longitude);

  locationName.textContent = location.name;
  locationDescription.textContent = location.description;
  await getPrayerTimes(latitude, longitude);
}

// REQUEST GEOLOCATION
function detectLocation() {
  if (!navigator.geolocation) {
    locationName.textContent = DEFAULT_LOCATION.name;
    locationDescription.textContent =
      "Browser tidak mendukung GPS. Menggunakan Jakarta.";

    loadLocation(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude, true);
    return;
  }

  locationName.textContent = "Mendeteksi lokasi...";
  locationDescription.textContent =
    "Mohon izinkan akses lokasi perangkat Anda.";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      loadLocation(latitude, longitude);
    },

    (error) => {
      console.warn("Geolocation error:", error.message);
      locationName.textContent = DEFAULT_LOCATION.name;
      locationDescription.textContent =
        "Lokasi tidak tersedia. Menggunakan lokasi default Jakarta.";
      loadLocation(DEFAULT_LOCATION.latitude, DEFAULT_LOCATION.longitude, true);
    },

    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000,
    },
  );
}

// REFRESH LOCATION
if (refreshLocation) {
  refreshLocation.addEventListener("click", () => {
    detectLocation();
  });
}

/* ARTICLE SLIDER */
const articleSlider = document.getElementById("article-slider");

if (articleSlider) {
  const articlePrev = document.getElementById("article-prev");
  const articleNext = document.getElementById("article-next");
  const articleCounter = document.getElementById("article-counter");
  const articleProgress = document.getElementById("article-progress");
  const articleCards = articleSlider.querySelectorAll("article");
  const totalArticles = articleCards.length;

  function updateArticleSlider() {
    const maxScroll = articleSlider.scrollWidth - articleSlider.clientWidth;

    const currentScroll = articleSlider.scrollLeft;
    const firstCard = articleCards[0];

    if (!firstCard) return;

    const sliderStyle = getComputedStyle(articleSlider);
    const gap = parseFloat(sliderStyle.columnGap) || 0;
    const cardStep = firstCard.offsetWidth + gap;

    const isAtEnd = currentScroll >= maxScroll - 2;

    const currentIndex = isAtEnd
      ? totalArticles
      : Math.min(
          totalArticles,
          Math.max(1, Math.round(currentScroll / cardStep) + 1),
        );

    const progress = maxScroll > 0 ? (currentScroll / maxScroll) * 100 : 100;

    articleCounter.innerHTML = `
    ${String(currentIndex).padStart(2, "0")}
    <span class="mx-1 text-primary/40">/</span>
    ${String(totalArticles).padStart(2, "0")}
  `;

    articleProgress.style.width = `${progress}%`;
    articlePrev.disabled = currentScroll <= 2;
    articleNext.disabled = currentScroll >= maxScroll - 2;
  }

  function moveArticleSlider(direction) {
    const firstCard = articleCards[0];

    if (!firstCard) return;

    const sliderStyle = getComputedStyle(articleSlider);
    const gap = parseFloat(sliderStyle.columnGap) || 0;
    const cardStep = firstCard.offsetWidth + gap;

    articleSlider.scrollBy({
      left: cardStep * direction,
      behavior: "smooth",
    });
  }

  articlePrev.addEventListener("click", () => {
    moveArticleSlider(-1);
  });

  articleNext.addEventListener("click", () => {
    moveArticleSlider(1);
  });

  articleSlider.addEventListener("scroll", updateArticleSlider, {
    passive: true,
  });

  window.addEventListener("resize", updateArticleSlider);

  updateArticleSlider();
}

/* SUARA INSPIRASI - CATEGORY TABS */
const inspirasiTabs = document.querySelectorAll("[data-inspirasi-tab]");
const inspirasiPanels = document.querySelectorAll("[data-inspirasi-panel]");

inspirasiTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const selectedTab = tab.dataset.inspirasiTab;

    inspirasiTabs.forEach((item) => {
      const isActive = item === tab;

      item.dataset.active = isActive ? "true" : "false";
      item.setAttribute("aria-selected", String(isActive));
    });

    inspirasiPanels.forEach((panel) => {
      const isActive = panel.dataset.inspirasiPanel === selectedTab;

      panel.classList.toggle("hidden", !isActive);
    });
  });
});

// INITIALIZE
detectLocation();
setInterval(updateActivePrayer, 60000);
