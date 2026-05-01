const CLOUD = "dj56w7nb9";
const CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRQkkYTwMe4n3ViI8N474bKHGGNwqa0GTMwskoWEEOrWJeA-BUrCcK95FZHNqcNqxhlF2INxL9GO70z/pub?output=csv";

let allItems = [];
let curCat = "הכל";
let limit = 20;

// פונקציית ניווט
function nav(id, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    if(el) el.classList.add('active');
    window.scrollTo(0,0);
}

// זום לתמונה
function zoom(url) {
    const lb = document.getElementById('lb-img');
    if(lb) {
        lb.src = url;
        document.getElementById('lightbox').style.display = 'flex';
    }
}

// בדיקת תוקף מבצע (לפי שם הקובץ)
function isFresh(pid) {
    const m = pid.match(/(\d{2})-(\d{2})-(\d{4})/);
    if(!m) return true;
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    const today = new Date(); today.setHours(0,0,0,0);
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
            return type === 'slider' ? 
                `<img src="${url}" onclick="zoom('${url}')">` : 
                `<div class="card" onclick="zoom('${url}')"><img src="${url}"></div>`;
        }).join('');
        
        const target = document.getElementById(divId);
        if(target) target.innerHTML = type === 'slider' ? (html + html) : html;
    } catch(e) { console.error("Cloudinary error:", e); }
}

// רינדור קטלוג
function render(data) {
    const container = document.getElementById('catalog-grid');
    if(!container) return;
    
    const slice = data.slice(0, limit);
    container.innerHTML = slice.map(i => `
        <div class="card">
            <img src="https://res.cloudinary.com/dj56w7nb9/image/upload/f_auto,q_auto/products/${i.Barcode}.jpg" 
                 onclick="zoom(this.src)" loading="lazy" onerror="this.src=''">
            <h3>${i.Name}</h3>
            <div class="price">₪${i.Price}</div>
            <div class="barcode">ברקוד: ${i.Barcode}</div>
        </div>`).join('');

    const oldBtn = document.getElementById('loadMore');
    if(oldBtn) oldBtn.remove();
    if (data.length > limit) {
        container.insertAdjacentHTML('afterend', `<button id="loadMore" onclick="loadMoreItems()" class="load-more-btn">טען מוצרים נוספים...</button>`);
    }
}

function loadMoreItems() {
    limit += 20;
    runFilter();
}

// סינון
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

// הפעלה ראשונית
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
            allItems = r.data.filter(x => x.Barcode && x.Barcode.trim() !== '');
            if (allItems.length > 0) {
                const first = allItems[0];
                const catField = first.hasOwnProperty('Category') ? 'Category' : 
                                 first.hasOwnProperty('category') ? 'category' : 
                                 first.hasOwnProperty('קטגוריה') ? 'קטגוריה' : 'Category';
                
                window.catFieldName = catField;
                const cats = ["הכל", ...new Set(allItems.map(x => x[catField]))].filter(c => c).sort();
                const sel = document.getElementById('cat-select');
                if(sel) sel.innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
                render(allItems);
            }
        }
    });
}

// Picture Roll
async function loadDynamicImage() {
    try {
        const response = await fetch(`https://res.cloudinary.com/${CLOUD}/image/list/pictureroll.json`);
        const data = await response.json();
        if (data.resources.length > 0) {
            const randomImg = data.resources[Math.floor(Math.random() * data.resources.length)];
            const img = document.getElementById('img1');
            if(img) img.src = `https://res.cloudinary.com/${CLOUD}/image/upload/f_auto,q_auto/${randomImg.public_id}.${randomImg.format}`;
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

// Event Listeners
window.onload = () => {
    start();
    loadDynamicImage();
    setInterval(loadDynamicImage, 8000);
};
