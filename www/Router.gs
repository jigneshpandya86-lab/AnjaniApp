// ============================================================
// ANJANI WATER — WEB APP ROUTER (Add to Code.gs)
// ============================================================
// Replace your existing doGet() function with this version.
// This allows the standalone web app at anjaniwater.in to
// call your Apps Script backend directly.
//
// DEPLOY SETTINGS:
//   Deploy → New Deployment → Web App
//   Execute as: Me (Jignesh)
//   Who has access: Only myself
//   ⚠️  Copy the Web App URL into index.html → window.GAS_URL
// ============================================================

/**
 * Handle GET requests — serves the HTML app when accessed via Apps Script URL,
 * OR handles JSONP API calls from the standalone web app.
 */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  // ── JSONP API call from standalone web app ─────────────────
  if (params.fn) {
    const result = routeFunction(params.fn, JSON.parse(params.params || '[]'));
    const callback = params.callback || 'callback';
    const output = callback + '(' + JSON.stringify(result) + ')';
    return ContentService.createTextOutput(output)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // ── Normal HTML serving (original behaviour) ──────────────
  return HtmlService.createTemplateFromFile('index').evaluate()
    .setTitle('ANJANI')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Handle POST requests from the standalone web app.
 * Returns JSON with CORS headers so anjaniwater.in can call it.
 */
function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  const fnName = params.fn || '';
  let args = [];

  try {
    const parsed = JSON.parse(params.params || '{}');
    args = parsed.args || [];
  } catch (err) {
    args = [];
  }

  let result;
  try {
    result = routeFunction(fnName, args);
  } catch (err) {
    result = { error: err.toString() };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Routes function name to actual function.
 * Add any new functions here as you build them.
 */
function routeFunction(fnName, args) {
  const routes = {
    // ── Data fetch ───────────────────────────────────────────
    'getInitialData':         () => getInitialData(),
    'getLeadsData':           () => getLeadsData(),
    'getStockData':           () => getStockData(),
    'getPaymentsData':        () => getPaymentsData(),
    'getDashboardMetrics':    () => getDashboardMetrics(),
    'fetchLocalDB':           () => JSON.stringify(fetchLocalDB()),
    'getSmsCandidates':       () => getSmsCandidates(),
    'getJobsData':            () => JSON.stringify(getJobsData()),

    // ── Orders ───────────────────────────────────────────────
    'saveOrder':              () => saveOrder(args[0]),
    'updateOrderStatus':      () => updateOrderStatus(args[0], args[1], args[2], args[3], args[4], args[5]),
    'updateOrderLocation':    () => updateOrderLocation(args[0]),
    'createDirectOrder':      () => createDirectOrder(args[0]),

    // ── Customers ────────────────────────────────────────────
    'saveCustomer':           () => saveCustomer(args[0]),

    // ── Payments ─────────────────────────────────────────────
    'savePayment':            () => savePayment(args[0]),
    'recordDirectPayment':    () => recordDirectPayment(args[0]),

    // ── Stock ────────────────────────────────────────────────
    'saveProduction':         () => saveProduction(args[0]),

    // ── Leads ────────────────────────────────────────────────
    'saveLead':               () => saveLead(args[0]),
    'handleLeadAction':       () => handleLeadAction(args[0], args[1]),
    'archiveOldLeads':        () => archiveOldLeads(),
    'updateLeadStatus':       () => updateLeadStatus(args[0]),
    'saveLeadNote':           () => saveLeadNote(args[0], args[1]),
    'logLeadBroadcast':       () => logLeadBroadcast(args[0]),

    // ── Jobs ─────────────────────────────────────────────────
    'saveJob':                () => saveJob(args[0]),

    // ── AI / Gemini ──────────────────────────────────────────
    'parseTextWithGemini':    () => parseTextWithGemini(args[0]),
    'saveNewRuleToBrain':     () => saveNewRuleToBrain(args[0], args[1], args[2]),

    // ── SMS / Smart ──────────────────────────────────────────
    'sendBackgroundSms':      () => sendBackgroundSms(args[0], args[1]),
    'logSmsSuccess':          () => logSmsSuccess(args[0], args[1]),
    'logSmartAction':         () => logSmartAction(args[0], args[1]),
    'runComboActions':        () => runComboActions(),

    // ── Dashboard ────────────────────────────────────────────
    'getDashboardMetrics':    () => getDashboardMetrics(),
  };

  if (routes[fnName]) {
    return routes[fnName]();
  }

  return { error: 'Unknown function: ' + fnName };
}
