// ============================================================
// ANJANI WATER — API BRIDGE
// Replaces google.script.run with fetch() calls to your
// deployed Google Apps Script Web App URL.
//
// HOW TO SET YOUR URL:
//   1. In Apps Script → Deploy → New Deployment → Web App
//   2. Execute as: Me | Who has access: Only myself
//   3. Copy the URL and paste it below
// ============================================================

const GAS_URL = window.GAS_URL || 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

// ─── Core fetch wrapper ────────────────────────────────────
async function gasCall(fn, params = {}) {
  const url = new URL(GAS_URL);
  url.searchParams.set('fn', fn);
  url.searchParams.set('params', JSON.stringify(params));

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return text; }
}

// POST version for mutations
async function gasPost(fn, data = {}) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ fn, params: JSON.stringify(data) })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return text; }
}

// ─── google.script.run polyfill ───────────────────────────
// Makes the existing app code work with ZERO changes
window.google = {
  script: {
    run: new Proxy({}, {
      get(_, fnName) {
        let _successHandler = null;
        let _failureHandler = (e) => console.error('GAS Error:', e);

        const runner = {
          withSuccessHandler(fn) { _successHandler = fn; return runner; },
          withFailureHandler(fn) { _failureHandler = fn; return runner; },
          // Called when function is invoked: google.script.run.myFn(arg1, arg2)
          ...new Proxy({}, {
            get(_, method) {
              return (...args) => {
                const payload = args.length === 1 ? args[0] : args;
                gasPost(method, { args })
                  .then(result => { if (_successHandler) _successHandler(result); })
                  .catch(err => { if (_failureHandler) _failureHandler(err); });
              };
            }
          })
        };

        // Direct call: google.script.run.fnName(arg)
        return (...args) => {
          const obj = {
            withSuccessHandler(fn) { _successHandler = fn; return obj; },
            withFailureHandler(fn) { _failureHandler = fn; return obj; }
          };
          gasPost(fnName, { args })
            .then(result => { if (_successHandler) _successHandler(result); })
            .catch(err => { if (_failureHandler) _failureHandler(err); });
          return obj;
        };
      }
    })
  }
};

// ─── Cleaner direct API methods (used by offline cache) ───
const API = {
  async getInitialData()          { return gasPost('getInitialData', {}); },
  async getLeadsData()            { return gasPost('getLeadsData', {}); },
  async getStockData()            { return gasPost('getStockData', {}); },
  async getPaymentsData()         { return gasPost('getPaymentsData', {}); },
  async getDashboardMetrics()     { return gasPost('getDashboardMetrics', {}); },
  async saveOrder(data)           { return gasPost('saveOrder', { args: [data] }); },
  async saveCustomer(data)        { return gasPost('saveCustomer', { args: [data] }); },
  async savePayment(data)         { return gasPost('savePayment', { args: [data] }); },
  async saveProduction(data)      { return gasPost('saveProduction', { args: [data] }); },
  async saveLead(data)            { return gasPost('saveLead', { args: [data] }); },
  async saveJob(data)             { return gasPost('saveJob', { args: [data] }); },
  async updateOrderStatus(...a)   { return gasPost('updateOrderStatus', { args: a }); },
  async handleLeadAction(a, id)   { return gasPost('handleLeadAction', { args: [a, id] }); },
  async parseTextWithGemini(t)    { return gasPost('parseTextWithGemini', { args: [t] }); },
};

export default API;
