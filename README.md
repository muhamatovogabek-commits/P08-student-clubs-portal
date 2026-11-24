# CampusClubs Portal (P08 — Cyber University DIK1305)

Talabalar klublari va tadbirlar portali — HTML5, CSS3 (Dark Mode), Vanilla JavaScript (ES Modules), `localStorage` va Node.js avtomatlashtirilgan testlari bilan yaratilgan veb-ilova.

## Loyiha strukturasi

- `index.html` — asosiy veb-ilova interfeysi (4 ta ekran + rol almashtirgich)
- `css/style.css` — zamonaviy Dark Mode va mobilga mos responsive dizayn
- `src/rules.js` — DOMga bog‘liq bo‘lmagan sof biznes qoidalari moduli
- `src/data.js` — boshlang‘ich namuna ma’lumotlar (2 ta klub, 3 ta tadbir, 3 ta demo hisob)
- `src/app.js` — UI, `localStorage` va `rules.js` ni bog‘lovchi boshqaruv kodi
- `tests/rules.test.js` — Node.js built-in test runner (`node --test`) uchun testlar
- `package.json` — `"type": "module"` va `"test": "node --test"` skripti
- `.github/workflows/ci.yml` — GitHub Actions CI/CD workflow

## Ishga tushirish

ES Modules (`import`/`export`) brauzerda to‘g‘ri ishlashi uchun loyihani lokal HTTP server orqali oching (masalan, VS Code **Live Server** yoki Node/Python):

```bash
npx serve .
# yoki
python3 -m http.server 8080
```

So‘ng brauzerda `http://localhost:8080` manzilini oching.

## Avtomatlashtirilgan testlarni ishga tushirish

```bash
npm test
```
