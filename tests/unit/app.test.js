// ============================================================
// ANJANI WATER — Unit Tests
// Tests core business logic functions in isolation
// Run: npm run test:unit
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock DB (mirrors real structure) ──────────────────────
const mockDB = {
  customers: [
    { id: 'C-001', name: 'Ramesh Patel',  mobile: '9876543210', rate: 150, active: true,  outstanding: 1500 },
    { id: 'C-002', name: 'Suresh Shah',   mobile: '9876543211', rate: 200, active: true,  outstanding: 0    },
    { id: 'C-003', name: 'Inactive User', mobile: '9876543212', rate: 150, active: false, outstanding: 0    },
  ],
  orders: [
    { id: 1001, clientId: 'C-001', customer: 'Ramesh Patel',  boxes: 10, rate: 150, amount: 1500, status: 'Pending',   deliveryDate: '2025-01-15', time: '09:00', sku: '200ml' },
    { id: 1002, clientId: 'C-001', customer: 'Ramesh Patel',  boxes: 5,  rate: 150, amount: 750,  status: 'Delivered', deliveryDate: '2025-01-10', time: '10:00', sku: '200ml' },
    { id: 1003, clientId: 'C-002', customer: 'Suresh Shah',   boxes: 8,  rate: 200, amount: 1600, status: 'Delivered', deliveryDate: '2025-01-12', time: '11:00', sku: '500ml' },
  ],
  payments: [
    { date: '2025-01-11', customer: 'Ramesh Patel', amount: 500,  clientId: 'C-001', mobile: '9876543210' },
    { date: '2025-01-13', customer: 'Suresh Shah',  amount: 1600, clientId: 'C-002', mobile: '9876543211' },
  ],
  stock: [
    { date: '2025-01-15', produced: 500, delivered: 0,   customer: '',            sku: '200ml' },
    { date: '2025-01-15', produced: 0,   delivered: 10,  customer: 'Ramesh',      sku: '200ml' },
    { date: '2025-01-14', produced: 300, delivered: 0,   customer: '',            sku: '500ml' },
    { date: '2025-01-14', produced: 0,   delivered: 8,   customer: 'Suresh',      sku: '500ml' },
  ],
  leads: [
    { id: 'Lead-001', mobile: '9000000001', status: 'New',  lastContact: '2025-01-14' },
    { id: 'Lead-002', mobile: '9000000002', status: 'Sam',  lastContact: '2025-01-13' },
    { id: 'Lead-003', mobile: '9000000003', status: 'Con',  lastContact: '2025-01-10' },
  ],
  jobs: [],
  smartMsgs: {
    'Pay_Polite': 'Hello {name}, pending balance is ₹{amount}. Please pay.',
    'Lead_Day0':  'Welcome to Anjani Water! Reply YES for rates.',
  }
};

// ─── Pure function extractions from app logic ──────────────
// These mirror the logic in app.js

function custBal(customers, cid) {
  const c = customers.find(x => String(x.id) === String(cid));
  return c ? (Number(c.outstanding) || 0) : 0;
}

function findCust(customers, name) {
  if (!name) return null;
  const clean = name.toLowerCase().replace(/(bhai|ben|ji|bhen)/g, '').trim();
  return customers.find(c =>
    c.name.toLowerCase().replace(/(bhai|ben|ji|bhen)/g, '').trim().includes(clean) ||
    clean.includes(c.name.toLowerCase().replace(/(bhai|ben|ji|bhen)/g, '').trim())
  );
}

function calcNetStock(stock) {
  let net = 0;
  stock.forEach(s => { net += (Number(s.produced) || 0) - (Number(s.delivered) || 0); });
  return net;
}

function calcSkuBreakdown(stock) {
  const skuMap = {};
  stock.forEach(s => {
    const sku = s.sku || '200ml';
    skuMap[sku] = (skuMap[sku] || 0) + (Number(s.produced) || 0) - (Number(s.delivered) || 0);
  });
  return skuMap;
}

function filterPendingOrders(orders) {
  return orders.filter(o => o.status === 'Pending');
}

function filterDeliveredOrders(orders) {
  return orders.filter(o => o.status === 'Delivered');
}

function calcRevenue(orders, fromDate, toDate) {
  return orders
    .filter(o => o.status !== 'Pending' && o.deliveryDate >= fromDate && o.deliveryDate <= toDate)
    .reduce((s, o) => s + (Number(o.amount) || 0), 0);
}

function calcCollection(payments, fromDate, toDate) {
  return payments
    .filter(p => p.date >= fromDate && p.date <= toDate)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

function getActiveCustomers(customers) {
  return customers.filter(c => String(c.active) !== 'false');
}

function getDueCustomers(customers) {
  return customers.filter(c => custBal(customers, c.id) > 0);
}

// ─── Tests ─────────────────────────────────────────────────

describe('Customer Balance', () => {
  it('returns correct outstanding for customer with dues', () => {
    expect(custBal(mockDB.customers, 'C-001')).toBe(1500);
  });

  it('returns 0 for customer with no dues', () => {
    expect(custBal(mockDB.customers, 'C-002')).toBe(0);
  });

  it('returns 0 for unknown customer ID', () => {
    expect(custBal(mockDB.customers, 'UNKNOWN')).toBe(0);
  });
});

describe('Customer Search (fuzzy)', () => {
  it('finds customer by exact name', () => {
    const result = findCust(mockDB.customers, 'Ramesh Patel');
    expect(result).not.toBeNull();
    expect(result.id).toBe('C-001');
  });

  it('finds customer by partial name', () => {
    const result = findCust(mockDB.customers, 'Ramesh');
    expect(result).not.toBeNull();
    expect(result.name).toContain('Ramesh');
  });

  it('finds customer ignoring honorifics', () => {
    const result = findCust(mockDB.customers, 'Ramesh bhai');
    expect(result).not.toBeNull();
    expect(result.id).toBe('C-001');
  });

  it('returns null for unknown name', () => {
    const result = findCust(mockDB.customers, 'Xyz Unknown Person');
    expect(result).toBeNull();
  });
});

describe('Stock Calculations', () => {
  it('calculates correct net stock', () => {
    const net = calcNetStock(mockDB.stock);
    // 500 produced - 10 delivered (200ml) + 300 produced - 8 delivered (500ml) = 782
    expect(net).toBe(782);
  });

  it('calculates SKU breakdown correctly', () => {
    const breakdown = calcSkuBreakdown(mockDB.stock);
    expect(breakdown['200ml']).toBe(490); // 500 - 10
    expect(breakdown['500ml']).toBe(292); // 300 - 8
  });

  it('returns 0 net stock for empty array', () => {
    expect(calcNetStock([])).toBe(0);
  });
});

describe('Order Filters', () => {
  it('filters pending orders correctly', () => {
    const pending = filterPendingOrders(mockDB.orders);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(1001);
  });

  it('filters delivered orders correctly', () => {
    const delivered = filterDeliveredOrders(mockDB.orders);
    expect(delivered).toHaveLength(2);
  });

  it('all orders are either pending or delivered', () => {
    const total = mockDB.orders.length;
    const pending = filterPendingOrders(mockDB.orders).length;
    const delivered = filterDeliveredOrders(mockDB.orders).length;
    expect(pending + delivered).toBe(total);
  });
});

describe('Revenue and Collection', () => {
  it('calculates revenue for date range', () => {
    const rev = calcRevenue(mockDB.orders, '2025-01-01', '2025-01-31');
    expect(rev).toBe(2350); // 750 + 1600
  });

  it('calculates collection for date range', () => {
    const col = calcCollection(mockDB.payments, '2025-01-01', '2025-01-31');
    expect(col).toBe(2100); // 500 + 1600
  });

  it('returns 0 revenue for date range with no orders', () => {
    const rev = calcRevenue(mockDB.orders, '2020-01-01', '2020-12-31');
    expect(rev).toBe(0);
  });
});

describe('Customer Filters', () => {
  it('returns only active customers', () => {
    const active = getActiveCustomers(mockDB.customers);
    expect(active).toHaveLength(2);
    expect(active.every(c => String(c.active) !== 'false')).toBe(true);
  });

  it('returns customers with dues', () => {
    const withDues = getDueCustomers(mockDB.customers);
    expect(withDues).toHaveLength(1);
    expect(withDues[0].id).toBe('C-001');
  });
});

describe('SMS Message Templates', () => {
  it('replaces {name} placeholder', () => {
    const tmpl = mockDB.smartMsgs['Pay_Polite'];
    const msg = tmpl.replace('{name}', 'Ramesh').replace('{amount}', '1500');
    expect(msg).toContain('Ramesh');
    expect(msg).toContain('1500');
    expect(msg).not.toContain('{name}');
    expect(msg).not.toContain('{amount}');
  });
});
