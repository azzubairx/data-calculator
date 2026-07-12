/* ============================================================
   المنطق البرمجي (DataDash Core Logic)
   ============================================================ */

// 1. Theme Configuration
const toggle = document.getElementById('themeToggle');
const icon = toggle.querySelector('i');
if (document.documentElement.getAttribute('data-theme') === 'light') icon.className = 'fas fa-sun';
toggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', newTheme);
    if(mainChart) {
        mainChart.options.plugins.legend.labels.color = newTheme==='dark' ? '#F8FAFC' : '#0F172A';
        mainChart.update();
    }
});

// 2. Language Initialization
let currentLang = localStorage.getItem('calc_lang') || 'ar';
const langBtn = document.getElementById('langToggle');

function applyLanguage() {
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    langBtn.innerText = currentLang === 'ar' ? 'EN' : 'AR';
    
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if(dict[currentLang][key]) el.innerText = dict[currentLang][key];
    });
    
    document.getElementById('lblForecastSub').innerText = currentLang === 'ar' ? "حسب المعدل الحالي" : "Based on velocity";
    compileDashboard();
}
langBtn.addEventListener('click', () => {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('calc_lang', currentLang);
    applyLanguage();
});

// 3. Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
    });
});

// 4. Utility Functions
// FORCES numeric values to be displayed as 0-9 universally. Never Eastern Arabic (١٢٣)
function fNum(val, decimals = 2) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
}
function getLocalToday() {
    const d = new Date();
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}
function toMB(val, unit) {
    if(unit === 'TB') return val * 1048576;
    if(unit === 'GB') return val * 1024;
    return val;
}
function formatAutoUnit(mbVal) {
    if(mbVal >= 1048576) return { v: fNum(mbVal / 1048576), u: "TB" };
    if(mbVal >= 1024) return { v: fNum(mbVal / 1024), u: "GB" };
    return { v: fNum(mbVal, 0), u: "MB" };
}

// 5. Providers Templates
const providers = {
    libyana: { total: 40, unit: 'GB', price: 40 },
    almadar: { total: 30, unit: 'GB', price: 30 },
    ltt: { total: 100, unit: 'GB', price: 65 }
};
document.getElementById('inpProvider').addEventListener('change', function(e) {
    const p = providers[e.target.value];
    if(p) {
        document.getElementById('inpTotal').value = p.total;
        document.getElementById('inpUnit').value = p.unit;
        document.getElementById('inpPrice').value = p.price;
        compileDashboard();
    }
});

// 6. Chart Initialization
let mainChart = null;
function updateChart(used, rem) {
    const ctx = document.getElementById('mainChart').getContext('2d');
    const tCol = document.documentElement.getAttribute('data-theme') === 'dark' ? '#F8FAFC' : '#0F172A';
    if(mainChart) mainChart.destroy();
    
    // Hide chart visually if data is zero to prevent broken UI
    if (used === 0 && rem === 0) rem = 1; 

    mainChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [dict[currentLang].txtUsedData, dict[currentLang].lblRem],
            datasets: [{
                data: [used, rem],
                backgroundColor: ['#EF4444', '#3B82F6'],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: tCol, font: {family: 'inherit'} } } }
        }
    });
}

// 7. Core Compilation Logic
const inps = ['inpTotal','inpUnit','inpRem','inpPrice','inpStart','inpExp'];
inps.forEach(id => document.getElementById(id).addEventListener('input', () => {
    document.getElementById('inpProvider').value = 'custom';
    compileDashboard();
}));

function compileDashboard() {
    const vTotal = parseFloat(document.getElementById('inpTotal').value);
    const vRem = parseFloat(document.getElementById('inpRem').value);
    const vUnit = document.getElementById('inpUnit').value;
    const vPrice = parseFloat(document.getElementById('inpPrice').value) || 0;
    
    const dStart = new Date(document.getElementById('inpStart').value);
    const dExp = new Date(document.getElementById('inpExp').value);
    const dToday = new Date(getLocalToday());

    // Basic Validation
    if(isNaN(vTotal) || isNaN(vRem) || isNaN(dStart) || isNaN(dExp)) return;

    dStart.setHours(0,0,0,0); dExp.setHours(0,0,0,0); dToday.setHours(0,0,0,0);

    const totalMB = toMB(vTotal, vUnit);
    const remMB = Math.min(toMB(vRem, vUnit), totalMB); // logical ceiling
    const usedMB = totalMB - remMB;

    const totalDays = Math.ceil((dExp - dStart) / 86400000) + 1;
    let daysPassed = Math.ceil((dToday - dStart) / 86400000);
    let daysLeft = Math.ceil((dExp - dToday) / 86400000) + 1;

    // Temporal boundaries
    if(dToday < dStart) { daysPassed = 0; daysLeft = totalDays; }
    if(dToday > dExp) { daysPassed = totalDays; daysLeft = 0; }

    const safeMB = daysLeft > 0 ? (remMB / daysLeft) : 0;
    const avgMB = daysPassed > 0 ? (usedMB / daysPassed) : 0;

    // Forecasting
    let fcText = "--";
    if(remMB <= 0 || daysLeft <= 0) {
        fcText = dict[currentLang].stExp;
    } else if (avgMB <= 0) {
        fcText = dict[currentLang].txtNever;
    } else {
        const daysToDeath = remMB / avgMB;
        const exhaust = new Date(dToday);
        exhaust.setDate(dToday.getDate() + daysToDeath);
        // Force en-US numbers even in Arabic locales
        fcText = exhaust.toLocaleDateString(currentLang === 'ar' ? 'ar-LY' : 'en-GB', { day: 'numeric', month: 'short' });
        // Clean Arabic string if local browser pushes hindi nums
        fcText = fcText.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    }

    // Cost logic
    const costPerGB = vPrice > 0 ? (vPrice / (totalMB / 1024)) : 0;
    
    // UI Update - Formatting explicitly with fNum() to block Eastern numerals
    const fmtSafe = formatAutoUnit(safeMB);
    document.getElementById('valSafe').innerText = fmtSafe.v;
    document.getElementById('unitSafe').innerText = fmtSafe.u;

    const fmtAvg = formatAutoUnit(avgMB);
    document.getElementById('valAvg').innerText = fmtAvg.v;
    document.getElementById('unitAvg').innerText = fmtAvg.u;

    document.getElementById('valForecast').innerText = fcText;
    document.getElementById('valCost').innerText = fNum(costPerGB, 2);

    const fmtUsed = formatAutoUnit(usedMB);
    document.getElementById('stUsed').innerText = `${fmtUsed.v} ${fmtUsed.u}`;
    document.getElementById('stDaysLeft').innerText = `${fNum(daysLeft,0)} ${dict[currentLang].txtDays}`;
    document.getElementById('stProg').innerText = `${fNum((usedMB/totalMB)*100, 1)}%`;

    // Visual Status Evaluation
    const banner = document.getElementById('statusBanner');
    const bIcon = document.getElementById('statusIcon');
    const bTitle = document.getElementById('statusTitle');
    const bDesc = document.getElementById('statusDesc');

    banner.className = 'status-banner'; // reset
    if (remMB <= 0 || daysLeft <= 0) {
        setSt(banner, bIcon, bTitle, bDesc, 'var(--status-crit-bg)', 'var(--status-crit)', 'fa-times-circle', dict[currentLang].stExp, dict[currentLang].stExpDesc);
    } else if (avgMB <= safeMB) {
        setSt(banner, bIcon, bTitle, bDesc, 'var(--status-safe-bg)', 'var(--status-safe)', 'fa-check-circle', dict[currentLang].stSafe, dict[currentLang].stSafeDesc);
    } else if (avgMB <= safeMB * 1.2) {
        setSt(banner, bIcon, bTitle, bDesc, 'var(--status-warn-bg)', 'var(--status-warn)', 'fa-exclamation-triangle', dict[currentLang].stWarn, dict[currentLang].stWarnDesc);
    } else {
        setSt(banner, bIcon, bTitle, bDesc, 'var(--status-crit-bg)', 'var(--status-crit)', 'fa-radiation', dict[currentLang].stCrit, dict[currentLang].stCritDesc);
    }

    updateChart(usedMB, remMB);
    saveState();
    evalTools(); // Sync mini tools
}

function setSt(el, iEl, tEl, dEl, bg, col, ic, tT, dT) {
    el.style.backgroundColor = bg; el.style.color = col; el.style.borderColor = col;
    iEl.className = `fas ${ic} status-icon`; tEl.innerText = tT; dEl.innerText = dT;
}

// 8. State Mgmt (URL & Storage)
function saveState() {
    const s = {};
    inps.forEach(id => s[id] = document.getElementById(id).value);
    localStorage.setItem('dd_state', JSON.stringify(s));
    try { window.history.replaceState({}, '', `?${new URLSearchParams(s)}`); } catch(e){}
}
function loadState() {
    const p = new URLSearchParams(window.location.search);
    let loaded = false;
    inps.forEach(id => {
        if(p.has(id)) { document.getElementById(id).value = p.get(id); loaded = true; }
    });
    if(!loaded) {
        const s = JSON.parse(localStorage.getItem('dd_state'));
        if(s) inps.forEach(id => { if(s[id]) document.getElementById(id).value = s[id]; });
    }
    applyLanguage();
}

document.getElementById('btnReset').addEventListener('click', () => {
    inps.forEach(id => document.getElementById(id).value = '');
    document.getElementById('inpProvider').value = 'custom';
    localStorage.removeItem('dd_state');
    window.history.replaceState({}, '', window.location.pathname);
    location.reload();
});

document.getElementById('btnShare').addEventListener('click', function() {
    navigator.clipboard.writeText(window.location.href);
    const t = this.innerHTML;
    this.innerHTML = `<i class="fas fa-check"></i>`;
    setTimeout(() => this.innerHTML = t, 1500);
});

// 9. Tools Calculators Logic
document.getElementById('inpTlSize').addEventListener('input', evalTools);
document.getElementById('inpTlQual').addEventListener('change', evalTools);

function evalTools() {
    const remMB = toMB(parseFloat(document.getElementById('inpRem').value), document.getElementById('inpUnit').value);
    const eDown = document.getElementById('resTlDown');
    const eVid = document.getElementById('resTlVid');

    if(isNaN(remMB) || remMB <= 0) {
        eDown.innerText = "--"; eVid.innerText = "--"; return;
    }

    // Down Tool
    const reqGB = parseFloat(document.getElementById('inpTlSize').value) || 0;
    const reqMB = reqGB * 1024;
    
    if(reqMB === 0) eDown.innerText = "--";
    else if(reqMB < remMB) {
        const leftover = formatAutoUnit(remMB - reqMB);
        eDown.style.color = "var(--status-safe)";
        eDown.innerText = `${dict[currentLang].msgEnough} ${leftover.v} ${leftover.u}`;
    } else {
        const deficit = formatAutoUnit(reqMB - remMB);
        eDown.style.color = "var(--status-crit)";
        eDown.innerText = `${dict[currentLang].msgNotEnough} ${deficit.v} ${deficit.u}`;
    }

    // Video Tool
    const rateGBperHr = parseFloat(document.getElementById('inpTlQual').value);
    const hrs = (remMB / 1024) / rateGBperHr;
    eVid.style.color = "var(--primary)";
    eVid.innerText = `≈ ${fNum(hrs, 1)} ${dict[currentLang].msgHours}`;
}

// Bootstrap
loadState();
