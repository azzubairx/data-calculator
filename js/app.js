const tBtn = document.getElementById('themeToggle');
const tIco = tBtn.querySelector('i');
tBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const nTh = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nTh);
    tIco.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('theme', nTh);
    if(mChart) { mChart.options.plugins.legend.labels.color = nTh==='dark'?'#F8FAFC':'#0F172A'; mChart.update(); }
});

const dict = {
    ar: {
        pnlSettings:"إعدادات الاشتراك", lblProvider:"مزود الخدمة", optCustom:"تخصيص يدوي",
        lblTotal:"السعة الكلية", lblRem:"المتبقي الآن", lblPrice:"السعر",
        lblStart:"الاشتراك", lblExp:"الانتهاء", btnShare:"نسخ الرابط",
        tabDash:"المؤشرات", tabTools:"الأدوات",
        stInit:"جاهز للحساب", stInitDesc:"أدخل الرصيد المتبقي وتاريخ الانتهاء للبدء.",
        mSafe:"الحد الآمن / يوم", mAvg:"متوسط الاستهلاك", mCost:"تكلفة الـ GB", mForecast:"توقع النفاد",
        lblUsed:"الاستهلاك الكلي", lblDays:"الأيام المنقضية", lblLeft:"الأيام المتبقية", dPr:"نسبة الاستهلاك",
        stG:"استهلاك آمن", sdG:"معدلك الفعلي يسمح باستمرار الباقة.",
        stW:"تحذير بالاستهلاك", sdW:"أنت تتجاوز الحد المسموح. قلل استخدامك.",
        stC:"خطر النفاد", sdC:"بموجب مسارك الحالي ستتوقف الباقة قبل الموعد.",
        stE:"الباقة منتهية", sdE:"عذراً، لقد استنفدت السعة أو الأيام.",
        tlDown:"حاسبة التنزيل", tlSpeed:"وقت التحميل المقدر", txtDays:"أيام", msgOk:"يتبقى: ", msgNo:"ينقص: "
    },
    en: {
        pnlSettings:"Configuration", lblProvider:"ISP Preset", optCustom:"Custom Input",
        lblTotal:"Total Quota", lblRem:"Remaining Now", lblPrice:"Price",
        lblStart:"Start Date", lblExp:"Expiry Date", btnShare:"Copy Link",
        tabDash:"Dashboard", tabTools:"Calculators",
        stInit:"Ready to Calc", stInitDesc:"Enter remaining data & expiry date to begin.",
        mSafe:"Safe Limit / Day", mAvg:"Avg Usage", mCost:"Cost / GB", mForecast:"Est. Zero Date",
        lblUsed:"Total Used", lblDays:"Elapsed Days", lblLeft:"Days Left", dPr:"Usage %",
        stG:"Safe Usage", sdG:"Current trajectory preserves your lifecycle.",
        stW:"Elevated Usage", sdW:"Velocity exceeds capacity. Monitoring advised.",
        stC:"Imminent Depletion", sdC:"Current rate forces premature package failure.",
        stE:"Terminated", sdE:"Data allocation or validity exhausted.",
        tlDown:"Download Checker", tlSpeed:"Est. DL Time", txtDays:"Days", msgOk:"Remains: ", msgNo:"Deficit: "
    }
};

let l = localStorage.getItem('dd_l') || 'ar';
document.getElementById('langToggle').addEventListener('click', function() {
    l = l==='ar'?'en':'ar'; localStorage.setItem('dd_l', l); appLang();
});

function appLang() {
    document.documentElement.lang=l; document.documentElement.dir=l==='ar'?'rtl':'ltr';
    document.getElementById('langToggle').innerText=l==='ar'?'EN':'AR';
    
    // Hardcoded elements translations to avoid huge data attributes
    ['pnlSettings','lblProvider','optCustom','lblTotal','lblRem','lblPrice','lblStart','lblExp',
     'btnShare','tabDash','tabTools','mSafe','mAvg','mCost','mForecast','lblUsed','lblDays','lblLeft', 'dPr', 'tlDown', 'tlSpeed'
    ].forEach(k => { const el=document.getElementById(k); if(el) el.innerText=dict[l][k]; });
    runLogic();
}

document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
    b.classList.add('active'); document.getElementById(b.getAttribute('data-tab')).classList.add('active');
}));

function fN(num, d=2) { return new Intl.NumberFormat('en-US', {minimumFractionDigits:d, maximumFractionDigits:d}).format(num); }
function tMB(v, u) { return u==='TB'? v*1048576 : u==='GB'? v*1024 : v; }
function auto(mb) {
    if(mb >= 1048576) return {v: fN(mb/1048576), u: "TB"};
    if(mb >= 1024) return {v: fN(mb/1024), u: "GB"};
    return {v: fN(mb,0), u: "MB"};
}

const inp = ['inpTotal','inpRem','inpStart','inpExp','inpPrice'];
inp.forEach(i => document.getElementById(i).addEventListener('input', runLogic));
document.getElementById('inpUnit').addEventListener('change', runLogic);

let mChart = null;

function runLogic() {
    const unit = document.getElementById('inpUnit').value;
    const vTot = parseFloat(document.getElementById('inpTotal').value) || 0;
    const vRem = parseFloat(document.getElementById('inpRem').value);
    const pri = parseFloat(document.getElementById('inpPrice').value) || 0;
    const expStr = document.getElementById('inpExp').value;
    const strStr = document.getElementById('inpStart').value;

    const bx = document.getElementById('statusBox'), ic = document.getElementById('stIcon'), tT = document.getElementById('stTitle'), tD = document.getElementById('stDesc');

    // 1. Minimum Viable Logic (Rem + Exp Only)
    if(isNaN(vRem) || !expStr) {
        setBx(bx,ic,tT,tD, 'var(--input-bg)', 'var(--text-muted)', 'fa-info-circle', 'stInit', 'stInitDesc');
        return;
    }

    const dE = new Date(expStr); dE.setHours(0,0,0,0);
    const dT = new Date(); dT.setMinutes(dT.getMinutes() - dT.getTimezoneOffset());
    const dt = new Date(dT.toISOString().split('T')[0]); dt.setHours(0,0,0,0);

    const rMB = tMB(vRem, unit);
    let dL = Math.floor((dE - dt)/86400000) + 1;
    if(dL < 0) dL = 0;

    const sfMB = dL>0 ? (rMB/dL) : 0;
    
    // 2. Full Logic (if Total & Start are present)
    let avgMB = 0, uMB = 0, prog = 0, dP = 0, fDate = "--", tMB_v = rMB;

    if(vTot > 0 && strStr) {
        const dS = new Date(strStr); dS.setHours(0,0,0,0);
        tMB_v = tMB(vTot, unit);
        uMB = Math.max(0, tMB_v - rMB);
        dP = Math.floor((dt - dS)/86400000);
        if(dP < 1) dP = 1; // Prevent div 0
        avgMB = uMB / dP;
        prog = (uMB/tMB_v)*100;
        
        if(avgMB > 0 && dL > 0) {
            const exD = new Date(dt);
            exD.setDate(exD.getDate() + (rMB/avgMB));
            fDate = exD.toLocaleDateString('en-GB', {day:'numeric', month:'short'});
        } else if(avgMB === 0) fDate = "∞";
    }

    // UI Updates
    document.getElementById('valSafe').innerText = auto(sfMB).v;
    document.getElementById('valAvg').innerText = auto(avgMB).v;
    document.getElementById('valCost').innerText = vTot>0 ? fN(pri/(tMB_v/1024)) : "0.00";
    document.getElementById('valDate').innerText = fDate;

    document.getElementById('outUsed').innerText = `${auto(uMB).v} ${auto(uMB).u}`;
    document.getElementById('outDaysP').innerText = dP;
    document.getElementById('outDaysL').innerText = dL;
    document.getElementById('outProg').innerText = `${fN(prog,1)}%`;

    // Status Engine
    if(rMB<=0 || dL<=0) setBx(bx,ic,tT,tD, 'var(--bg-red)', 'var(--c-red)', 'fa-times', 'stE', 'sdE');
    else if(avgMB === 0 || avgMB <= sfMB) setBx(bx,ic,tT,tD, 'var(--bg-grn)', 'var(--c-grn)', 'fa-check', 'stG', 'sdG');
    else if(avgMB <= sfMB * 1.15) setBx(bx,ic,tT,tD, 'var(--bg-wrn)', 'var(--c-warn)', 'fa-exclamation-triangle', 'stW', 'sdW');
    else setBx(bx,ic,tT,tD, 'var(--bg-red)', 'var(--c-red)', 'fa-radiation', 'stC', 'sdC');

    draw(uMB, rMB); saveU(); runTools(rMB);
}

function setBx(bx, ic, t, d, bg, c, i, tk, dk) {
    bx.style.backgroundColor = bg; bx.style.borderColor = c; bx.style.color = c;
    ic.className=`fas ${i}`; t.innerText=dict[l][tk]; d.innerText=dict[l][dk];
}

function draw(u, r) {
    if(u===0 && r===0) r=1;
    const isD = document.documentElement.getAttribute('data-theme')==='dark';
    if(mChart) mChart.destroy();
    mChart = new Chart(document.getElementById('dashChart').getContext('2d'), {
        type: 'doughnut', data: { datasets: [{ data: [u,r], backgroundColor:['#EF4444','#3B82F6'], borderWidth:0 }] },
        options: { cutout: '75%', responsive:true, maintainAspectRatio:false }
    });
}

function runTools(rMB) {
    const sZ = parseFloat(document.getElementById('inpDown').value);
    const ms = parseFloat(document.getElementById('inpSpeedMbps').value);
    const gs = parseFloat(document.getElementById('inpSpeedSize').value);
    
    // TL1
    if(sZ>0 && rMB) {
        const tgMB = sZ * 1024;
        const eD = document.getElementById('resDown');
        if(tgMB <= rMB) { eD.innerText=`${dict[l].msgOk} ${auto(rMB-tgMB).v} ${auto(rMB-tgMB).u}`; eD.style.color="var(--c-grn)";}
        else { eD.innerText=`${dict[l].msgNo} ${auto(tgMB-rMB).v} ${auto(tgMB-rMB).u}`; eD.style.color="var(--c-red)";}
    } else document.getElementById('resDown').innerText="--";

    // TL2
    if(ms>0 && gs>0) {
        const s = (gs*1024*8)/ms;
        document.getElementById('resSpeed').innerText = `${Math.floor(s/3600)}H ${Math.floor((s%3600)/60)}M`;
        document.getElementById('resSpeed').style.color = "var(--primary)";
    } else document.getElementById('resSpeed').innerText="--";
}

document.getElementById('inpDown').addEventListener('input', runLogic);
document.getElementById('inpSpeedMbps').addEventListener('input', runLogic);
document.getElementById('inpSpeedSize').addEventListener('input', runLogic);

// Presets
document.getElementById('inpProvider').addEventListener('change', e=>{
    const v = e.target.value;
    if(v==='libyana'){ document.getElementById('inpTotal').value=40; document.getElementById('inpPrice').value=40; }
    if(v==='almadar'){ document.getElementById('inpTotal').value=30; document.getElementById('inpPrice').value=30; }
    if(v==='ltt'){ document.getElementById('inpTotal').value=100; document.getElementById('inpPrice').value=65; }
    if(v!=='custom') document.getElementById('inpUnit').value='GB';
    runLogic();
});

// Short URL Share (Clean Query String like ?t=40&r=15&e=2024)
function saveU() {
    const p = new URLSearchParams();
    const map = {inpTotal:'t', inpUnit:'u', inpRem:'r', inpStart:'s', inpExp:'e', inpPrice:'p'};
    for(const [id, key] of Object.entries(map)){
        const v = document.getElementById(id).value;
        if(v && v!=='GB') p.set(key, v);
    }
    const q = p.toString();
    try { window.history.replaceState({}, '', q ? '?'+q : window.location.pathname); } catch(e){}
    localStorage.setItem('dd_s', JSON.stringify(Object.fromEntries(p)));
}

function loadU() {
    appLang();
    const map = {t:'inpTotal', u:'inpUnit', r:'inpRem', s:'inpStart', e:'inpExp', p:'inpPrice'};
    const params = new URLSearchParams(window.location.search);
    let loaded = false;
    params.forEach((val, key) => { if(map[key]) { document.getElementById(map[key]).value = val; loaded=true; } });
    
    if(!loaded) {
        try {
            const s = JSON.parse(localStorage.getItem('dd_s') || '{}');
            for(const [k, v] of Object.entries(s)) { if(map[k]) document.getElementById(map[k]).value = v; }
        } catch(e){}
    }
    runLogic();
}

document.getElementById('btnShare').addEventListener('click', function(){
    navigator.clipboard.writeText(window.location.href);
    const oi = this.innerHTML; this.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(()=> this.innerHTML=oi, 1500);
});

document.getElementById('btnReset').addEventListener('click', ()=>{
    inp.forEach(i=>document.getElementById(i).value='');
    document.getElementById('inpProvider').value='custom';
    localStorage.removeItem('dd_s');
    window.location.search='';
});

loadU();
