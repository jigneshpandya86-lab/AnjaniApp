// ============================================================
// ANJANI WATER — Integration Tests (Playwright)
// Tests the actual web app in a real browser
// Run: npm run test:integration
// ============================================================

import { test, expect } from '@playwright/test';

// Update this to your actual URL when deployed
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const TEST_PIN  = '9999';

// ─── Helper: Login ─────────────────────────────────────────
async function login(page) {
  await page.goto(BASE_URL);
  await page.waitForSelector('#pin-input', { timeout: 10000 });
  await page.fill('#pin-input', TEST_PIN);
  await page.click('#btn-login');
  // Wait for login screen to disappear
  await page.waitForSelector('#login-screen', { state: 'hidden', timeout: 5000 });
}

// ─── Tests: Login ──────────────────────────────────────────
test.describe('Login Screen', () => {
  test('shows login screen on load', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page.locator('#login-screen')).toBeVisible();
  });

  test('shows error on wrong PIN', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.fill('#pin-input', '0000');
    await page.click('#btn-login');
    await expect(page.locator('#pin-error')).not.toHaveClass(/opacity-0/);
  });

  test('logs in with correct PIN', async ({ page }) => {
    await login(page);
    await expect(page.locator('#login-screen')).toBeHidden();
    await expect(page.locator('#view-orders')).toBeVisible();
  });
});

// ─── Tests: Navigation ─────────────────────────────────────
test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('shows Orders view by default', async ({ page }) => {
    await expect(page.locator('#view-orders')).not.toHaveClass(/hidden/);
  });

  test('navigates to Payments', async ({ page }) => {
    await page.click('#m-btn-payments');
    await expect(page.locator('#view-payments')).not.toHaveClass(/hidden/);
  });

  test('navigates to Stock', async ({ page }) => {
    await page.click('#m-btn-stock');
    await expect(page.locator('#view-stock')).not.toHaveClass(/hidden/);
  });

  test('navigates to Leads', async ({ page }) => {
    await page.click('#m-btn-leads');
    await expect(page.locator('#view-leads')).not.toHaveClass(/hidden/);
  });

  test('navigates to Dashboard', async ({ page }) => {
    await page.click('#m-btn-dashboard');
    await expect(page.locator('#view-dashboard')).not.toHaveClass(/hidden/);
  });
});

// ─── Tests: Order Form ─────────────────────────────────────
test.describe('Order Form', () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test('shows order form elements', async ({ page }) => {
    await expect(page.locator('#ord-cust')).toBeVisible();
    await expect(page.locator('#ord-qty')).toBeVisible();
    await expect(page.locator('#ord-rate')).toBeVisible();
    await expect(page.locator('#btn-save')).toBeVisible();
  });

  test('calculates total when qty and rate entered', async ({ page }) => {
    await page.fill('#ord-qty', '5');
    await page.fill('#ord-rate', '150');
    await page.dispatchEvent('#ord-rate', 'input');
    const total = await page.locator('#ord-total').innerText();
    expect(total).toBe('₹750');
  });

  test('SKU dropdown has all options', async ({ page }) => {
    const options = await page.locator('#ord-sku option').allInnerTexts();
    expect(options.join(' ')).toContain('200ml');
    expect(options.join(' ')).toContain('500ml');
    expect(options.join(' ')).toContain('1L');
  });
});

// ─── Tests: Stock Page ─────────────────────────────────────
test.describe('Stock Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('#m-btn-stock');
  });

  test('shows stock KPI cards', async ({ page }) => {
    await expect(page.locator('#stat-stock')).toBeVisible();
    await expect(page.locator('#stat-today-prod')).toBeVisible();
    await expect(page.locator('#stat-today-del')).toBeVisible();
  });

  test('shows stock level bar', async ({ page }) => {
    await expect(page.locator('#stock-bar')).toBeVisible();
    await expect(page.locator('#stock-level-label')).toBeVisible();
  });

  test('preset qty buttons populate input', async ({ page }) => {
    await page.click('button:has-text("+50")');
    const val = await page.locator('#prod-val').inputValue();
    expect(val).toBe('50');
  });
});

// ─── Tests: AI Chat ────────────────────────────────────────
test.describe('AI Chat', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.click('#m-btn-customers');
  });

  test('shows chat interface', async ({ page }) => {
    await expect(page.locator('#chat-messages')).toBeVisible();
    await expect(page.locator('#chat-input')).toBeVisible();
  });

  test('local interceptor handles "daily summary"', async ({ page }) => {
    // Offline — should use local interceptor, not call GAS
    await page.fill('#chat-input', 'daily summary');
    await page.keyboard.press('Enter');
    // Wait for AI response bubble
    await page.waitForTimeout(500);
    const messages = await page.locator('#chat-messages .bg-white').count();
    expect(messages).toBeGreaterThan(1);
  });

  test('clear history button works', async ({ page }) => {
    await page.click('button:has-text("Clear")');
    const messages = await page.locator('#chat-messages div').count();
    expect(messages).toBeLessThanOrEqual(3); // Only the initial message
  });
});

// ─── Tests: PWA / Offline ──────────────────────────────────
test.describe('PWA Features', () => {
  test('has manifest.json', async ({ page }) => {
    const res = await page.goto(BASE_URL + '/manifest.json');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.name).toBe('Anjani Water');
  });

  test('has service worker registered', async ({ page }) => {
    await login(page);
    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(swRegistered).toBe(true);
  });

  test('shows offline banner when offline', async ({ page, context }) => {
    await login(page);
    await context.setOffline(true);
    // Trigger online/offline event
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('#offline-banner')).toBeVisible();
    await context.setOffline(false);
  });
});

// ─── Tests: Responsive Layout ──────────────────────────────
test.describe('Responsive Layout', () => {
  test('shows mobile nav on small screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await expect(page.locator('nav.lg\\:hidden')).toBeVisible();
    await expect(page.locator('aside.lg\\:flex')).toBeHidden();
  });

  test('shows sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page);
    await expect(page.locator('aside.lg\\:flex')).toBeVisible();
  });
});
