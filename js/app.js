/* ============================================================
   DataDash - Core JS Logic
   ============================================================ */

const tTgl = document.getElementById('themeToggle');
const tIcon = tTgl.querySelector('i');
tTgl.addEventListener('click', () => {
    const n = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', n);
    tIcon.className = n === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    localStorage.setItem('theme', n);
    if(mChart) { mChart.options.plugins.legend.labels.color = n==='dark'?'#F8FAFC':'#0F172A'; mChart.update(); }
});

const dict = {
    ar: {
        pnlSettings:"إعدادات الاشتراك", lblProvider:"مزود الخدمة", optCustom:"تخصيص يدوي",
        lblTotal:"إجمالي السعة", lblRem:"السعة المتبقية الفعّالة", lblPrice:"التكلفة",
        lblStart:"الاشتراك", lblExp:"الانتهاء", btnShare:"مشاركة الرابط",
        tabDash:"المؤشرات الأساسية", tabTools:"المحاكاة والتوقع", stInit:"قيد التجهيز",
        stInitDesc:"يرجى إدراج المعطيات لتشغيل التحليل.", mSafe:"الاستهلاك الآمن/يوم",
        mAvg:"المتوسط الفعلي", mCost:"معيار التكلفة (GB)", mForecast:"الموعد الدقيق للنفاد",
        lblUsed:"الاستهلاك:", lblDays:"انقضى:", lblLeft:"متبقي:", 
        stGreen:"استهلاك آمن", stGDesc:"معدلك الفعلي يسمح باستمرار الباقة.",
        stWarn:"تحذير بالاستهلاك", stWDesc:"أنت تتجاوز الحد المسموح. قلل استخدامك.",
        stCrit:"استنفاد حتمي", stCDesc:"بموجب مسارك الحالي ستتوقف الباقة قبل الموعد.",
        stExp:"الباقة منتهية", stEDesc:"عذرا، لقد استنفدت السعة أو الأيام.",
        simTitle:"محاكي الاستهلاك اليومي", simDesc:"تلاعب بالمعدل اليومي لاختبار طول عمر باقتك الافتراضي.", lblDay:"يوم",
        tlDown:"حاسبة التنزيلات", tlSpeed:"زمن التنزيل المقدر"
    },
    en: {
        pnlSettings:"Subscription Config", lblProvider:"ISP Preset", optCustom:"Manual Entry",
        lblTotal:"Total Quota", lblRem:"Remaining Data", lblPrice:"Total Price",
        lblStart:"Start Date", lblExp:"Expiry Date", btnShare:"Share State",
        tabDash:"Analytics Core", tabTools:"Forecasting Tools", stInit:"Standby Mode",
        stInitDesc:"Awaiting structural parameters for evaluation.", mSafe:"Safe Quota/Day",
        mAvg:"Actual Mean Rate", mCost:"Unit Cost (GB)", mForecast:"Est. Zero Date",
        lblUsed:"Consumed:", lblDays:"Elapsed:", lblLeft:"Remaining:", 
        stGreen:"Optimal Consumption", stGDesc:"Current vector preserves lifecycle.",
        stWarn:"Elevated Consumption", stWDesc:"Velocity marginally exceeds capacity limits.",
        stCrit:"Imminent Depletion", stCDesc:"Current rate forces premature failure.",
        stExp:"Cycle Terminated", stEDesc:"Data allocation or validity exhausted.",
        simTitle:"Consumption Simulator", simDesc:"Adjust sliding metric to forecast longevity variance.", lblDay:"Day",
        tlDown:"Volumetric Calculator", tlSpeed:"Throughput Analyzer"
    }
};

let l = localStorage.getItem('dd_lang') || 'ar';
document.getElementById('langToggle').addEventListener('click', () => {
    l = l === 'ar' ? 'en' : 'ar';
    localStorage.setItem('dd_lang', l); applyL();
});

function applyL() {
    document.documentElement.lang = l; document.documentElement.dir = l==='ar'?'rtl':'ltr';
    document.getElementById('langToggle').innerText = l==='ar'?'EN':'AR';
    document.querySelectorAll('[data-i18n]').forEach(el => { el.innerText = dict[l][el.getAttribute('data-i18n')]; });
    runDash();
}

// Ensure purely english numerals natively outputted by logic
function fn(v, d=2) { return new Intl.NumberFormat('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}).format(v); }
function tMB(v, u) { return u==='TB'? v*1048576 : u==='GB'? v*1024 : v; }
function tAuto(mb) {
    if(mb >= 1048576) return { v: fn(mb/1048576), u: "TB" };
    if(mb >= 1024) return { v: fn(mb/1024), u: "GB" };
    return { v: fn(mb,0), u: "MB" };
}

const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(b => b.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
    b.classList.add('active'); document.getElementById(b.getAttribute('data-tab')).classList.add('active');
}));

const els = ['inpProvider','inpTotal','inpUnit','inpRem','inpStart','inpExp','inpPrice'];
els.forEach(id => document.getElementById(id).addEventListener('input', runDash));

let mChart = null;

function runDash() {
    saveU();
    const vTot = parseFloat(document.getElementById('inpTotal').value);
    const vRem = parseFloat(document.getElementById('inpRem').value);
    const unt = document.getElementById('inpUnit').value;
    const pri = parseFloat(document.getElementById('inpPrice').value)||0;
    
    const dS = new Date(document.getElementById('inpStart').value); dS.setHours(0,0,0,0);
    const dE = new Date(document.getElementById('inpExp').value); dE.setHours(0,0,0,0);
    
    // Perfect Date Math (Ignore timezone offsets)
    const dT = new Date(); 
    dT.setMinutes(dT.getMinutes() - dT.getTimezoneOffset());
    const realToday = new Date(dT.toISOString().split('T')[0]);

    if(isNaN(vTot)||isNaN(vRem)||isNaN(dS)||isNaN(dE)) return;

    const tMB_val = tMB(vTot, unt);
    const rMB_val = Math.min(tMB(vRem, unt), tMB_val);
    const uMB_val = tMB_val - rMB_val;

    const ttlD = Math.floor((dE - dS)/86400000) + 1;
    let pasD = Math.floor((realToday - dS)/86400000);
    let lefD = Math.floor((dE - realToday)/86400000) + 1;

    if(realToday < dS){ pasD=0; lefD=ttlD; }
    if(realToday > dE){ pasD=ttlD; lefD=0; }

    const sMB = lefD>0 ? rMB_val/lefD : 0;
    const aMB = pasD>0 ? uMB_val/pasD : 0;

    let fDat = "--";
    if(rMB_val<=0 || lefD<=0) fDat = dict[l].stExp;
    else if(aMB<=0) fDat = "∞";
    else {
        const exhaust = new Date(realToday);
        exhaust.setDate(exhaust.getDate() + (rMB_val/aMB) - 1);
        fDat = exhaust.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
    }

    const cGB = pri>0 ? (pri/(tMB_val/1024)) : 0;

    // UI Bindings
    const oSafe = tAuto(sMB); document.getElementById('valSafe').innerText=oSafe.v; document.getElementById('unitSafe').innerText=`${oSafe.u} / D`;
    const oAvg = tAuto(aMB); document.getElementById('valAvg').innerText=oAvg.v; document.getElementById('unitAvg').innerText=`${oAvg.u} / D`;
    document.getElementById('valCost').innerText = fn(cGB);
    document.getElementById('valForecast').innerText = fDat;

    const oUsd = tAuto(uMB_val); document.getElementById('outUsed').innerText = `${oUsd.v} ${oUsd.u}`;
    document.getElementById('outDaysP').innerText = `${pasD}`;
    document.getElementById('outDaysL').innerText = `${lefD}`;

    const bx = document.getElementById('statusBox'); const ic = document.getElementById('stIcon');
    const bT = document.getElementById('stTitle'); const bD = document.getElementById('stDesc');

    if(rMB_val<=0 || lefD<=0) setSt(bx,ic,bT,bD, 'var(--bg-red)', 'var(--c-red)', 'fa-times', 'stExp', 'stEDesc');
    else if(aMB<=sMB) setSt(bx,ic,bT,bD, 'var(--bg-green)', 'var(--c-green)', 'fa-check', 'stGreen', 'stGDesc');
    else if(aMB<=sMB*1.15) setSt(bx,ic,bT,bD, 'var(--bg-warn)', 'var(--c-warn)', 'fa-exclamation-triangle', 'stWarn', 'stWDesc');
    else setSt(bx,ic,bT,bD, 'var(--bg-red)', 'var(--c-red)', 'fa-radiation', 'stCrit', 'stCDesc');

    draw(uMB_val, rMB_val);
    runSimTools(rMB_val);
}

function setSt(bx, ic, t, d, bg, c, i, tk, dk) {
    bx.style.backgroundColor = bg; bx.style.borderColor = c; bx.style.color = c;
    ic.className=`fas ${i}`; t.innerText=dict[l][tk]; d.innerText=dict[l][dk];
}

function draw(u, r) {
    if(u===0 && r===0) r=1;
    if(mChart) mChart.destroy();
    const isD = document.documentElement.getAttribute('data-theme')==='dark';
    mChart = new Chart(document.getElementById('dashChart').getContext('2d'), {
        type: 'doughnut', data: { datasets: [{ data: [u,r], backgroundColor:['#EF4444','#3B82F6'], borderWidth:0 }] },
        options: { cutout: '75%', responsive:true, maintainAspectRatio:false }
    });
}

// Shareable Base64 String URL Logic
function saveU() {
    const s = els.map(id=>document.getElementById(id).value);
    const enc = btoa(encodeURIComponent(JSON.stringify(s)));
    try{ window.history.replaceState({},'', `?d=${enc}`); } catch(e){}
    localStorage.setItem('dd_cache', enc);
}

function loadU() {
    const p = new URLSearchParams(window.location.search).get('d') || localStorage.getItem('dd_cache');
    if(p) {
        try {
            const arr = JSON.parse(decodeURIComponent(atob(p)));
            els.forEach((id,i) => document.getElementById(id).value = arr[i]);
        } catch(e){}
    }
    applyL();
}

document.getElementById('btnReset').addEventListener('click', ()=>{
    els.forEach(id=>document.getElementById(id).value=''); 
    localStorage.removeItem('dd_cache'); window.history.replaceState({},'', '?'); location.reload();
});

document.getElementById('btnShare').addEventListener('click', function(){
    navigator.clipboard.writeText(window.location.href);
    this.innerHTML=`<i class="fas fa-check"></i>`; setTimeout(()=>this.innerHTML=`<i class="fas fa-link"></i> <span data-i18n="btnShare">${dict[l].btnShare}</span>`, 1500);
});

// Providers preset logic
document.getElementById('inpProvider').addEventListener('change', e=>{
    const v = e.target.value;
    if(v==='libyana') { document.getElementById('inpTotal').value=40; document.getElementById('inpPrice').value=40; document.getElementById('inpUnit').value='GB'; }
    if(v==='almadar') { document.getElementById('inpTotal').value=30; document.getElementById('inpPrice').value=30; document.getElementById('inpUnit').value='GB'; }
    if(v==='ltt') { document.getElementById('inpTotal').value=100; document.getElementById('inpPrice').value=65; document.getElementById('inpUnit').value='GB'; }
    runDash();
});

// --- Smart Tools Simulation Logic ---
const slSim = document.getElementById('simSlider');
const slTxt = document.getElementById('simVal');
const outSim = document.getElementById('simResult');
const inpDn = document.getElementById('inpDown');
const oDn = document.getElementById('resDown');
const mS = document.getElementById('inpSpeedMbps');
const gS = document.getElementById('inpSpeedSize');
const oS = document.getElementById('resSpeed');

[slSim, inpDn, mS, gS].forEach(el => el.addEventListener('input', () => runSimTools()));

function runSimTools(remMB_cache = 0) {
    if(remMB_cache===0) {
        const vRem = parseFloat(document.getElementById('inpRem').value);
        if(!isNaN(vRem)) remMB_cache = Math.min(tMB(vRem, document.getElementById('inpUnit').value), tMB(parseFloat(document.getElementById('inpTotal').value), document.getElementById('inpUnit').value));
    }
    if(!remMB_cache || isNaN(remMB_cache)) return;

    // Simulation Slider
    const simGB = parseFloat(slSim.value);
    slTxt.innerText = fn(simGB, 1);
    const surv = (remMB_cache/1024) / simGB;
    outSim.innerText = `${fn(surv, 0)} ${dict[l].txtDays}`;
    
    // Download Calc
    const tg = parseFloat(inpDn.value)*1024;
    if(!isNaN(tg) && tg > 0) {
        oDn.innerText = tg <= remMB_cache ? `Safe: Remains ${tAuto(remMB_cache-tg).v} ${tAuto(remMB_cache-tg).u}` : `Deficit: Need ${tAuto(tg-remMB_cache).v} ${tAuto(tg-remMB_cache).u}`;
        oDn.style.color = tg<=remMB_cache ? 'var(--c-green)' : 'var(--c-red)';
    }

    // Speed Calc
    const ms = parseFloat(mS.value), gs = parseFloat(gS.value);
    if(!isNaN(ms) && !isNaN(gs) && ms>0) {
        const secs = (gs * 1024 * 8) / ms;
        const h = Math.floor(secs / 3600); const m = Math.floor((secs % 3600) / 60);
        oS.innerText = `${h}H ${m}M`; oS.style.color="var(--primary)";
    }
}

loadU();
