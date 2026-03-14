# Anjani Water App — Phase 1: Web Deployment

## What's In This Package

```
anjani-web/
├── www/                        ← Your web app (deploy this folder)
│   ├── index.html              ← Main app (paste your JS here — see Step 3)
│   ├── api.js                  ← API bridge (reference only)
│   ├── sw.js                   ← Service worker (offline support)
│   ├── offline.html            ← Shown when offline
│   ├── manifest.json           ← Makes app installable on Android
│   └── Router.gs               ← Add this to your Apps Script (see Step 1)
├── .github/workflows/
│   └── deploy-web.yml          ← Auto-deploys to GitHub Pages on every push
├── tests/
│   ├── unit/app.test.js        ← Unit tests (business logic)
│   └── integration/app.spec.js ← Browser tests (Playwright)
├── package.json
├── playwright.config.js
└── vitest.config.js
```

---

## STEP 1 — Update Your Apps Script (5 minutes)

### 1a. Add the Router
1. Open your Apps Script project
2. Click **+ (New File)** → Name it `Router`
3. Copy the entire contents of `www/Router.gs` into it
4. Save (Ctrl+S)

### 1b. Update doGet()
Your existing `doGet()` in `Code.gs` will be **replaced** by the one in `Router.gs`.  
Delete the old `doGet()` from `Code.gs` — the Router has the new version.

### 1c. Deploy as Web App
1. Click **Deploy** → **New Deployment**
2. Type: **Web app**
3. Description: `Anjani Web App v1`
4. Execute as: **Me (jigneshpandya86@gmail.com)**
5. Who has access: **Only myself**
6. Click **Deploy**
7. **Copy the Web App URL** — you'll need it in Step 3

---

## STEP 2 — Create GitHub Repository (3 minutes)

1. Go to [github.com](https://github.com) → Sign in
2. Click **+** (top right) → **New repository**
3. Repository name: `AnjaniApp` (or any name)
4. ✅ Make it **Public** (required for free GitHub Pages)
5. Click **Create repository**
6. On the next screen, click **uploading an existing file**
7. **Drag and drop this entire `anjani-web` folder** into the upload area
8. Scroll down → Click **Commit changes**

---

## STEP 3 — Paste Your App JavaScript (10 minutes)

Open `www/index.html` in GitHub's editor (click the file → pencil icon):

### 3a. Set your GAS URL
Find this line near the bottom:
```javascript
window.GAS_URL = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```
Replace with your actual URL from Step 1c:
```javascript
window.GAS_URL = 'https://script.google.com/macros/s/YOUR_ACTUAL_ID/exec';
```

### 3b. Paste your JavaScript
Find the comment block:
```javascript
// ── All your existing JS (GLOBAL STATE through forceRefresh) goes here ──
```

Paste the entire `<script>` contents from your original `index.html`
(everything from `// GLOBAL STATE` through the end of `forceRefresh()`).

### 3c. Save
Click **Commit changes** → **Commit directly to main**

---

## STEP 4 — Enable GitHub Pages (2 minutes)

1. In your GitHub repo → **Settings** tab
2. Left sidebar → **Pages**
3. Source: **GitHub Actions**
4. Click **Save**

---

## STEP 5 — Watch It Deploy

1. Go to the **Actions** tab in your repo
2. You'll see a workflow running — click it to watch live
3. When it shows ✅ green, your app is live!

Your app URL will be:
```
https://YOUR-GITHUB-USERNAME.github.io/AnjaniApp/
```

---

## STEP 6 — Point Your Domain (5 minutes)

In your domain registrar (wherever anjaniwater.in is registered):

### Add these DNS records:
| Type  | Name | Value                              |
|-------|------|------------------------------------|
| CNAME | app  | YOUR-GITHUB-USERNAME.github.io     |
| A     | @    | 185.199.108.153                    |
| A     | @    | 185.199.109.153                    |
| A     | @    | 185.199.110.153                    |
| A     | @    | 185.199.111.153                    |

Then in GitHub → Settings → Pages → Custom domain:
Enter: `app.anjaniwater.in` → Save

Your app will be live at: **https://app.anjaniwater.in** ✅

---

## STEP 7 — Test on Mobile Browser

Before building the APK, test on your phone:

1. Open Chrome on Android
2. Go to `https://app.anjaniwater.in`
3. Enter PIN: `9999`
4. Test all features (orders, payments, stock, AI chat)
5. Chrome will show **"Add to Home Screen"** banner — tap it!

This installs as a PWA on your home screen — works even without a real APK.

---

## Offline Features Included

| Feature | Status |
|---------|--------|
| App loads offline | ✅ Cached by service worker |
| Last data shown offline | ✅ Stored in local cache |
| Changes queued offline | ✅ Syncs when back online |
| Offline banner shown | ✅ Yellow banner at top |
| Connection indicator | ✅ Green/amber dot in sidebar |

---

## Running Tests Locally

```bash
# Install dependencies
npm install

# Run unit tests (no browser needed, ~2 seconds)
npm run test:unit

# Run integration tests (needs Chrome)
npx playwright install chromium
npm run test:integration

# Watch mode for unit tests during development
npm run test:watch
```

---

## What's Next — Phase 2 (APK)

Once Phase 1 is working and tested:
- We wrap the working web app URL with Capacitor
- Add camera plugin (`@capacitor/camera`)
- Add file access plugin (`@capacitor/filesystem`)  
- GitHub Actions builds the `.apk` automatically
- All your business logic stays exactly the same

---

## Troubleshooting

### "google.script.run is not defined"
→ The polyfill in index.html handles this. Check that `window.GAS_URL` is set correctly.

### App loads but shows no data
→ Your GAS Web App URL may be wrong, or the deployment needs re-authorising.
→ Open the GAS URL directly in browser — it should show your HTML app.

### CORS error in browser console
→ The JSONP polyfill avoids CORS. If you see this, ensure you're using the
  JSONP method (no-cors fetch) in the polyfill section of index.html.

### GitHub Pages shows 404
→ Ensure GitHub Pages is set to **GitHub Actions** (not branch/root).
→ Check the Actions tab for any deployment errors.
