const spreadsheetCsvUrls = {
  rekap:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2tWaJ8CNvOCD6CqeyP07YV7MyVyD-QhDtw_cmkrzEBSSlvABZZQtSSPBdJtsoVjYmZmK11K7Lw1fJ/pub?gid=311741769&single=true&output=csv",
  nunggak:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTlHVY8JOnCbzF_t_JUP8WNqW0ReyWB942H8wZoDgabSkpYmnMcqE4ZBvJnT1DsTfoQHPFGIh_CI1ON/pub?output=csv",
  ringkasan:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ3wjaCRLQKJilPP9gEDeXlRUIxLXt4h9376paAQz2JNFDedGbYyWdOvEIVlZHNBbsNpLzSydaM4EIz/pub?output=csv",
};

function parseCsv(csvText) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (insideQuotes && csvText[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    if (row.some((cell) => cell !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function parseNominal(value) {
  const nominal = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(nominal) ? nominal : 0;
}

function formatRupiah(nominal) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(nominal);
}

function showMessage(tableBody, columnCount, message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = columnCount;
  cell.textContent = message;
  row.append(cell);
  tableBody.replaceChildren(row);
}

async function loadTable({ url, bodyId, columnCount, amountColumnIndex }) {
  const tableBody = document.getElementById(bodyId);
  if (!tableBody) {
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Permintaan gagal dengan status ${response.status}.`);
    }

    let rows = parseCsv((await response.text()).replace(/^\uFEFF/, "")).slice(
      1,
    );
    let highestAmount;

    if (amountColumnIndex !== undefined) {
      rows = rows
        .filter((cells) => parseNominal(cells[amountColumnIndex] ?? "") > 0)
        .sort(
          (first, second) =>
            parseNominal(second[amountColumnIndex]) -
            parseNominal(first[amountColumnIndex]),
        );
      highestAmount = rows.length
        ? parseNominal(rows[0][amountColumnIndex])
        : undefined;
    }

    if (rows.length === 0) {
      showMessage(tableBody, columnCount, "Belum ada data di spreadsheet.");
      return;
    }

    const fragment = document.createDocumentFragment();
    rows.forEach((cells) => {
      const row = document.createElement("tr");

      for (let index = 0; index < columnCount; index += 1) {
        const cell = document.createElement("td");
        cell.textContent = cells[index] ?? "";
        if (
          index === amountColumnIndex &&
          parseNominal(cells[index] ?? "") === highestAmount
        ) {
          cell.classList.add("nunggak-highest-amount");
        }
        row.append(cell);
      }

      fragment.append(row);
    });

    tableBody.replaceChildren(fragment);
  } catch (error) {
    console.error(`Gagal memuat data untuk ${bodyId}:`, error);
    showMessage(
      tableBody,
      columnCount,
      "Data gagal dimuat. Periksa URL CSV dan akses publik spreadsheet.",
    );
  }
}

function hitungRingkasan(csvText) {
  const rows = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const headers = rows.shift()?.map((header) => header.toLowerCase());
  const jenisIndex = headers?.indexOf("jenis") ?? -1;
  const nominalIndex = headers?.indexOf("nominal") ?? -1;

  if (jenisIndex < 0 || nominalIndex < 0) {
    throw new Error('Kolom "jenis" dan "nominal" tidak ditemukan di CSV.');
  }

  return rows.reduce(
    (totals, row) => {
      const jenis = row[jenisIndex]?.toLowerCase();
      if (jenis !== "pemasukan" && jenis !== "pengeluaran") {
        return totals;
      }

      totals[jenis] += parseNominal(row[nominalIndex] ?? "");
      return totals;
    },
    { pemasukan: 0, pengeluaran: 0 },
  );
}

async function muatDashboardKeuangan() {
  const elements = {
    pemasukan: document.getElementById("total-pemasukan"),
    pengeluaran: document.getElementById("total-pengeluaran"),
    saldo: document.getElementById("saldo"),
  };

  if (!elements.pemasukan || !elements.pengeluaran || !elements.saldo) {
    return;
  }

  Object.values(elements).forEach((element) => {
    element.textContent = "Memuat...";
  });

  try {
    const response = await fetch(spreadsheetCsvUrls.ringkasan);
    if (!response.ok) {
      throw new Error(`Permintaan gagal dengan status ${response.status}.`);
    }

    const totals = hitungRingkasan(await response.text());
    elements.pemasukan.textContent = formatRupiah(totals.pemasukan);
    elements.pengeluaran.textContent = formatRupiah(totals.pengeluaran);
    elements.saldo.textContent = formatRupiah(
      totals.pemasukan - totals.pengeluaran,
    );
  } catch (error) {
    console.error("Gagal memuat ringkasan kas:", error);
    Object.values(elements).forEach((element) => {
      element.textContent = "Gagal memuat";
    });
  }
}

function setupTheme() {
  const themeSwitch = document.getElementById("mode-switch");
  const savedTheme = localStorage.getItem("rekap-kas-theme");
  const systemPrefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;

  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    if (themeSwitch) {
      themeSwitch.checked = theme === "dark";
    }
  };

  applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));

  themeSwitch?.addEventListener("change", () => {
    const theme = themeSwitch.checked ? "dark" : "light";
    localStorage.setItem("rekap-kas-theme", theme);
    applyTheme(theme);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "rekap-kas-theme") {
      applyTheme(event.newValue === "dark" ? "dark" : "light");
    }
  });
}

function setupMobileNavigation() {
  const menuButton = document.getElementById("mobileMenuBtn");
  const navLinks = document.getElementById("navLinks");

  if (!menuButton || !navLinks) {
    return;
  }

  menuButton.addEventListener("click", () => {
    navLinks.classList.toggle("show");
    const icon = menuButton.querySelector("i");
    icon?.classList.toggle("fa-bars");
    icon?.classList.toggle("fa-xmark");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("show");
      const icon = menuButton.querySelector("i");
      icon?.classList.add("fa-bars");
      icon?.classList.remove("fa-xmark");
    });
  });
}

loadTable({
  url: spreadsheetCsvUrls.rekap,
  bodyId: "rekap-table-body",
  columnCount: 5,
});
loadTable({
  url: spreadsheetCsvUrls.nunggak,
  bodyId: "nunggak-table-body",
  columnCount: 4,
  amountColumnIndex: 1,
});
muatDashboardKeuangan();
setupTheme();
setupMobileNavigation();
