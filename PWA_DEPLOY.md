# הוראות פריסת PWA — סופרסטאר

## קבצים להעלאה לשרת (root של האתר)

| קובץ | תיאור |
|------|--------|
| `shifts.html` | האפליקציה (עודכן) |
| `manifest.json` | הגדרות PWA |
| `sw.js` | Service Worker |
| `icon-72.png` עד `icon-512.png` | אייקונים (8 גדלים) |

## דרישות שרת חובה

### 1. HTTPS
Service Workers פועלים רק ב-HTTPS.
אם האתר כבר ב-HTTPS — מצוין.

### 2. כותרות HTTP לקבצים
הוסף ל-.htaccess (Apache) או nginx.conf:

```apache
# .htaccess
<IfModule mod_headers.c>
  # Service Worker — אל תשמור ב-cache
  <FilesMatch "sw\.js$">
    Header set Cache-Control "no-cache, no-store, must-revalidate"
  </FilesMatch>
  # Manifest
  <FilesMatch "manifest\.json$">
    Header set Content-Type "application/manifest+json"
    Header set Cache-Control "public, max-age=3600"
  </FilesMatch>
  # אייקונים
  <FilesMatch "\.(png)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>
</IfModule>
```

### 3. Service Worker scope
`sw.js` חייב להיות ב-root של האתר (`/sw.js`), לא בתת-תיקייה.
אם האתר שלך הוא `superstar-plus.co.il`, כל הקבצים יהיו ב-root.

## התקנה על מכשירים

### אנדרואיד (Chrome)
Chrome יציג אוטומטית באנר "📲 הוסף לדף הבית" כעבור 2-3 ביקורים.
לחלופין: תפריט ⋮ → "הוסף למסך הבית".

### אייפון (Safari)
1. פתח את `superstar-plus.co.il/shifts` ב-Safari
2. לחץ 🔗 (שתף)
3. "הוסף למסך הבית"
4. שנה שם ל"סופרסטאר" → הוסף

**חשוב:** ב-iOS חייבים Safari — Chrome ב-iOS לא תומך ב-PWA.

### שולחן עבודה (Chrome/Edge)
סמל התקנה יופיע בשורת הכתובת.

## בדיקת תקינות

אחרי העלאה, פתח Chrome DevTools:
- Application → Manifest → בדוק שמציג נכון
- Application → Service Workers → בדוק שרשום
- Lighthouse → Run → בדוק ציון PWA

## עדכונים עתידיים

כשמעדכנים `shifts.html` — Service Worker מזהה אוטומטית ומרענן.
אם רוצים לאלץ ריענון מיידי — שנה את `CACHE = 'superstar-v2'` ב-`sw.js`.
