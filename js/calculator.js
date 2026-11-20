// Acuan nisab penghasilan BAZNAS
const INCOME_NISAB = {
  monthly: 7640144,
  yearly: 91681728,
};

const ZAKAT_RATE = 0.025;
const GOLD_NISAB_GRAMS = 85;

let activeZakatType = "penghasilan";

const zakatTabs = document.querySelectorAll("[data-zakat-tab]");
const zakatForms = document.querySelectorAll("[data-zakat-form]");
const formTitle = document.getElementById("form-title");
const formDescription = document.getElementById("form-description");
const resultType = document.getElementById("result-type");
const resultTotal = document.getElementById("result-total");
const resultNisab = document.getElementById("result-nisab");
const resultZakat = document.getElementById("result-zakat");
const resultStatus = document.getElementById("result-status");
const calculateButton = document.getElementById("calculate-zakat");
const resetButton = document.getElementById("reset-zakat");

const typeInformation = {
  penghasilan: {
    title: "Zakat Penghasilan",
    description:
      "Masukkan pendapatan rutin dan pendapatan tambahan yang kamu terima.",
    label: "Penghasilan",
  },
  tabungan: {
    title: "Zakat Tabungan & Harta",
    description:
      "Hitung uang tunai dan aset keuangan setelah dikurangi kewajiban jangka pendek.",
    label: "Tabungan & Harta",
  },
  emas: {
    title: "Zakat Emas",
    description:
      "Hitung nilai zakat dari emas yang telah mencapai nisab dan haul.",
    label: "Emas",
  },
  perniagaan: {
    title: "Zakat Perniagaan",
    description:
      "Hitung nilai bersih aset lancar usaha setelah dikurangi kewajiban jangka pendek.",
    label: "Perniagaan",
  },
};

// Format angka ke Rupiah
function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(value)));
}

// Ambil angka dari input Rupiah
function getMoneyValue(id) {
  const input = document.getElementById(id);
  if (!input) return 0;

  return Number(input.value.replace(/\D/g, "")) || 0;
}

// Format input Rupiah saat diketik
document.querySelectorAll("[data-money]").forEach((input) => {
  input.addEventListener("input", () => {
    const value = input.value.replace(/\D/g, "");
    input.value = value ? formatRupiah(Number(value)) : "";
  });
});

// Ambil angka gram
function getGramValue(id) {
  const value = Number(document.getElementById(id)?.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

// Tampilkan tab yang dipilih
function setZakatType(type) {
  activeZakatType = type;

  zakatTabs.forEach((tab) => {
    const isActive = tab.dataset.zakatTab === type;

    tab.setAttribute("aria-pressed", String(isActive));
    tab.classList.toggle("border-primary", isActive);
    tab.classList.toggle("bg-primary-light/60", isActive);
    tab.classList.toggle("border-gray-300", !isActive);
    tab.classList.toggle("bg-white", !isActive);
  });

  zakatForms.forEach((form) => {
    form.classList.toggle("hidden", form.dataset.zakatForm !== type);
  });

  formTitle.textContent = typeInformation[type].title;
  formDescription.textContent = typeInformation[type].description;

  resetResult();
}

function resetResult() {
  resultType.textContent = typeInformation[activeZakatType].label;
  resultTotal.textContent = "Rp 0";
  resultNisab.textContent = "-";
  resultZakat.textContent = "Rp 0";
  resultStatus.textContent = "Masukkan data lalu tekan tombol hitung zakat.";
}

// Hasil perhitungan
function showResult({ total, nisab, zakat, status }) {
  resultType.textContent = typeInformation[activeZakatType].label;
  resultTotal.textContent = `Rp ${formatRupiah(total)}`;
  resultNisab.textContent = `Rp ${formatRupiah(nisab)}`;
  resultZakat.textContent = `Rp ${formatRupiah(zakat)}`;
  resultStatus.textContent = status;
}

// Perhitungan zakat penghasilan
function calculateIncome() {
  const mainIncome = getMoneyValue("income-main");
  const extraIncome = getMoneyValue("income-extra");
  const period = document.getElementById("income-period").value;
  const totalIncome = mainIncome + extraIncome;
  const nisab = INCOME_NISAB[period];

  if (totalIncome <= 0) {
    showResult({
      total: 0,
      nisab,
      zakat: 0,
      status: "Masukkan jumlah pendapatan terlebih dahulu.",
    });
    return;
  }

  const isEligible = totalIncome >= nisab;

  showResult({
    total: totalIncome,
    nisab,
    zakat: isEligible ? totalIncome * ZAKAT_RATE : 0,
    status: isEligible
      ? "Pendapatan telah mencapai nisab. Estimasi zakat sebesar 2,5% dari total pendapatan."
      : "Pendapatan belum mencapai nisab berdasarkan acuan yang digunakan. Kamu tetap dapat menunaikan infak atau sedekah.",
  });
}

// Perhitungan zakat tabungan
function calculateSavings() {
  const cash = getMoneyValue("saving-cash");
  const investment = getMoneyValue("saving-investment");
  const debt = getMoneyValue("saving-debt");
  const goldPrice = getMoneyValue("saving-gold-price");
  const hasHaul = document.getElementById("saving-haul").checked;

  const netAssets = Math.max(0, cash + investment - debt);
  const nisab = goldPrice * GOLD_NISAB_GRAMS;

  if (goldPrice <= 0) {
    showResult({
      total: netAssets,
      nisab: 0,
      zakat: 0,
      status: "Masukkan harga emas per gram untuk menentukan nilai nisab.",
    });
    return;
  }

  const reachesNisab = netAssets >= nisab;
  const isEligible = reachesNisab && hasHaul;

  let status = "Harta belum mencapai nisab.";

  if (reachesNisab && !hasHaul) {
    status =
      "Harta telah mencapai nisab, tetapi syarat haul satu tahun hijriah belum dikonfirmasi.";
  } else if (isEligible) {
    status =
      "Harta telah mencapai nisab dan haul. Estimasi zakat sebesar 2,5% dari harta bersih.";
  }

  showResult({
    total: netAssets,
    nisab,
    zakat: isEligible ? netAssets * ZAKAT_RATE : 0,
    status,
  });
}

// Perhitungan zakat emas
function calculateGold() {
  const amount = getGramValue("gold-amount");
  const price = getMoneyValue("gold-price");
  const hasHaul = document.getElementById("gold-haul").checked;

  const totalValue = amount * price;
  const nisabValue = GOLD_NISAB_GRAMS * price;

  if (price <= 0) {
    showResult({
      total: totalValue,
      nisab: 0,
      zakat: 0,
      status: "Masukkan harga emas per gram untuk menghitung nilai zakat.",
    });
    return;
  }

  const reachesNisab = amount >= GOLD_NISAB_GRAMS;
  const isEligible = reachesNisab && hasHaul;

  let status = "Jumlah emas belum mencapai nisab 85 gram.";

  if (reachesNisab && !hasHaul) {
    status =
      "Jumlah emas telah mencapai nisab, tetapi syarat haul satu tahun hijriah belum dikonfirmasi.";
  } else if (isEligible) {
    status =
      "Emas telah mencapai nisab dan haul. Estimasi zakat sebesar 2,5% dari nilai emas.";
  }

  showResult({
    total: totalValue,
    nisab: nisabValue,
    zakat: isEligible ? totalValue * ZAKAT_RATE : 0,
    status,
  });
}

// Perhitungan zakat perniagaan
function calculateTrade() {
  const assets = getMoneyValue("trade-assets");
  const debt = getMoneyValue("trade-debt");
  const goldPrice = getMoneyValue("trade-gold-price");
  const hasHaul = document.getElementById("trade-haul").checked;

  const netAssets = Math.max(0, assets - debt);
  const nisab = goldPrice * GOLD_NISAB_GRAMS;

  if (goldPrice <= 0) {
    showResult({
      total: netAssets,
      nisab: 0,
      zakat: 0,
      status: "Masukkan harga emas per gram untuk menentukan nilai nisab.",
    });
    return;
  }

  const reachesNisab = netAssets >= nisab;
  const isEligible = reachesNisab && hasHaul;

  let status = "Nilai bersih aset perniagaan belum mencapai nisab.";

  if (reachesNisab && !hasHaul) {
    status =
      "Aset perniagaan telah mencapai nisab, tetapi syarat haul satu tahun hijriah belum dikonfirmasi.";
  } else if (isEligible) {
    status =
      "Aset perniagaan telah mencapai nisab dan haul. Estimasi zakat sebesar 2,5% dari nilai bersih.";
  }

  showResult({
    total: netAssets,
    nisab,
    zakat: isEligible ? netAssets * ZAKAT_RATE : 0,
    status,
  });
}

// Jalankan perhitungan sesuai jenis zakat
function calculateZakat() {
  switch (activeZakatType) {
    case "penghasilan":
      calculateIncome();
      break;
    case "tabungan":
      calculateSavings();
      break;
    case "emas":
      calculateGold();
      break;
    case "perniagaan":
      calculateTrade();
      break;
  }
}

// Reset seluruh input
function resetZakatCalculator() {
  document.querySelectorAll("[data-zakat-form] input").forEach((input) => {
    if (input.type === "checkbox") {
      input.checked = false;
    } else {
      input.value = "";
    }
  });

  const period = document.getElementById("income-period");
  if (period) period.value = "monthly";

  resetResult();
}

// Event tab
zakatTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setZakatType(tab.dataset.zakatTab);
  });
});

// Event tombol
calculateButton?.addEventListener("click", calculateZakat);
resetButton?.addEventListener("click", resetZakatCalculator);

// Inisialisasi
setZakatType("penghasilan");
