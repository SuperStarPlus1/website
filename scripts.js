const CLOUD = "dj56w7nb9";
const CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRQkkYTwMe4n3ViI8N474bKHGGNwqa0GTMwskoWEEOrWJeA-BUrCcK95FZHNqcNqxhlF2INxL9GO70z/pub?output=csv";

let allItems = [];
let curCat = "הכל";
let limit = 20;

// ניווט בין דפים
function nav(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    if(el) el.classList.add('active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// פונקציית זום
function zoom(url) {
    const lb = document.getElementById('lb-img');
    if(lb) {
        lb.src = url;
        document.getElementById('lightbox').style.display = 'flex';
    }
}

// בדיקת תוקף מבצע (DD-MM-YYYY בשם הקובץ)
function isFresh(pid) {
    const m = pid.match(/(\d{2})-(\d{2})-(\d{4})/);
    if(!m) return true;
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    const today = new Date(); 
    today.setHours(0,0,0,0);
    return d >= today;
}

// טעינה מ-Cloudinary
async function loadCloud(tag, divId, type='grid', filter=false) {
    try {
        const r = await fetch(`https://res.cloudinary.com/${CLOUD}/image/list/${tag}.json`);
        const d = await r.json();
        let files = d.resources;
        
        if(filter) files = files.filter(f => isFresh(f.public_id));
        
        const html = files.map(f => {
            const url = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${f.public_id}.${f.format}`;
            if(type === 'slider') {
                return `<img src="${url}" onclick="zoom('${url}')">`;
            }
            return `<div class="card" onclick="zoom('${url}')"><img src="${url}"></div>`;
        }).join('');
        
        const target = document.getElementById(divId);
        if(target) {
            target.innerHTML = type === 'slider' ? (html + html) : html;
        }
    } catch(e) { console.error("Error loading Cloudinary:", e); }
}

// רינדור קטלוג מוצרים
function render(data) {
    const container = document.getElementById('catalog-grid');
    if(!container) return;
    
    const slice = data.slice(0, limit);
    container.innerHTML = slice.map(i => `
        <div class="card">
            <img src="https://res.cloudinary.com/dj56w7nb9/image/upload/f_auto,q_auto/products/${i.Barcode}.jpg" 
                 onclick="zoom(this.src)" onerror="this.style.display='none'">
            <h3 style="font-size:0.9rem; margin:10px 0;">${i.Name}</h3>
            <div style="color:var(--blue); font-weight:bold; font-size:1.2rem;">₪${i.Price}</div>
            <div style="font-size:0.7rem; color:#888;">${i.Barcode}</div>
        </div>`).join('');

    const oldBtn = document.getElementById('loadMore');
    if(oldBtn) oldBtn.remove();
    
    if (data.length > limit) {
        container.insertAdjacentHTML('afterend', `<button id="loadMore" onclick="loadMoreItems()" style="display:block; margin:20px auto; padding:10px 20px; background:var(--blue); color:white; border:none; border-radius:5px; cursor:pointer;">טען עוד מוצרים...</button>`);
    }
}

function loadMoreItems() {
    limit += 20;
    runFilter();
}

function runFilter() {
    const term = document.getElementById('search').value.toLowerCase();
    const field = window.catFieldName || 'Category';
    const filtered = allItems.filter(i => {
        const iCat = i[field] || "";
        return (i.Name.toLowerCase().includes(term) || i.Barcode.includes(term)) && 
               (curCat === "הכל" || iCat === curCat);
    });
    render(filtered);
}

function setCategory(cat) {
    curCat = cat;
    limit = 20;
    runFilter();
}

// תמונה מתחלפת בראש הדף
async function loadDynamicImage() {
    try {
        const r = await fetch(`https://res.cloudinary.com/${CLOUD}/image/list/pictureroll.json`);
        const d = await r.json();
        if (d.resources.length > 0) {
            const rand = d.resources[Math.floor(Math.random() * d.resources.length)];
            const img = document.getElementById('img1');
            if(img) img.src = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${rand.public_id}.${rand.format}`;
        }
    } catch (e) {}
}

function openImage(container) {
    const src = container.querySelector('img').src;
    if(src) {
        document.getElementById('modalImg').src = src;
        document.getElementById('imageModal').style.display = 'flex';
    }
}

// התחלה
async function start() {
    loadCloud('promo', 'promo-slider', 'slider', true);
    loadCloud('promo', 'promo-full', 'grid', true);
    loadCloud('newproducts', 'new-home', 'grid', false);
    loadCloud('newproducts', 'new-full', 'grid', false);
    loadCloud('jobs', 'jobs-grid', 'grid', false);
    
    Papa.parse(CSV, { 
        download: true, 
        header: true, 
        skipEmptyLines: true,
        complete: r => {
            allItems = r.data.filter(x => x.Barcode);
            if (allItems.length > 0) {
                const first = allItems[0];
                window.catFieldName = first.hasOwnProperty('Category') ? 'Category' : 'קטגוריה';
                const cats = ["הכל", ...new Set(allItems.map(x => x[window.catFieldName]))].filter(c => c);
                const sel = document.getElementById('cat-select');
                if(sel) sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
                render(allItems);
            }
        }
    });
}

window.onload = () => {
    start();
    loadDynamicImage();
    setInterval(loadDynamicImage, 5000); // החלפת תמונה כל 5 שניות
};
