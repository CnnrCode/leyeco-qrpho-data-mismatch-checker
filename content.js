// Frame-buster bypass for framed WordPress/QRpho pages
// Injected at document_start so it runs before any WordPress page scripts can hide the body.
if (window.self !== window.top) {
  const cssBypass = `
    body, html, #wpwrap, #wpbody, #wpcontent, .wrap { 
      display: block !important; 
      visibility: visible !important; 
      opacity: 1 !important; 
    }
  `;

  const injectBypass = () => {
    let style = document.getElementById("frame-buster-bypass");
    if (!style) {
      style = document.createElement("style");
      style.id = "frame-buster-bypass";
      style.textContent = cssBypass;
      if (document.documentElement) {
        document.documentElement.appendChild(style);
      }
    }
  };

  // 1. Try injecting immediately
  injectBypass();

  // 2. Setup observer to prevent other scripts from deleting or overriding our bypass
  const observer = new MutationObserver((mutations) => {
    injectBypass();
    // Keep body visible if some script changes display inline
    if (document.body && document.body.style.display === 'none') {
      document.body.style.setProperty('display', 'block', 'important');
    }
  });

  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  }

  // 3. Fallbacks for standard DOM load events
  document.addEventListener("DOMContentLoaded", injectBypass);
  window.addEventListener("load", injectBypass);
}

// Helper to detect if the page is Leyeco III or QRpho
function detectPageType() {
  const url = window.location.href;
  const bodyText = document.body ? document.body.textContent || "" : "";
  const titleText = document.title || "";

  if (
    url.includes("leyeco3-payroll") || 
    url.includes("leyeco3.net") || 
    titleText.includes("Leyeco III") || 
    bodyText.includes("Leyeco III") || 
    bodyText.includes("View Attendance Report")
  ) {
    return "leyeco";
  }
  if (
    url.includes("qrpho") || 
    titleText.includes("QRpho") || 
    bodyText.includes("QRpho")
  ) {
    return "qrpho";
  }
  return null;
}

// Helper to extract the actual image source (filtering out icons like show-selfie.png)
function getActualImgSrc(container) {
  if (!container) return null;
  const imgs = Array.from(container.querySelectorAll("img"));
  if (imgs.length === 0) return null;
  
  // Find an image that is NOT marked as an icon and doesn't contain "selfie" in its src
  const realImg = imgs.find(img => {
    const src = (img.getAttribute("src") || "").toLowerCase();
    const isIcon = img.getAttribute("data-icon") === "true" || 
                   src.includes("show-selfie") || 
                   src.includes("selfie-icon");
    return !isIcon;
  });
  
  return realImg ? realImg.src : null;
}

// Helper to build robust header mapping with colspans and rowspans
function getHeaderMatrix(table) {
  // Select all rows containing header cells inside the table (both under thead or directly under table)
  const headRows = Array.from(table.querySelectorAll("thead tr, tr")).filter(r => r.querySelector("th"));
  if (headRows.length === 0) return [];
  
  let maxCols = 0;
  headRows.forEach(row => {
    let cols = 0;
    Array.from(row.querySelectorAll("th, td")).forEach(cell => {
      cols += parseInt(cell.getAttribute("colspan") || "1", 10);
    });
    if (cols > maxCols) maxCols = cols;
  });
  
  if (maxCols === 0) return [];
  
  // Initialize matrix
  const matrix = Array(headRows.length).fill(null).map(() => Array(maxCols).fill(null));
  
  headRows.forEach((row, rowIndex) => {
    let colIndex = 0;
    Array.from(row.querySelectorAll("th, td")).forEach(cell => {
      // Find the next empty cell in the matrix for this row
      while (colIndex < maxCols && matrix[rowIndex][colIndex] !== null) {
        colIndex++;
      }
      if (colIndex >= maxCols) return;
      
      const rowspan = parseInt(cell.getAttribute("rowspan") || "1", 10);
      const colspan = parseInt(cell.getAttribute("colspan") || "1", 10);
      const text = cell.textContent.trim();
      
      // Populate matrix
      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          if (rowIndex + r < headRows.length && colIndex + c < maxCols) {
            if (matrix[rowIndex + r][colIndex + c] === null) {
              matrix[rowIndex + r][colIndex + c] = text;
            }
          }
        }
      }
      colIndex += colspan;
    });
  });
  
  // Merge column names
  const mergedHeaders = [];
  for (let c = 0; c < maxCols; c++) {
    let texts = [];
    for (let r = 0; r < headRows.length; r++) {
      const val = matrix[r][c];
      if (val && !texts.includes(val)) {
        texts.push(val);
      }
    }
    mergedHeaders.push(texts.join(" "));
  }
  return mergedHeaders;
}

// Scrape Leyeco III Attendance Report Page
function scrapeLeyeco() {
  let employeeName = "";

  // Search for "Name: Alvin Sara Abadies" text in DOM
  const elements = Array.from(document.querySelectorAll("div, span, td, p, h1, h2, h3, h4, th"));
  for (const el of elements) {
    if (el.children.length > 2) continue; // Skip large container blocks
    const text = el.textContent.trim();
    if (/^Name:\s*/i.test(text) || text.includes("Name: ")) {
      const match = text.match(/Name:\s*([^\n\r|]+)/i);
      if (match && match[1]) {
        employeeName = match[1].trim();
        break;
      }
    }
  }

  // Fallback label lookup
  if (!employeeName) {
    const nameLabels = Array.from(document.querySelectorAll("div, span, td, th")).filter(el => 
      el.textContent.trim().toLowerCase() === "name:" || el.textContent.trim().toLowerCase() === "name"
    );
    for (const label of nameLabels) {
      const sibling = label.nextElementSibling;
      if (sibling && sibling.textContent.trim()) {
        employeeName = sibling.textContent.trim();
        break;
      }
      const parent = label.parentElement;
      if (parent) {
        const nextCell = parent.querySelector("td:nth-child(2), div:nth-child(2)");
        if (nextCell && nextCell !== label && nextCell.textContent.trim()) {
          employeeName = nextCell.textContent.trim();
          break;
        }
      }
    }
  }

  const rowsData = [];
  // Scope to the specific attendance table (first table with >= 5 columns in its header)
  const allTables = Array.from(document.querySelectorAll("table"));
  const attendanceTable = allTables.find(t => {
    const ths = t.querySelectorAll("th");
    return ths.length >= 4;
  }) || document.body;

  const rows = Array.from(attendanceTable.querySelectorAll("tr"));
  const debugRows = [];

  // Build a column-name → effective-column-index map from the attendance table's header rows,
  // accounting for colspan so the index matches the <td> position in data rows.
  const PAYROLL_FIELDS = [
    { key: "totalWorkHours",    patterns: [/total\s*work\s*(hours?|hrs\.?)/i, /total\s*work/i] },
    { key: "officeHours",       patterns: [/office\s*(hours?|hrs\.?)\s*credits?/i, /office\s*(hours?|hrs\.?)/i] },
    { key: "overtimeHours",     patterns: [/overtime\s*(hours?|hrs\.?)/i, /overtime/i] },
    { key: "holidayCredit",     patterns: [/holiday\s*(credits?|hours?|hrs\.?)/i, /holiday/i] },
    { key: "leaveCredit",       patterns: [/leave\s*(credits?|hours?|hrs\.?)/i, /leave/i] },
    { key: "totalPayrollHours", patterns: [/total\s*payroll\s*(hours?|hrs\.?)/i, /total\s*payroll/i] },
    { key: "undertime",         patterns: [/undertime/i] },
  ];

  const colMap = {}; // fieldKey → effective column index in data rows
  const mergedHeaders = getHeaderMatrix(attendanceTable);
  mergedHeaders.forEach((text, index) => {
    for (const field of PAYROLL_FIELDS) {
      if (!(field.key in colMap)) {
        for (const pat of field.patterns) {
          if (pat.test(text)) {
            colMap[field.key] = index;
            break;
          }
        }
      }
    }
  });

  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll("th, td"));
    if (cells.length < 2) continue;

    const dateText = cells[0].textContent.trim();
    
    debugRows.push({
      dateText: dateText,
      cellsCount: cells.length,
      cellsText: cells.map((c, i) => `${i}: [${c.tagName}] "${c.textContent.trim().replace(/\s+/g, ' ')}" (hasImg: ${!!c.querySelector('img')})`)
    });

    const dateMatch = dateText.match(/(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;

    const date = dateMatch[1];

    if (cells.length >= 5) {
      const parseCellLog = (cell, slotName) => {
        if (!cell) return null;
        const text = cell.textContent.trim();
        const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})/);
        if (!timeMatch) return null;

        let imgSrc = getActualImgSrc(cell);
        if (!imgSrc) {
          const icon = cell.querySelector("i.wp-menu-image");
          if (icon) {
            imgSrc = "placeholder_avatar";
          }
        }

        return {
          slot: slotName,
          time: timeMatch[1],
          photo: imgSrc,
          hasPhoto: !!imgSrc && !imgSrc.includes("placeholder") && !imgSrc.includes("avatar") && !imgSrc.includes("selfie")
        };
      };

      const amIn = parseCellLog(cells[1], "AM In");
      const amOut = parseCellLog(cells[2], "AM Out");
      const pmIn = parseCellLog(cells[3], "PM In");
      const pmOut = parseCellLog(cells[4], "PM Out");

      const logs = [];
      if (amIn) logs.push(amIn);
      if (amOut) logs.push(amOut);
      if (pmIn) logs.push(pmIn);
      if (pmOut) logs.push(pmOut);

      // Extract payroll summary columns using the header-built colMap
      const payroll = {};
      for (const field of PAYROLL_FIELDS) {
        if (field.key in colMap) {
          const idx = colMap[field.key];
          const cell = cells[idx];
          payroll[field.key] = cell ? cell.textContent.trim() : "";
        } else {
          payroll[field.key] = "";
        }
      }

      rowsData.push({
        date: date,
        rawDateText: dateText,
        logs: logs,
        payroll: payroll
      });
    }
  }

  return {
    employeeName: employeeName,
    records: rowsData,
    debug: debugRows
  };
}

// Scrape QRpho Attendance Tracking System Page
function scrapeQrpho() {
  let employeeName = "";

  // 1. Check dropdown select filter
  const selectEl = document.querySelector("select[name='employee_id'], select#employee_id");
  if (selectEl && selectEl.selectedIndex >= 0) {
    employeeName = selectEl.options[selectEl.selectedIndex].text.trim();
  }

  // 2. Heading lookup
  if (!employeeName) {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3, .wrap h2, .entry-title"));
    for (const h of headings) {
      const text = h.textContent.trim();
      if (text.includes("Attendance Report") && text.includes("-")) {
        employeeName = text.split("-")[1].trim();
        break;
      }
    }
  }

  // Multi-format date normalizer — returns "YYYY-MM-DD" or null
  function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const s = dateStr.trim();
    const months = {
      jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
      jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12"
    };

    // Format: DD-Mon-YYYY  e.g. "01-Jan-2026"
    let m = s.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
    if (m) {
      const mo = months[m[2].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,"0")}`;
    }
    // Format: Mon-DD,YYYY  or  Mon DD,YYYY  or  Mon-DD-YYYY  e.g. "Jan-01,2026"
    m = s.match(/([A-Za-z]{3})[-\s](\d{1,2})[,\-\s]+(\d{4})/);
    if (m) {
      const mo = months[m[1].toLowerCase()];
      if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,"0")}`;
    }
    // Format: YYYY-MM-DD
    m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // Format: MM/DD/YYYY
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
    // Format: DD/MM/YYYY (fallback)
    m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (m && parseInt(m[1]) <= 31 && parseInt(m[2]) <= 12) {
      const yr = m[3].length === 2 ? "20" + m[3] : m[3];
      return `${yr}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    }
    return null;
  }

  // Find a date string anywhere inside a row (any cell)
  function findDateInRow(cells) {
    for (const cell of cells) {
      const d = normalizeDate(cell.textContent.trim());
      if (d) return { date: d, rawText: cell.textContent.trim() };
    }
    return null;
  }

  const SLOT_NAMES = ["AM In", "AM Out", "PM In", "PM Out"];

  // Build column-name → effective-column-index map scoped to the attendance table only.
  // QRpho is a WordPress page with many <th> elements in menus/other tables — we must
  // NOT use document.querySelectorAll("th") as that gives wrong global indices.
  const PAYROLL_FIELDS = [
    { key: "totalWorkHours",    patterns: [/total\s*work\s*(hours?|hrs\.?)/i, /total\s*work/i] },
    { key: "officeHours",       patterns: [/office\s*(hours?|hrs\.?)\s*credits?/i, /office\s*(hours?|hrs\.?)/i] },
    { key: "overtimeHours",     patterns: [/overtime\s*(hours?|hrs\.?)/i, /overtime/i] },
    { key: "holidayCredit",     patterns: [/holiday\s*(credits?|hours?|hrs\.?)/i, /holiday/i] },
    { key: "leaveCredit",       patterns: [/leave\s*(credits?|hours?|hrs\.?)/i, /leave/i] },
    { key: "totalPayrollHours", patterns: [/total\s*payroll\s*(hours?|hrs\.?)/i, /total\s*payroll/i] },
    { key: "undertime",         patterns: [/undertime/i] },
  ];

  // Find the specific table that contains the attendance data cells
  const qDataCell = document.querySelector("td.data-time, td.data-img");
  let qAttendanceTable = qDataCell;
  while (qAttendanceTable && qAttendanceTable.tagName !== "TABLE") {
    qAttendanceTable = qAttendanceTable.parentElement;
  }

  const qColMap = {};
  const qPayrollFieldOrder = [];
  if (qAttendanceTable) {
    const mergedHeaders = getHeaderMatrix(qAttendanceTable);
    mergedHeaders.forEach((text, index) => {
      for (const field of PAYROLL_FIELDS) {
        if (!(field.key in qColMap)) {
          for (const pat of field.patterns) {
            if (pat.test(text)) {
              qColMap[field.key] = index;
              break;
            }
          }
        }
      }
    });

    const matchedFields = [];
    mergedHeaders.forEach(text => {
      for (const field of PAYROLL_FIELDS) {
        for (const pat of field.patterns) {
          if (pat.test(text)) {
            if (!matchedFields.includes(field.key)) {
              matchedFields.push(field.key);
            }
            break;
          }
        }
      }
    });
    qPayrollFieldOrder.push(...matchedFields);
  }

  const rowsData = [];
  const debugRows = [];

  let lastValidDate = null;
  let lastValidRawText = "";

  const rows = Array.from((qAttendanceTable || document).querySelectorAll("tr"));

  for (const row of rows) {
    const allCells = Array.from(row.querySelectorAll("th, td"));
    if (allCells.length < 1) continue;

    // ── Find date for this row ──────────────────────────────────────────────
    const found = findDateInRow(allCells);
    if (found) {
      lastValidDate = found.date;
      lastValidRawText = found.rawText;
    }
    const date = lastValidDate;
    const rawDateText = lastValidRawText;

    debugRows.push({
      date,
      cellsCount: allCells.length,
      classes: allCells.map(c => c.className || "(none)"),
      texts: allCells.map(c => c.textContent.trim().substring(0, 60))
    });

    if (!date) continue;

    // ── Strategy 1: QRpho CSS-class layout ─────────────────────────────────
    // Each row that belongs to a date has:
    //   N × <td class="data-img">   (photos, index 0..N-1 = slot order)
    //   N × <td class="data-time">  (times, index 0..N-1 = slot order)
    //   "data-time no-log" means that slot has no entry
    const imgCells  = Array.from(row.querySelectorAll("td.data-img"));
    const timeCells = Array.from(row.querySelectorAll("td.data-time"));

    if (timeCells.length > 0) {
      const logs = [];
      for (let i = 0; i < timeCells.length; i++) {
        const timeCell = timeCells[i];
        // Skip no-log cells
        if (timeCell.classList.contains("no-log")) continue;

        const text = timeCell.textContent.trim();
        const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})/);
        if (!timeMatch) continue;

        // Photo from corresponding imgCell
        let imgSrc = null;
        const imgCell = imgCells[i];
        if (imgCell) {
          imgSrc = getActualImgSrc(imgCell);
          if (!imgSrc && imgCell.querySelector("i.wp-menu-image")) {
            imgSrc = "placeholder_avatar";
          }
        }

        const latMatch = text.match(/Lat:\s*([-\d.]+)/i);
        const lonMatch = text.match(/Lon:\s*([-\d.]+)/i);

        logs.push({
          slot: SLOT_NAMES[i] || `Slot ${i + 1}`,
          time: timeMatch[1],
          photo: imgSrc,
          hasPhoto: !!imgSrc && !imgSrc.includes("placeholder") && !imgSrc.includes("avatar") && !imgSrc.includes("selfie"),
          lat: latMatch ? latMatch[1] : "",
          lon: lonMatch ? lonMatch[1] : ""
        });
      }

      // ── Extract payroll from this row ──────────────────────────────────────
      const payroll = {};
      const payrollCells = Array.from(row.querySelectorAll("td")).filter(td => 
        !td.classList.contains("data-img") &&
        !td.classList.contains("data-time") &&
        !td.classList.contains("total-nd")
      );
      
      const finalPayrollCells = payrollCells.slice(-7);
      const QRPHO_PAYROLL_ORDER = [
        "totalWorkHours",
        "officeHours",
        "overtimeHours",
        "holidayCredit",
        "leaveCredit",
        "totalPayrollHours",
        "undertime"
      ];
      
      QRPHO_PAYROLL_ORDER.forEach((fieldKey, pi) => {
        const cell = finalPayrollCells[pi];
        const val = cell ? cell.textContent.replace(/\u00a0/g, "").trim() : "";
        payroll[fieldKey] = /^\d{1,3}(:\d{2}){0,2}$/.test(val) ? val : "";
      });

      if (logs.length > 0) {
        rowsData.push({ date, rawDateText, logs, payroll });
      }
      continue; // handled by Strategy 1, skip Strategy 2

    }

    // ── Strategy 2: Positional 9-column layout ──────────────────────────────
    // (Date | AM-In-Img | AM-In-Time | AM-Out-Img | AM-Out-Time | PM-In-Img | PM-In-Time | PM-Out-Img | PM-Out-Time)
    if (allCells.length >= 9) {
      const parseSlot = (imgCell, textCell, slotName) => {
        if (!textCell) return null;
        const text = textCell.textContent.trim();
        const timeMatch = text.match(/(\d{2}:\d{2}:\d{2})/);
        if (!timeMatch) return null;
        let imgSrc = null;
        if (imgCell) {
          imgSrc = getActualImgSrc(imgCell);
          if (!imgSrc && imgCell.querySelector("i.wp-menu-image")) {
            imgSrc = "placeholder_avatar";
          }
        }
        const latMatch = text.match(/Lat:\s*([-\d.]+)/i);
        const lonMatch = text.match(/Lon:\s*([-\d.]+)/i);
        return {
          slot: slotName,
          time: timeMatch[1],
          photo: imgSrc,
          hasPhoto: !!imgSrc && !imgSrc.includes("placeholder") && !imgSrc.includes("avatar") && !imgSrc.includes("selfie"),
          lat: latMatch ? latMatch[1] : "",
          lon: lonMatch ? lonMatch[1] : ""
        };
      };
      const logs = [
        parseSlot(allCells[1], allCells[2], "AM In"),
        parseSlot(allCells[3], allCells[4], "AM Out"),
        parseSlot(allCells[5], allCells[6], "PM In"),
        parseSlot(allCells[7], allCells[8], "PM Out")
      ].filter(Boolean);

      // Extract payroll summary
      const payroll2 = {};
      for (const field of PAYROLL_FIELDS) {
        if (field.key in qColMap) {
          const idx = qColMap[field.key];
          const cell = allCells[idx];
          const val = cell ? cell.textContent.replace(/\u00a0/g, "").trim() : "";
          payroll2[field.key] = /^\d{1,3}(:\d{2}){0,2}$/.test(val) ? val : "";
        } else {
          payroll2[field.key] = "";
        }
      }

      if (logs.length > 0) {
        rowsData.push({ date, rawDateText, logs, payroll: payroll2 });
      }
    }
  }

  return {
    employeeName,
    records: rowsData,
    debug: debugRows
  };
}

// Listen for window message from the parent dashboard page
window.addEventListener("message", (event) => {
  if (event.data && event.data.action === "scrape_attendance") {
    const pageType = detectPageType();
    
    if (pageType === "leyeco") {
      const leyecoData = scrapeLeyeco();
      window.parent.postMessage({
        action: "attendance_scraped",
        type: "leyeco",
        data: leyecoData
      }, "*");
    } else if (pageType === "qrpho") {
      const qrphoData = scrapeQrpho();
      window.parent.postMessage({
        action: "attendance_scraped",
        type: "qrpho",
        data: qrphoData
      }, "*");
    }
  }
});

console.log("Attendance Matcher content script injected and running.");
