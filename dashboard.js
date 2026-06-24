// State of the application
const state = {
    leyecoData: null,
    qrphoData: null,
    scrapingActive: false,
    scrapeTimeout: null,
    drawerState: 'split' // 'minimized', 'split', 'maximized'
};

const USER_SILHOUETTE_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%239ca3af"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

// DOM Elements
const leyecoUrlInput = document.getElementById('leyecoUrl');
const qrphoUrlInput = document.getElementById('qrphoUrl');
const leyecoFrame = document.getElementById('leyecoFrame');
const qrphoFrame = document.getElementById('qrphoFrame');
const compareBtn = document.getElementById('compareBtn');
const extractBtn = document.getElementById('extractBtn');

const leyecoStatus = document.getElementById('leyecoStatus');
const qrphoStatus = document.getElementById('qrphoStatus');

const comparisonDrawer = document.getElementById('comparisonDrawer');
const drawerHeader = document.getElementById('drawerHeader');
const btnToggleMin = document.getElementById('btnToggleMin');
const btnToggleMax = document.getElementById('btnToggleMax');

const comparisonWelcome = document.getElementById('comparisonWelcome');
const summaryContainer = document.getElementById('summaryContainer');
const tableContainer = document.getElementById('tableContainer');
const comparisonTableBody = document.getElementById('comparisonTableBody');
const comparisonSummaryBadge = document.getElementById('comparisonSummaryBadge');

// Google Sheets Sync DOM Elements
const sheetsSettingsModal = document.getElementById('sheetsSettingsModal');
const sheetsSettingsBtn = document.getElementById('sheetsSettingsBtn');
const sheetsSettingsCloseBtn = document.getElementById('sheetsSettingsCloseBtn');
const sheetsAppUrlInput = document.getElementById('sheetsAppUrl');
const sheetsTabNameInput = document.getElementById('sheetsTabName');
const btnSaveSheetsSettings = document.getElementById('btnSaveSheetsSettings');
const btnCopyScriptCode = document.getElementById('btnCopyScriptCode');
const syncSheetBtn = document.getElementById('syncSheetBtn');

// Summary Metric Elements
const statMatchRate = document.getElementById('statMatchRate');
const statMatchRateDesc = document.getElementById('statMatchRateDesc');
const statTotalDays = document.getElementById('statTotalDays');
const statTotalDaysDesc = document.getElementById('statTotalDaysDesc');
const statMismatches = document.getElementById('statMismatches');
const statMismatchesDesc = document.getElementById('statMismatchesDesc');
const statMissing = document.getElementById('statMissing');
const statMissingDesc = document.getElementById('statMissingDesc');

// Lightbox Elements
const lightboxModal = document.getElementById('lightboxModal');
const lightboxCloseBtn = document.getElementById('lightboxCloseBtn');
const lightboxTitle = document.getElementById('lightboxTitle');
const lightboxSubtitle = document.getElementById('lightboxSubtitle');
const lightboxLeyecoImg = document.getElementById('lightboxLeyecoImg');
const lightboxQrphoImg = document.getElementById('lightboxQrphoImg');
const lightboxLeyecoTime = document.getElementById('lightboxLeyecoTime');
const lightboxQrphoTime = document.getElementById('lightboxQrphoTime');
const lightboxQrphoCoords = document.getElementById('lightboxQrphoCoords');

// Presets
document.getElementById('leyecoPresetVercel').addEventListener('click', () => {
    navigateIframe(leyecoFrame, leyecoUrlInput, 'https://leyeco3-payroll.vercel.app/attendance/report');
});
document.getElementById('leyecoPresetNet').addEventListener('click', () => {
    navigateIframe(leyecoFrame, leyecoUrlInput, 'https://leyeco3.net/');
});
document.getElementById('qrphoPresetDemo').addEventListener('click', () => {
    navigateIframe(qrphoFrame, qrphoUrlInput, 'https://qrpayroll-demo.qrpho.com/wp-admin/admin.php?page=attendance_report');
});

// Load URLs on Enter keypress
leyecoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        navigateIframe(leyecoFrame, leyecoUrlInput, leyecoUrlInput.value);
    }
});
qrphoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        navigateIframe(qrphoFrame, qrphoUrlInput, qrphoUrlInput.value);
    }
});

function navigateIframe(iframe, inputEl, url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }
    inputEl.value = url;
    iframe.src = url;
}

// Track iframe load status
leyecoFrame.addEventListener('load', () => {
    leyecoStatus.className = 'pane-status connected';
});
qrphoFrame.addEventListener('load', () => {
    qrphoStatus.className = 'pane-status connected';
});

// Compare button trigger
compareBtn.addEventListener('click', startComparison);

function startComparison() {
    if (state.scrapingActive) return;

    state.leyecoData = null;
    state.qrphoData = null;
    state.scrapingActive = true;
    
    extractBtn.style.display = 'none';
    syncSheetBtn.style.display = 'none';
    compareBtn.disabled = true;
    compareBtn.innerHTML = `Scanning... <span class="btn-spinner" style="display:inline-block; animation: spin-pulse 1s infinite linear;">🔄</span>`;

    // Trigger scrape command in both iframes via postMessage
    try {
        leyecoFrame.contentWindow.postMessage({ action: 'scrape_attendance' }, '*');
    } catch(e) {
        console.error("Leyeco Frame Error:", e);
    }
    try {
        qrphoFrame.contentWindow.postMessage({ action: 'scrape_attendance' }, '*');
    } catch(e) {
        console.error("QRpho Frame Error:", e);
    }

    // Set fallback timeout (8 seconds)
    state.scrapeTimeout = setTimeout(() => {
        if (state.scrapingActive) {
            state.scrapingActive = false;
            compareBtn.disabled = false;
            compareBtn.innerHTML = `Compare Logs ⚡`;
            
            let msg = "Scraping timed out. ";
            if (!state.leyecoData) msg += "Leyeco III could not be reached. ";
            if (!state.qrphoData) msg += "QRpho could not be reached. ";
            msg += "Please ensure both tabs are logged in and display attendance records.";
            
            alert(msg);
        }
    }, 8000);
}

// Listen for messages from iframes containing scraped data
window.addEventListener('message', (event) => {
    if (!event.data || event.data.action !== 'attendance_scraped') return;

    if (event.data.type === 'leyeco') {
        state.leyecoData = event.data.data;
        console.log("Scraped Leyeco Data:", state.leyecoData);
    } else if (event.data.type === 'qrpho') {
        state.qrphoData = event.data.data;
        console.log("Scraped QRpho Data:", state.qrphoData);
    }

    // Check if both payloads have arrived
    if (state.leyecoData && state.qrphoData) {
        clearTimeout(state.scrapeTimeout);
        state.scrapingActive = false;
        compareBtn.disabled = false;
        compareBtn.innerHTML = `Compare Logs ⚡`;
        
        processComparison();
    }
});

// Normalize time strings to seconds
function parseTimeToSeconds(timeStr) {
    if (!timeStr || timeStr.includes("Logged")) return null;
    const parts = timeStr.split(':');
    if (parts.length < 3) return null;
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
}

// Calculate absolute difference in seconds between two times
function getTimeDifferenceSeconds(timeStr1, timeStr2) {
    const s1 = parseTimeToSeconds(timeStr1);
    const s2 = parseTimeToSeconds(timeStr2);
    if (s1 === null || s2 === null) return null;
    return Math.abs(s1 - s2);
}

function processComparison() {
    const leyecoRecords = state.leyecoData.records || [];
    const qrphoRecords = state.qrphoData.records || [];

    // Map and group Leyeco records by date, merging logs if there are multiple rows for the same date
    const leyecoMap = {};
    leyecoRecords.forEach(rec => {
        if (!rec.date) return;
        if (!leyecoMap[rec.date]) {
            leyecoMap[rec.date] = {
                date: rec.date,
                rawDateText: rec.rawDateText,
                logs: [],
                payroll: rec.payroll || {}
            };
        }
        if (rec.logs && Array.isArray(rec.logs)) {
            leyecoMap[rec.date].logs.push(...rec.logs);
        }
        // Merge payroll — take the first non-empty value found
        if (rec.payroll) {
            for (const k of Object.keys(rec.payroll)) {
                if (!leyecoMap[rec.date].payroll[k] && rec.payroll[k]) {
                    leyecoMap[rec.date].payroll[k] = rec.payroll[k];
                }
            }
        }
    });

    // Map and group QRpho records by date, merging logs if there are multiple rows for the same date
    const qrphoMap = {};
    qrphoRecords.forEach(rec => {
        if (!rec.date) return;
        if (!qrphoMap[rec.date]) {
            qrphoMap[rec.date] = {
                date: rec.date,
                rawDateText: rec.rawDateText,
                logs: [],
                payroll: rec.payroll || {}
            };
        }
        if (rec.logs && Array.isArray(rec.logs)) {
            qrphoMap[rec.date].logs.push(...rec.logs);
        }
        // Merge payroll
        if (rec.payroll) {
            for (const k of Object.keys(rec.payroll)) {
                if (!qrphoMap[rec.date].payroll[k] && rec.payroll[k]) {
                    qrphoMap[rec.date].payroll[k] = rec.payroll[k];
                }
            }
        }
    });

    const datesSet = new Set([
        ...Object.keys(leyecoMap),
        ...Object.keys(qrphoMap)
    ]);

    const sortedDates = Array.from(datesSet).sort();

    // Reset table rows
    comparisonTableBody.innerHTML = '';

    let totalCheckedDays = 0;
    let perfectMatches = 0;
    let timeMismatches = 0;
    let missingLogs = 0;

    sortedDates.forEach(date => {
        const leyecoRec = leyecoMap[date];
        const qrphoRec = qrphoMap[date];

        const hasLeyecoLogs = leyecoRec && leyecoRec.logs && leyecoRec.logs.length > 0;
        const hasQrphoLogs = qrphoRec && qrphoRec.logs && qrphoRec.logs.length > 0;

        if (!hasLeyecoLogs && !hasQrphoLogs) {
            return; // skip completely empty days
        }

        totalCheckedDays++;

        // Define slots to match
        const slots = ['AM In', 'AM Out', 'PM In', 'PM Out'];

        const alignments = [];

        slots.forEach(slotName => {
            const lLogs = leyecoRec && leyecoRec.logs ? leyecoRec.logs.filter(l => l.slot === slotName) : [];
            const qLogs = qrphoRec && qrphoRec.logs ? qrphoRec.logs.filter(l => l.slot === slotName) : [];

            // Match logs by proximity
            const matchedQIndices = new Set();

            lLogs.forEach(lLog => {
                let bestQLog = null;
                let bestQIndex = -1;
                let minDiff = Infinity;

                qLogs.forEach((qLog, idx) => {
                    if (matchedQIndices.has(idx)) return;
                    const diff = getTimeDifferenceSeconds(lLog.time, qLog.time);
                    if (diff !== null && diff < minDiff) {
                        minDiff = diff;
                        bestQLog = qLog;
                        bestQIndex = idx;
                    }
                });

                if (bestQLog) {
                    matchedQIndices.add(bestQIndex);
                    alignments.push({
                        slotName: slotName,
                        leyeco: lLog,
                        qrpho: bestQLog,
                        diff: minDiff
                    });
                } else {
                    alignments.push({
                        slotName: slotName,
                        leyeco: lLog,
                        qrpho: null,
                        diff: null
                    });
                }
            });

            // Any remaining unmatched QRpho logs
            qLogs.forEach((qLog, idx) => {
                if (!matchedQIndices.has(idx)) {
                    alignments.push({
                        slotName: slotName,
                        leyeco: null,
                        qrpho: qLog,
                        diff: null
                    });
                }
            });
        });

        // Render comparative row
        const tr = document.createElement('tr');
        
        // Date Cell
        const tdDate = document.createElement('td');
        tdDate.className = 'td-date';
        const formattedDateStr = formatDateHuman(date);
        const rawDateLabelText = leyecoRec ? leyecoRec.rawDateText : (qrphoRec ? qrphoRec.rawDateText : '');
        tdDate.innerHTML = `${formattedDateStr}<br><span style="font-size: 10px; color: var(--text-muted); font-weight: normal;">${rawDateLabelText.split(' ')[1] || ''}</span>`;
        tr.appendChild(tdDate);

        // Leyeco III Records Cell
        const tdLeyeco = document.createElement('td');
        const leyecoCellContent = document.createElement('div');
        leyecoCellContent.className = 'log-cell-content';
        
        // QRpho Records Cell
        const tdQrpho = document.createElement('td');
        const qrphoCellContent = document.createElement('div');
        qrphoCellContent.className = 'log-cell-content';

        let rowStatus = 'match'; 
        let hasPhotoPair = false;
        let photoPairData = null;

        // Build records visual elements
        alignments.forEach(pair => {
            // Render Leyeco Badge
            if (pair.leyeco) {
                const badge = createLogBadgeHtml(pair.slotName, pair.leyeco.time, pair.leyeco.photo);
                leyecoCellContent.appendChild(badge);
            }

            // Render QRpho Badge
            if (pair.qrpho) {
                const badge = createLogBadgeHtml(pair.slotName, pair.qrpho.time, pair.qrpho.photo, pair.qrpho.lat, pair.qrpho.lon);
                qrphoCellContent.appendChild(badge);
            }

            // Evaluate statuses
            if (pair.leyeco && pair.qrpho) {
                if (pair.diff !== null && pair.diff > 120) { // More than 2 minutes clock difference
                    if (rowStatus !== 'missing') rowStatus = 'mismatch';
                    timeMismatches++;
                } else {
                    perfectMatches++;
                }

                // If both have photos, enable zoom inspect
                if (pair.leyeco.photo && pair.qrpho.photo) {
                    hasPhotoPair = true;
                    photoPairData = {
                        date: date,
                        slotName: pair.slotName,
                        leyecoTime: pair.leyeco.time,
                        leyecoImg: pair.leyeco.photo,
                        qrphoTime: pair.qrpho.time,
                        qrphoImg: pair.qrpho.photo,
                        coords: pair.qrpho.lat ? `Lat: ${pair.qrpho.lat}, Lon: ${pair.qrpho.lon}` : ''
                    };
                }
            } else {
                rowStatus = 'missing';
                missingLogs++;
            }
        });

        tdLeyeco.appendChild(leyecoCellContent);
        tdQrpho.appendChild(qrphoCellContent);
        tr.appendChild(tdLeyeco);
        tr.appendChild(tdQrpho);

        // Status Match Cell
        const tdStatus = document.createElement('td');
        let statusBadgeClass = 'status-badge match';
        let statusBadgeText = '✅ Sync Match';
        
        if (rowStatus === 'mismatch') {
            statusBadgeClass = 'status-badge mismatch';
            statusBadgeText = '⚠️ Time Drift';
        } else if (rowStatus === 'missing') {
            statusBadgeClass = 'status-badge missing';
            statusBadgeText = '❌ Unmatched';
        }

        tdStatus.innerHTML = `<span class="${statusBadgeClass}">${statusBadgeText}</span>`;
        tr.appendChild(tdStatus);

        // Photo Compare Cell
        const tdPhoto = document.createElement('td');
        if (hasPhotoPair && photoPairData) {
            const btn = document.createElement('button');
            btn.className = 'row-action-btn';
            btn.innerHTML = '🔍 Compare Photos';
            btn.addEventListener('click', () => openPhotoLightbox(photoPairData));
            tdPhoto.appendChild(btn);
        } else {
            tdPhoto.innerHTML = `<span style="color: var(--text-muted); font-size: 11px; font-style: italic;">No pairs</span>`;
        }
        tr.appendChild(tdPhoto);

        comparisonTableBody.appendChild(tr);

        // ── Payroll Summary Row: only show fields that DIFFER ─────────────────
        const PAYROLL_LABELS = [
            { key: 'totalWorkHours',    label: 'Total Work Hrs' },
            { key: 'officeHours',       label: 'Office Hrs' },
            { key: 'overtimeHours',     label: 'Overtime' },
            { key: 'holidayCredit',     label: 'Holiday Credit' },
            { key: 'leaveCredit',       label: 'Leave Credit' },
            { key: 'totalPayrollHours', label: 'Total Payroll Hrs' },
            { key: 'undertime',         label: 'Undertime' },
        ];

        const lPay = (leyecoRec && leyecoRec.payroll) ? leyecoRec.payroll : {};
        const qPay = (qrphoRec  && qrphoRec.payroll)  ? qrphoRec.payroll  : {};
        const isEmpty = v => !v || v === '00:00:00' || v === '0';

        // Collect only the fields that don't match
        const payrollMismatches = PAYROLL_LABELS.filter(field => {
            const lVal = (lPay[field.key] || '').replace(/\s+/g, ' ').trim();
            const qVal = (qPay[field.key] || '').replace(/\s+/g, ' ').trim();
            const lEmpty = isEmpty(lVal);
            const qEmpty = isEmpty(qVal);
            if (lEmpty && qEmpty) return false; // both blank → not a mismatch
            return lVal !== qVal; // different values = mismatch
        });

        if (payrollMismatches.length > 0) {
            const trPayroll = document.createElement('tr');
            trPayroll.className = 'payroll-summary-row';

            // Empty date cell
            const tdPayDate = document.createElement('td');
            trPayroll.appendChild(tdPayDate);

            // Single spanning cell across Leyeco + QRpho columns showing all mismatches
            const tdMismatch = document.createElement('td');
            tdMismatch.colSpan = 2;

            const mismatchDiv = document.createElement('div');
            mismatchDiv.className = 'payroll-mismatch-list';

            payrollMismatches.forEach(field => {
                const lVal = (lPay[field.key] || '').replace(/\s+/g, ' ').trim() || '—';
                const qVal = (qPay[field.key] || '').replace(/\s+/g, ' ').trim() || '—';

                const chip = document.createElement('div');
                chip.className = 'pay-diff-chip';
                chip.title = 'Click to copy to clipboard';
                chip.innerHTML =
                    `<span class="pay-field-name">${field.label}</span>` +
                    `<span class="pay-leyeco-val">Leyeco: <strong>${lVal}</strong></span>` +
                    `<span class="pay-arrow">→</span>` +
                    `<span class="pay-qrpho-val">QRpho: <strong>${qVal}</strong></span>`;
                
                chip.addEventListener('click', () => {
                    const textToCopy = `${formattedDateStr} - ${field.label} - Leyeco: ${lVal} → QRpho: ${qVal}`;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        chip.classList.add('copied');
                        showToast(`Copied discrepancy details: "${textToCopy}"`);
                        setTimeout(() => {
                            chip.classList.remove('copied');
                        }, 1000);
                    }).catch(err => {
                        console.error('Failed to copy text: ', err);
                    });
                });

                mismatchDiv.appendChild(chip);
            });

            tdMismatch.appendChild(mismatchDiv);
            trPayroll.appendChild(tdMismatch);

            // Status badge
            const tdPayStatus = document.createElement('td');
            tdPayStatus.innerHTML = `<span class="status-badge mismatch" style="font-size:10px;">⚠️ Hours Differ</span>`;
            trPayroll.appendChild(tdPayStatus);

            // Empty photo cell
            trPayroll.appendChild(document.createElement('td'));

            comparisonTableBody.appendChild(trPayroll);
        }

    });

    // Calculate overall stats
    const totalChecks = perfectMatches + timeMismatches + missingLogs;
    const matchRatePercent = totalChecks > 0 
        ? Math.round((perfectMatches / totalChecks) * 100) 
        : 100;

    // Update Widgets
    statMatchRate.textContent = `${matchRatePercent}%`;
    statMatchRateDesc.innerHTML = matchRatePercent >= 90 ? `🟢 Outstanding accuracy` : `🟡 Discrepancies detected`;
    
    statTotalDays.innerHTML = `${totalCheckedDays} <span>days</span>`;
    statTotalDaysDesc.textContent = `Comparing logs across the period`;

    statMismatches.innerHTML = `${timeMismatches} <span>mismatches</span>`;
    statMismatchesDesc.innerHTML = timeMismatches === 0 ? `🟢 Clocks aligned` : `⚠️ Clock variations found`;

    statMissing.innerHTML = `${missingLogs} <span>missing</span>`;
    statMissingDesc.innerHTML = missingLogs === 0 ? `🟢 Complete records` : `🔴 Missing entry items`;

    // Update badge count
    comparisonSummaryBadge.className = matchRatePercent >= 90 ? 'status-badge match' : 'status-badge mismatch';
    comparisonSummaryBadge.textContent = `${matchRatePercent}% Match Rate`;

    // Swap displays
    comparisonWelcome.style.display = 'none';
    summaryContainer.style.display = 'grid';
    tableContainer.style.display = 'block';
    extractBtn.style.display = 'flex';
    syncSheetBtn.style.display = 'flex';

    // Populate debug panel
    const debugDetails = document.getElementById('debugDetails');
    const debugOutput = document.getElementById('debugOutput');
    if (debugDetails && debugOutput) {
        debugDetails.style.display = 'block';
        debugOutput.textContent = JSON.stringify({
            employeeLeyeco: state.leyecoData ? state.leyecoData.employeeName : null,
            employeeQrpho: state.qrphoData ? state.qrphoData.employeeName : null,
            leyecoDebug: state.leyecoData ? state.leyecoData.debug : null,
            qrphoDebug: state.qrphoData ? state.qrphoData.debug : null
        }, null, 2);
    }

    // Slide up panel if minimized
    if (state.drawerState === 'minimized') {
        toggleDrawerState('split');
    }
}

// Format date into human-readable
function formatDateHuman(dateStr) {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[parseInt(parts[1], 10) - 1];
    return `${month} ${parts[2]}, ${parts[0]}`;
}

// Generate log element pill
function createLogBadgeHtml(label, time, photoSrc, lat, lon) {
    const badge = document.createElement('div');
    badge.className = 'log-badge';

    // Image Thumbnail
    if (photoSrc) {
        const wrapper = document.createElement('div');
        wrapper.className = 'log-thumbnail-wrapper';
        const img = document.createElement('img');
        img.className = 'log-thumbnail';
        img.src = photoSrc === "placeholder_avatar" ? USER_SILHOUETTE_SVG : photoSrc;
        wrapper.appendChild(img);
        
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            openSinglePhotoModal(label, time, photoSrc, lat, lon);
        });
        
        badge.appendChild(wrapper);
    }

    const details = document.createElement('div');
    details.style.display = 'flex';
    details.style.flexDirection = 'column';

    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.alignItems = 'center';
    topRow.style.gap = '4px';

    const typeInd = document.createElement('span');
    typeInd.className = 'log-type-indicator';
    typeInd.textContent = label;
    topRow.appendChild(typeInd);

    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = time;
    topRow.appendChild(timeSpan);
    
    details.appendChild(topRow);

    if (lat && lon) {
        const coordsSpan = document.createElement('span');
        coordsSpan.className = 'log-coords';
        coordsSpan.innerHTML = `📍 ${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)}`;
        details.appendChild(coordsSpan);
    }

    badge.appendChild(details);
    return badge;
}

// Lightbox Modal functions
function openPhotoLightbox(data) {
    lightboxTitle.textContent = data.date ? `Verify Attendance Match: ${formatDateHuman(data.date)} (${data.slotName})` : `Verify Attendance Photo (${data.slotName})`;
    const empName = cleanEmployeeName((state.leyecoData && state.leyecoData.employeeName) || 
                                      (state.qrphoData && state.qrphoData.employeeName) || '');
    lightboxSubtitle.textContent = empName ? `Selected employee: ${empName}` : '';
    
    lightboxLeyecoImg.src = data.leyecoImg === "placeholder_avatar" ? USER_SILHOUETTE_SVG : data.leyecoImg;
    lightboxLeyecoTime.textContent = data.leyecoTime;

    lightboxQrphoImg.src = data.qrphoImg === "placeholder_avatar" ? USER_SILHOUETTE_SVG : data.qrphoImg;
    lightboxQrphoTime.textContent = data.qrphoTime;
    
    if (data.coords) {
        const latLon = data.coords.replace('Lat: ', '').replace('Lon: ', '').split(', ');
        if (latLon.length === 2) {
            lightboxQrphoCoords.innerHTML = `📍 GPS Location:<br><strong>${data.coords}</strong><br><a href="https://www.google.com/maps/search/?api=1&query=${latLon[0]},${latLon[1]}" target="_blank" style="color: var(--primary); text-decoration: underline; font-size: 10px;">View on Google Maps</a>`;
        } else {
            lightboxQrphoCoords.innerHTML = `📍 GPS Location:<br><strong>${data.coords}</strong>`;
        }
    } else {
        lightboxQrphoCoords.innerHTML = '';
    }

    lightboxModal.classList.add('active');
}

function closePhotoLightbox() {
    lightboxModal.classList.remove('active');
}

lightboxCloseBtn.addEventListener('click', closePhotoLightbox);
lightboxModal.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
        closePhotoLightbox();
    }
});

// Drawer Layout adjustments (Minimize, Split, Maximize)
drawerHeader.addEventListener('click', (e) => {
    if (e.target.closest('.drawer-controls')) return;
    
    if (state.drawerState === 'minimized') {
        toggleDrawerState('split');
    } else {
        toggleDrawerState('minimized');
    }
});

btnToggleMin.addEventListener('click', () => {
    if (state.drawerState === 'minimized') {
        toggleDrawerState('split');
    } else {
        toggleDrawerState('minimized');
    }
});

btnToggleMax.addEventListener('click', () => {
    if (state.drawerState === 'maximized') {
        toggleDrawerState('split');
    } else {
        toggleDrawerState('maximized');
    }
});

function toggleDrawerState(targetState) {
    state.drawerState = targetState;
    const splitView = document.getElementById('splitViewContainer');

    if (targetState === 'minimized') {
        comparisonDrawer.className = 'comparison-drawer minimized';
        comparisonDrawer.style.height = '';
        splitView.style.height = 'calc(100vh - 110px)';
        btnToggleMin.textContent = '➕';
        btnToggleMax.textContent = '🔲';
    } else if (targetState === 'maximized') {
        comparisonDrawer.className = 'comparison-drawer maximized';
        comparisonDrawer.style.height = '';
        splitView.style.height = '0px';
        btnToggleMin.textContent = '➖';
        btnToggleMax.textContent = '🗗';
    } else {
        comparisonDrawer.className = 'comparison-drawer';
        splitView.style.height = 'calc(100vh - 450px)';
        btnToggleMin.textContent = '➖';
        btnToggleMax.textContent = '🔲';
        comparisonDrawer.style.height = '380px';
    }
}

// Initial positioning on page load
toggleDrawerState('split');

// ── Excel Export Modal & Logic ───────────────────────────────────────────
const extractModal = document.getElementById('extractModal');
const extractCloseBtn = document.getElementById('extractCloseBtn');
const extractTextarea = document.getElementById('extractTextarea');
const btnCopyExtract = document.getElementById('btnCopyExtract');

function openExtractModal() {
    const formattedData = generateExcelFormat();
    extractTextarea.value = formattedData;
    extractModal.classList.add('active');
}

function closeExtractModal() {
    extractModal.classList.remove('active');
}

extractBtn.addEventListener('click', openExtractModal);
extractCloseBtn.addEventListener('click', closeExtractModal);
extractModal.addEventListener('click', (e) => {
    if (e.target === extractModal) {
        closeExtractModal();
    }
});

btnCopyExtract.addEventListener('click', () => {
    extractTextarea.select();
    navigator.clipboard.writeText(extractTextarea.value).then(() => {
        const originalText = btnCopyExtract.innerHTML;
        btnCopyExtract.innerHTML = 'Copied! ✓';
        setTimeout(() => {
            btnCopyExtract.innerHTML = originalText;
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert('Failed to copy to clipboard automatically. Please press Ctrl+C to copy.');
    });
});

function generateExcelFormat() {
    if (!state.leyecoData && !state.qrphoData) return '';

    // Get the employee name
    const rawEmployeeName = (state.qrphoData && state.qrphoData.employeeName) || 
                            (state.leyecoData && state.leyecoData.employeeName) || 
                            'N/A';
    const employeeName = cleanEmployeeName(rawEmployeeName);

    // Get sorted dates list
    const leyecoRecords = state.leyecoData ? state.leyecoData.records || [] : [];
    const qrphoRecords = state.qrphoData ? state.qrphoData.records || [] : [];

    const leyecoMap = {};
    leyecoRecords.forEach(rec => {
        if (!rec.date) return;
        if (!leyecoMap[rec.date]) {
            leyecoMap[rec.date] = { logs: [], payroll: rec.payroll || {} };
        }
        if (rec.logs) leyecoMap[rec.date].logs.push(...rec.logs);
        if (rec.payroll) {
            for (const k of Object.keys(rec.payroll)) {
                if (!leyecoMap[rec.date].payroll[k] && rec.payroll[k]) {
                    leyecoMap[rec.date].payroll[k] = rec.payroll[k];
                }
            }
        }
    });

    const qrphoMap = {};
    qrphoRecords.forEach(rec => {
        if (!rec.date) return;
        if (!qrphoMap[rec.date]) {
            qrphoMap[rec.date] = { logs: [], payroll: rec.payroll || {} };
        }
        if (rec.logs) qrphoMap[rec.date].logs.push(...rec.logs);
        if (rec.payroll) {
            for (const k of Object.keys(rec.payroll)) {
                if (!qrphoMap[rec.date].payroll[k] && qrphoMap[rec.date].payroll[k] !== rec.payroll[k]) {
                    qrphoMap[rec.date].payroll[k] = rec.payroll[k];
                }
            }
        }
    });

    const datesSet = new Set([
        ...Object.keys(leyecoMap),
        ...Object.keys(qrphoMap)
    ]);
    const sortedDates = Array.from(datesSet).sort();

    // ── Find mismatch dates ──────────────────────────────────────────────
    const mismatchDates = new Set();

    sortedDates.forEach(date => {
        const leyecoRec = leyecoMap[date];
        const qrphoRec = qrphoMap[date];

        const hasLeyecoLogs = leyecoRec && leyecoRec.logs && leyecoRec.logs.length > 0;
        const hasQrphoLogs = qrphoRec && qrphoRec.logs && qrphoRec.logs.length > 0;

        if (!hasLeyecoLogs && !hasQrphoLogs) {
            return; // skip completely empty days
        }

        let isMismatch = false;

        // Check slots
        const slots = ['AM In', 'AM Out', 'PM In', 'PM Out'];
        const alignments = [];

        slots.forEach(slotName => {
            const lLogs = leyecoRec && leyecoRec.logs ? leyecoRec.logs.filter(l => l.slot === slotName) : [];
            const qLogs = qrphoRec && qrphoRec.logs ? qrphoRec.logs.filter(l => l.slot === slotName) : [];

            const matchedQIndices = new Set();

            lLogs.forEach(lLog => {
                let bestQLog = null;
                let bestQIndex = -1;
                let minDiff = Infinity;

                qLogs.forEach((qLog, idx) => {
                    if (matchedQIndices.has(idx)) return;
                    const diff = getTimeDifferenceSeconds(lLog.time, qLog.time);
                    if (diff !== null && diff < minDiff) {
                        minDiff = diff;
                        bestQLog = qLog;
                        bestQIndex = idx;
                    }
                });

                if (bestQLog) {
                    matchedQIndices.add(bestQIndex);
                    alignments.push({
                        slotName: slotName,
                        leyeco: lLog,
                        qrpho: bestQLog,
                        diff: minDiff
                    });
                } else {
                    alignments.push({
                        slotName: slotName,
                        leyeco: lLog,
                        qrpho: null,
                        diff: null
                    });
                }
            });

            qLogs.forEach((qLog, idx) => {
                if (!matchedQIndices.has(idx)) {
                    alignments.push({
                        slotName: slotName,
                        leyeco: null,
                        qrpho: qLog,
                        diff: null
                    });
                }
            });
        });

        // Evaluate alignments for time drift or unmatched slot logs
        for (const pair of alignments) {
            if (pair.leyeco && pair.qrpho) {
                if (pair.diff !== null && pair.diff > 120) {
                    isMismatch = true; // Time Drift
                    break;
                }
            } else {
                isMismatch = true; // Unmatched log
                break;
            }
        }

        // Check payroll hours mismatch
        if (!isMismatch) {
            const PAYROLL_LABELS = [
                { key: 'totalWorkHours' },
                { key: 'officeHours' },
                { key: 'overtimeHours' },
                { key: 'holidayCredit' },
                { key: 'leaveCredit' },
                { key: 'totalPayrollHours' },
                { key: 'undertime' }
            ];

            const lPay = (leyecoRec && leyecoRec.payroll) ? leyecoRec.payroll : {};
            const qPay = (qrphoRec  && qrphoRec.payroll)  ? qrphoRec.payroll  : {};
            const isEmpty = v => !v || v === '00:00:00' || v === '0';

            const payrollDiffers = PAYROLL_LABELS.some(field => {
                const lVal = (lPay[field.key] || '').replace(/\s+/g, ' ').trim();
                const qVal = (qPay[field.key] || '').replace(/\s+/g, ' ').trim();
                const lEmpty = isEmpty(lVal);
                const qEmpty = isEmpty(qVal);
                if (lEmpty && qEmpty) return false;
                return lVal !== qVal;
            });

            if (payrollDiffers) {
                isMismatch = true;
            }
        }

        if (isMismatch) {
            mismatchDates.add(date);
        }
    });

    // Format the date range
    let dateRangeStr = '';
    if (sortedDates.length > 0) {
        const firstDate = new Date(sortedDates[0]);
        const lastDate = new Date(sortedDates[sortedDates.length - 1]);
        
        const formatShortDate = (d) => {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const day = d.getDate();
            let suffix = 'th';
            if (day === 1 || day === 21 || day === 31) suffix = 'st';
            else if (day === 2 || day === 22) suffix = 'nd';
            else if (day === 3 || day === 23) suffix = 'rd';
            
            return `${months[d.getMonth()]} ${day}${suffix}`;
        };
        
        if (firstDate.getMonth() === lastDate.getMonth() && firstDate.getFullYear() === lastDate.getFullYear()) {
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const m = months[firstDate.getMonth()];
            const day1 = firstDate.getDate();
            const day2 = lastDate.getDate();
            
            let suffix2 = 'th';
            if (day2 === 1 || day2 === 21 || day2 === 31) suffix2 = 'st';
            else if (day2 === 2 || day2 === 22) suffix2 = 'nd';
            else if (day2 === 3 || day2 === 23) suffix2 = 'rd';
            
            dateRangeStr = `${m} ${day1} - ${day2}${suffix2}`;
        } else {
            dateRangeStr = `${formatShortDate(firstDate)} - ${formatShortDate(lastDate)}`;
        }
    } else {
        dateRangeStr = 'N/A';
    }

    if (mismatchDates.size === 0) {
        return `Name: ${employeeName}\nDate: ${dateRangeStr}\n\nNo discrepancies found. Perfect sync match! 🎉`;
    }

    const headers = [
        'Date', 'AM In', 'AM Out', 'PM In', 'PM Out',
        'Total Work Hrs', 'Office Hrs', 'Overtime',
        'Holiday Credit', 'Leave Credit', 'Total Payroll Hrs', 'Undertime'
    ];

    const generateTableTSV = (dataMap) => {
        let lines = [];
        lines.push(headers.join('\t'));
        
        sortedDates.forEach(date => {
            if (!mismatchDates.has(date)) return; // ONLY export mismatch dates!
            
            const rec = dataMap[date];
            if (!rec) {
                lines.push([date, '', '', '', '', '', '', '', '', '', '', ''].join('\t'));
                return;
            }
            
            const amIn = rec.logs.find(l => l.slot === 'AM In')?.time || '';
            const amOut = rec.logs.find(l => l.slot === 'AM Out')?.time || '';
            const pmIn = rec.logs.find(l => l.slot === 'PM In')?.time || '';
            const pmOut = rec.logs.find(l => l.slot === 'PM Out')?.time || '';
            
            const pay = rec.payroll || {};
            const totalWork = pay.totalWorkHours || '';
            const office = pay.officeHours || '';
            const overtime = pay.overtimeHours || '';
            const holiday = pay.holidayCredit || '';
            const leave = pay.leaveCredit || '';
            const totalPayroll = pay.totalPayrollHours || '';
            const undertime = pay.undertime || '';
            
            lines.push([
                date, amIn, amOut, pmIn, pmOut,
                totalWork, office, overtime, holiday, leave, totalPayroll, undertime
            ].join('\t'));
        });
        
        return lines.join('\n');
    };

    const qrphoTSV = generateTableTSV(qrphoMap);
    const leyecoTSV = generateTableTSV(leyecoMap);

    return `Name: ${employeeName}\nDate: ${dateRangeStr}\n\nQrpho Data:\n${qrphoTSV}\n\nLeyeco Data:\n${leyecoTSV}`;
}

function cleanEmployeeName(name) {
    if (!name) return '';
    // Split by common delimiters/labels that appear in the raw scraped name
    const parts = name.split(/(?:ID\s*No\.|Department|Branch|Payroll|Work\s*Schedule)/i);
    return parts[0].trim();
}

// ── Single Photo Zoom Modal & Logic ──────────────────────────────────────
const singlePhotoModal = document.getElementById('singlePhotoModal');
const singlePhotoCloseBtn = document.getElementById('singlePhotoCloseBtn');
const singlePhotoTitle = document.getElementById('singlePhotoTitle');
const singlePhotoSubtitle = document.getElementById('singlePhotoSubtitle');
const singlePhotoImg = document.getElementById('singlePhotoImg');
const singlePhotoDetails = document.getElementById('singlePhotoDetails');

function openSinglePhotoModal(label, time, photoSrc, lat, lon) {
    const rawName = (state.qrphoData && state.qrphoData.employeeName) || 
                    (state.leyecoData && state.leyecoData.employeeName) || '';
    const employeeName = cleanEmployeeName(rawName);
    
    singlePhotoTitle.textContent = `${label} Photo`;
    singlePhotoSubtitle.textContent = employeeName ? `Employee: ${employeeName}` : '';
    singlePhotoImg.src = photoSrc === "placeholder_avatar" ? USER_SILHOUETTE_SVG : photoSrc;
    
    let detailsHtml = `Time: <span style="font-weight:700; color:var(--primary);">${time}</span>`;
    if (lat && lon) {
        detailsHtml += `<br><span style="font-size:11px; color:var(--text-muted); margin-top:6px; display:inline-block;">📍 GPS Location: ${lat}, ${lon}</span>`;
    }
    singlePhotoDetails.innerHTML = detailsHtml;
    
    singlePhotoModal.classList.add('active');
}

function closeSinglePhotoModal() {
    singlePhotoModal.classList.remove('active');
}

singlePhotoCloseBtn.addEventListener('click', closeSinglePhotoModal);
singlePhotoModal.addEventListener('click', (e) => {
    if (e.target === singlePhotoModal) {
        closeSinglePhotoModal();
    }
});

// Toast notification helper
function showToast(message) {
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.style.cssText = `
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(16, 185, 129, 0.4);
        color: var(--text-main);
        padding: 12px 18px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        gap: 8px;
        transform: translateY(20px);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
        max-width: 400px;
    `;
    toast.innerHTML = `<span style="color: var(--accent); font-weight: bold;">📋</span> ${message}`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
    }, 10);
    
    setTimeout(() => {
        toast.style.transform = 'translateY(-20px)';
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// ── Google Sheets Sync Modal & Logic ─────────────────────────────────────────
const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetName = data.sheetName || "";
    const employeeName = data.employeeName;
    const month = data.month;
    const attendanceVal = data.attendance || "";
    const remarksVal = data.remarks || "";

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet;
    if (sheetName) {
      sheet = ss.getSheetByName(sheetName);
    } else {
      sheet = ss.getActiveSheet();
    }
    
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet not found: " + sheetName
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Sheet is empty"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Find the employee row in Column A
    let employeeRowIndex = -1;
    const cleanName = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
    const targetCleanName = cleanName(employeeName);

    for (let i = 0; i < rows.length; i++) {
      const rowName = String(rows[i][0] || "");
      if (cleanName(rowName) === targetCleanName) {
        employeeRowIndex = i + 1; // 1-indexed row
        break;
      }
    }

    if (employeeRowIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Employee '" + employeeName + "' not found in Column A."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Find the column indexes for the specified month
    const headers = rows[0];
    let attendanceColIndex = -1;
    const monthShort = month.substring(0, 3).toLowerCase();
    
    for (let j = 0; j < headers.length; j++) {
      const headerText = String(headers[j] || "").toLowerCase();
      if (headerText.includes(monthShort) && headerText.includes("attendance")) {
        attendanceColIndex = j + 1;
        break;
      }
    }

    // Fallback search
    if (attendanceColIndex === -1) {
      for (let j = 0; j < headers.length; j++) {
        const headerText = String(headers[j] || "").toLowerCase();
        if (headerText.includes(monthShort)) {
          attendanceColIndex = j + 1;
          break;
        }
      }
    }

    if (attendanceColIndex === -1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Could not find column for month: " + month
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const remarksColIndex = attendanceColIndex + 1;

    // 3. Write data to the cells
    sheet.getRange(employeeRowIndex, attendanceColIndex).setValue(attendanceVal);
    sheet.getRange(employeeRowIndex, remarksColIndex).setValue(remarksVal);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Successfully updated " + employeeName + " on row " + employeeRowIndex + " for " + month
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

const scriptCodeTextarea = document.getElementById('scriptCodeTextarea');
const sheetsSettingsCloseBtn = document.getElementById('sheetsSettingsCloseBtn');
const sheetsAppUrlInput = document.getElementById('sheetsAppUrl');
const sheetsTabNameInput = document.getElementById('sheetsTabName');
const btnSaveSheetsSettings = document.getElementById('btnSaveSheetsSettings');
const btnCopyScriptCode = document.getElementById('btnCopyScriptCode');

// Helper to get configured Sheets settings
function getSheetsSettings() {
    return {
        url: localStorage.getItem('googleSheetsUrl') || '',
        tabName: localStorage.getItem('googleSheetsTabName') || ''
    };
}

// Open Google Sheets Settings Modal
function openSheetsSettingsModal() {
    const settings = getSheetsSettings();
    sheetsAppUrlInput.value = settings.url;
    sheetsTabNameInput.value = settings.tabName;
    scriptCodeTextarea.value = APPS_SCRIPT_CODE;
    sheetsSettingsModal.classList.add('active');
}

// Close Google Sheets Settings Modal
function closeSheetsSettingsModal() {
    sheetsSettingsModal.classList.remove('active');
}

sheetsSettingsBtn.addEventListener('click', openSheetsSettingsModal);
sheetsSettingsCloseBtn.addEventListener('click', closeSheetsSettingsModal);
sheetsSettingsModal.addEventListener('click', (e) => {
    if (e.target === sheetsSettingsModal) {
        closeSheetsSettingsModal();
    }
});

btnSaveSheetsSettings.addEventListener('click', () => {
    const url = sheetsAppUrlInput.value.trim();
    const tabName = sheetsTabNameInput.value.trim();
    
    if (url && !url.startsWith('https://script.google.com/')) {
        alert('Invalid Web App URL. It should start with https://script.google.com/');
        return;
    }
    
    localStorage.setItem('googleSheetsUrl', url);
    localStorage.setItem('googleSheetsTabName', tabName);
    
    showToast('Google Sheets settings saved successfully!');
    closeSheetsSettingsModal();
});

btnCopyScriptCode.addEventListener('click', () => {
    scriptCodeTextarea.select();
    navigator.clipboard.writeText(scriptCodeTextarea.value).then(() => {
        const originalText = btnCopyScriptCode.innerHTML;
        btnCopyScriptCode.innerHTML = 'Copied! ✓';
        setTimeout(() => {
            btnCopyScriptCode.innerHTML = originalText;
        }, 2000);
    });
});

function triggerSheetsSync() {
    const settings = getSheetsSettings();
    if (!settings.url) {
        showToast('Please configure your Google Sheets Web App URL first.');
        openSheetsSettingsModal();
        return;
    }

    if (!state.leyecoData && !state.qrphoData) {
        showToast('No comparison data available to sync.');
        return;
    }

    // Get the employee name
    const rawEmployeeName = (state.qrphoData && state.qrphoData.employeeName) || 
                            (state.leyecoData && state.leyecoData.employeeName) || 
                            '';
    const employeeName = cleanEmployeeName(rawEmployeeName);
    if (!employeeName) {
        showToast('Could not resolve employee name for sync.');
        return;
    }

    // Identify month and mismatches
    const leyecoRecords = state.leyecoData ? state.leyecoData.records || [] : [];
    const qrphoRecords = state.qrphoData ? state.qrphoData.records || [] : [];

    const leyecoMap = {};
    leyecoRecords.forEach(rec => {
        if (!rec.date) return;
        if (!leyecoMap[rec.date]) {
            leyecoMap[rec.date] = { logs: [], payroll: rec.payroll || {} };
        }
        if (rec.logs) leyecoMap[rec.date].logs.push(...rec.logs);
        if (rec.payroll) {
            for (const k of Object.keys(rec.payroll)) {
                if (!leyecoMap[rec.date].payroll[k] && rec.payroll[k]) {
                    leyecoMap[rec.date].payroll[k] = rec.payroll[k];
                }
            }
        }
    });

    const qrphoMap = {};
    qrphoRecords.forEach(rec => {
        if (!rec.date) return;
        if (!qrphoMap[rec.date]) {
            qrphoMap[rec.date] = { logs: [], payroll: rec.payroll || {} };
        }
        if (rec.logs) qrphoMap[rec.date].logs.push(...rec.logs);
        if (rec.payroll) {
            for (const k of Object.keys(rec.payroll)) {
                if (!qrphoMap[rec.date].payroll[k] && rec.payroll[k]) {
                    qrphoMap[rec.date].payroll[k] = rec.payroll[k];
                }
            }
        }
    });

    const datesSet = new Set([
        ...Object.keys(leyecoMap),
        ...Object.keys(qrphoMap)
    ]);
    const sortedDates = Array.from(datesSet).sort();

    if (sortedDates.length === 0) {
        showToast('No dates found in the compared attendance records.');
        return;
    }

    // 1. Detect Month
    const firstDateObj = new Date(sortedDates[0]);
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[firstDateObj.getMonth()];

    // 2. Identify Mismatches
    const mismatchDates = new Set();
    const mismatchDetails = [];

    sortedDates.forEach(date => {
        const leyecoRec = leyecoMap[date];
        const qrphoRec = qrphoMap[date];

        const hasLeyecoLogs = leyecoRec && leyecoRec.logs && leyecoRec.logs.length > 0;
        const hasQrphoLogs = qrphoRec && qrphoRec.logs && qrphoRec.logs.length > 0;

        if (!hasLeyecoLogs && !hasQrphoLogs) return;

        let isMismatch = false;
        let dateMismatchesList = [];

        // Check slots
        const slots = ['AM In', 'AM Out', 'PM In', 'PM Out'];
        slots.forEach(slotName => {
            const lLogs = leyecoRec && leyecoRec.logs ? leyecoRec.logs.filter(l => l.slot === slotName) : [];
            const qLogs = qrphoRec && qrphoRec.logs ? qrphoRec.logs.filter(l => l.slot === slotName) : [];

            const matchedQIndices = new Set();

            lLogs.forEach(lLog => {
                let bestQLog = null;
                let bestQIndex = -1;
                let minDiff = Infinity;

                qLogs.forEach((qLog, idx) => {
                    if (matchedQIndices.has(idx)) return;
                    const diff = getTimeDifferenceSeconds(lLog.time, qLog.time);
                    if (diff !== null && diff < minDiff) {
                        minDiff = diff;
                        bestQLog = qLog;
                        bestQIndex = idx;
                    }
                });

                if (bestQLog) {
                    matchedQIndices.add(bestQIndex);
                    if (minDiff > 120) {
                        isMismatch = true;
                        dateMismatchesList.push(`${slotName} Time Drift`);
                    }
                } else {
                    isMismatch = true;
                    dateMismatchesList.push(`Missing QRpho ${slotName}`);
                }
            });

            qLogs.forEach((qLog, idx) => {
                if (!matchedQIndices.has(idx)) {
                    isMismatch = true;
                    dateMismatchesList.push(`Missing Leyeco ${slotName}`);
                }
            });
        });

        // Check payroll hours mismatch
        const PAYROLL_LABELS = [
            { key: 'totalWorkHours',    label: 'Total Work Hrs' },
            { key: 'officeHours',       label: 'Office Hrs' },
            { key: 'overtimeHours',     label: 'Overtime' },
            { key: 'holidayCredit',     label: 'Holiday Credit' },
            { key: 'leaveCredit',       label: 'Leave Credit' },
            { key: 'totalPayrollHours', label: 'Total Payroll Hrs' },
            { key: 'undertime',         label: 'Undertime' },
        ];

        const lPay = (leyecoRec && leyecoRec.payroll) ? leyecoRec.payroll : {};
        const qPay = (qrphoRec  && qrphoRec.payroll)  ? qrphoRec.payroll  : {};
        const isEmpty = v => !v || v === '00:00:00' || v === '0';

        const payrollMismatches = PAYROLL_LABELS.filter(field => {
            const lVal = (lPay[field.key] || '').replace(/\s+/g, ' ').trim();
            const qVal = (qPay[field.key] || '').replace(/\s+/g, ' ').trim();
            const lEmpty = isEmpty(lVal);
            const qEmpty = isEmpty(qVal);
            if (lEmpty && qEmpty) return false;
            return lVal !== qVal;
        });

        if (payrollMismatches.length > 0) {
            isMismatch = true;
            payrollMismatches.forEach(m => {
                dateMismatchesList.push(m.label);
            });
        }

        if (isMismatch) {
            mismatchDates.add(date);
            const formattedDateStr = formatDateHuman(date); // e.g. "Jan 23, 2026"
            const uniqueMismatches = Array.from(new Set(dateMismatchesList));
            mismatchDetails.push(`${formattedDateStr} - ${uniqueMismatches.join(' & ')}`);
        }
    });

    // Determine payload values
    let attendanceVal = "";
    let remarksVal = "";

    if (mismatchDates.size === 0) {
        attendanceVal = ""; // Keep attendance blank if perfect match
        remarksVal = "Data Matched! No Signs Of Errors Found";
    } else {
        // Build the mismatches string (e.g. "Jan 23, 2026 - Total Payroll Hrs")
        attendanceVal = mismatchDetails.join('\n');
        remarksVal = `Data mismatch ${mismatchDetails.map(d => d.split(' - ')[1]).join(' & ')}`;
        // Truncate/limit remarks to prevent overflow in cell and keep it similar to screenshot
        if (remarksVal.length > 60) {
            remarksVal = remarksVal.substring(0, 57) + '...';
        }
    }

    // Show visual status on the sync button
    const originalBtnHTML = syncSheetBtn.innerHTML;
    syncSheetBtn.disabled = true;
    syncSheetBtn.innerHTML = `Syncing... <span class="btn-spinner" style="display:inline-block; animation: spin-pulse 1s infinite linear;">🔄</span>`;

    const payload = {
        sheetName: settings.tabName,
        employeeName: employeeName,
        month: month,
        attendance: attendanceVal,
        remarks: remarksVal
    };

    fetch(settings.url, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'text/plain', // Avoid CORS preflight OPTIONS request
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(res => {
        syncSheetBtn.disabled = false;
        syncSheetBtn.innerHTML = originalBtnHTML;

        if (res.status === 'success') {
            showToast(`Synced successfully! Google Sheet updated.`);
        } else {
            alert(`Sync Failed: ${res.message}`);
        }
    })
    .catch(err => {
        syncSheetBtn.disabled = false;
        syncSheetBtn.innerHTML = originalBtnHTML;
        console.error('Google Sheet Sync Error:', err);
        alert(`Google Sheet Sync Error: ${err.message || err}. Ensure you deployed the Google Web App script correctly as 'Anyone' and set execution as 'Me'.`);
    });
}

syncSheetBtn.addEventListener('click', triggerSheetsSync);
