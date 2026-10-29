document.addEventListener("DOMContentLoaded", () => {
  const scheduleTableBody = document.querySelector(".schedule-table tbody");
  const scheduleCsvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHx6RoBcnisd9HKFXTfmfI7NmHUX2-lM460usfOc1auZZPjbpIsvDzYy3ksxpGTr8XA1vV2Ic5Jx9a/pub?output=csv";
  const nunggakCsvUrl =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTlHVY8JOnCbzF_t_JUP8WNqW0ReyWB942H8wZoDgabSkpYmnMcqE4ZBvJnT1DsTfoQHPFGIh_CI1ON/pub?output=csv";

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

  async function loadSchedule() {
    if (!scheduleTableBody) {
      return;
    }

    try {
      const response = await fetch(scheduleCsvUrl);
      if (!response.ok) {
        throw new Error(
          `Permintaan jadwal gagal dengan status ${response.status}.`,
        );
      }

      const rows = parseCsv((await response.text()).replace(/^\uFEFF/, ""));
      const headerIndex = rows.findIndex(
        (cells) =>
          cells[0]?.toLowerCase() === "hari" &&
          cells[1]?.toLowerCase().includes("makul"),
      );
      const scheduleRows = rows
        .slice(headerIndex + 1)
        .filter((cells) => cells.length >= 5 && cells[0] !== "");

      if (headerIndex < 0) {
        throw new Error("Header jadwal tidak ditemukan di CSV.");
      }

      if (scheduleRows.length === 0) {
        throw new Error("CSV jadwal tidak berisi baris yang lengkap.");
      }

      const fragment = document.createDocumentFragment();
      scheduleRows.forEach((cells) => {
        const row = document.createElement("tr");
        cells.slice(0, 5).forEach((value, index) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          if (index === 0) {
            const day = document.createElement("strong");
            day.textContent = value;
            cell.replaceChildren(day);
          }
          row.append(cell);
        });
        fragment.append(row);
      });
      scheduleTableBody.replaceChildren(fragment);
    } catch (error) {
      console.error("Gagal memuat jadwal:", error);
      scheduleTableBody.innerHTML =
        '<tr><td colspan="5">Jadwal gagal dimuat. Periksa tautan CSV jadwal.</td></tr>';
    }
  }

  function parseNominal(value) {
    const nominal = Number(value.replace(/[^\d-]/g, ""));
    if (!Number.isFinite(nominal)) {
      throw new Error(`Nominal tunggakan tidak valid: "${value}".`);
    }
    return nominal;
  }

  function formatRupiah(nominal) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(nominal);
  }

  async function loadTunggakan() {
    const announcementMessage = document.getElementById(
      "tunggakan-announcement-message",
    );
    if (!announcementMessage) {
      return;
    }

    try {
      const response = await fetch(nunggakCsvUrl);
      if (!response.ok) {
        throw new Error(
          `Permintaan tunggakan gagal dengan status ${response.status}.`,
        );
      }

      const rows = parseCsv((await response.text()).replace(/^\uFEFF/, ""))
        .slice(1)
        .filter((cells) => cells[0] && cells[1]);

      if (rows.length === 0) {
        throw new Error("Data tunggakan tidak berisi baris yang lengkap.");
      }

      const tunggakan = rows
        .map((cells) => ({
          name: cells[0],
          nominal: parseNominal(cells[1]),
        }))
        .sort((first, second) => second.nominal - first.nominal);
      const highestNominal = tunggakan[0].nominal;
      const highestTunggakan = tunggakan.filter(
        ({ nominal }) => nominal === highestNominal,
      );

      const fragment = document.createDocumentFragment();
      highestTunggakan.forEach(({ name, nominal }) => {
        const item = document.createElement("li");
        item.textContent = `${name}: ${formatRupiah(nominal)}`;
        fragment.append(item);
      });
      announcementMessage.replaceChildren(fragment);
    } catch (error) {
      console.error("Gagal memuat pengumuman tunggakan:", error);
      announcementMessage.replaceChildren(
        document.createTextNode(
          "Daftar tunggakan gagal dimuat. Silakan lihat daftar lengkap.",
        ),
      );
    }
  }

  loadSchedule();
  loadTunggakan();

  // 1. Toggle Mobile Menu
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const navLinks = document.getElementById("navLinks");

  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("show");

      // Ubah icon hamburger ke 'X' saat terbuka
      const icon = mobileMenuBtn.querySelector("i");
      if (navLinks.classList.contains("show")) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-xmark");
      } else {
        icon.classList.remove("fa-xmark");
        icon.classList.add("fa-bars");
      }
    });
  }

  // 2. Active Link Highlighting saat di-scroll
  const sections = document.querySelectorAll("section");
  const navItems = document.querySelectorAll(".nav-links a");

  const revealItems = document.querySelectorAll(
    ".section-title, .card, .table-container, .footer-content",
  );
  revealItems.forEach((item, index) => {
    item.classList.add("reveal");
    item.style.transitionDelay = `${Math.min(index * 70, 280)}ms`;
  });

  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 },
    );

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  window.addEventListener("scroll", () => {
    let currentSection = "";

    sections.forEach((section) => {
      const sectionTop = section.offsetTop - 80;
      const sectionHeight = section.clientHeight;

      if (
        window.scrollY >= sectionTop &&
        window.scrollY < sectionTop + sectionHeight
      ) {
        currentSection = section.getAttribute("id");
      }
    });

    navItems.forEach((item) => {
      item.classList.remove("active");
      if (item.getAttribute("href") === `#${currentSection}`) {
        item.classList.add("active");
      }
    });
  });

  // 3. Menutup mobile menu secara otomatis ketika salah satu link diklik
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      if (navLinks.classList.contains("show")) {
        navLinks.classList.remove("show");
        const icon = mobileMenuBtn.querySelector("i");
        icon.classList.remove("fa-xmark");
        icon.classList.add("fa-bars");
      }
    });
  });
});
