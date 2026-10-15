/**
 * In-memory Mock for Firebase Admin SDK and Firestore
 * Allows full isolation for automated unit & integration testing.
 */

class MockDocSnapshot {
  constructor(collName, id, data, store) {
    this.collName = collName;
    this.id = id;
    this._data = data ? JSON.parse(JSON.stringify(data)) : null;
    this.exists = !!data;
    this.ref = new MockDocumentReference(collName, id, store);
  }
  data() {
    return this._data ? JSON.parse(JSON.stringify(this._data)) : undefined;
  }
}

class MockQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
  forEach(callback) {
    this.docs.forEach(callback);
  }
}

class MockCollectionReference {
  constructor(name, store) {
    this.name = name;
    this.store = store;
  }

  doc(id) {
    const docId = id || `mock_doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return new MockDocumentReference(this.name, docId, this.store);
  }

  async add(data) {
    const docRef = this.doc();
    await docRef.set(data);
    return docRef;
  }

  where(field, op, value) {
    return new MockQuery(this.name, this.store, [{ field, op, value }]);
  }

  orderBy(field, direction = 'asc') {
    return new MockQuery(this.name, this.store, [], { field, direction });
  }

  limit(num) {
    return new MockQuery(this.name, this.store, [], null, num);
  }

  offset(num) {
    return new MockQuery(this.name, this.store, [], null, null, num);
  }

  async get() {
    const coll = this.store[this.name] || {};
    const docs = Object.keys(coll).map((id) => new MockDocSnapshot(this.name, id, coll[id], this.store));
    return new MockQuerySnapshot(docs);
  }
}

class MockDocumentReference {
  constructor(collName, id, store) {
    this.collName = collName;
    this.id = id;
    this.store = store;
  }

  async get() {
    const coll = this.store[this.collName] || {};
    const data = coll[this.id];
    return new MockDocSnapshot(this.collName, this.id, data, this.store);
  }

  async set(data) {
    if (!this.store[this.collName]) {
      this.store[this.collName] = {};
    }
    this.store[this.collName][this.id] = JSON.parse(JSON.stringify(data));
  }

  async create(data) {
    if (this.store[this.collName] && this.store[this.collName][this.id]) {
      const err = new Error(`Document ${this.id} already exists`);
      err.code = 6; // ALREADY_EXISTS, as in the real Admin SDK
      throw err;
    }
    return this.set(data);
  }

  async update(updates) {
    if (!this.store[this.collName] || !this.store[this.collName][this.id]) {
      const err = new Error(`Document ${this.id} does not exist`);
      err.code = 5;
      throw err;
    }
    const current = this.store[this.collName][this.id];
    this.store[this.collName][this.id] = { ...current, ...JSON.parse(JSON.stringify(updates)) };
  }

  async delete() {
    if (this.store[this.collName]) {
      delete this.store[this.collName][this.id];
    }
  }
}

class MockQuery {
  constructor(collName, store, filters = [], order = null, limitCount = null, offsetCount = 0) {
    this.collName = collName;
    this.store = store;
    this.filters = filters;
    this.order = order;
    this.limitCount = limitCount;
    this.offsetCount = offsetCount || 0;
  }

  where(field, op, value) {
    return new MockQuery(
      this.collName,
      this.store,
      [...this.filters, { field, op, value }],
      this.order,
      this.limitCount,
      this.offsetCount
    );
  }

  orderBy(field, direction = 'asc') {
    return new MockQuery(
      this.collName,
      this.store,
      this.filters,
      { field, direction },
      this.limitCount,
      this.offsetCount
    );
  }

  limit(num) {
    return new MockQuery(
      this.collName,
      this.store,
      this.filters,
      this.order,
      num,
      this.offsetCount
    );
  }

  offset(num) {
    return new MockQuery(
      this.collName,
      this.store,
      this.filters,
      this.order,
      this.limitCount,
      num
    );
  }

  async get() {
    const coll = this.store[this.collName] || {};
    let docs = Object.keys(coll).map((id) => ({ id, data: coll[id] }));

    // Apply where filters
    for (const filter of this.filters) {
      docs = docs.filter((d) => {
        const val = this._getNestedValue(d.data, filter.field);
        if (filter.op === '==') return val === filter.value;
        if (filter.op === '>=') return val >= filter.value;
        if (filter.op === '<=') return val <= filter.value;
        if (filter.op === '>') return val > filter.value;
        if (filter.op === '<') return val < filter.value;
        return true;
      });
    }

    // Apply ordering
    if (this.order) {
      docs.sort((a, b) => {
        const valA = this._getNestedValue(a.data, this.order.field);
        const valB = this._getNestedValue(b.data, this.order.field);
        if (valA === undefined && valB === undefined) return 0;
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (valA < valB) return this.order.direction === 'asc' ? -1 : 1;
        if (valA > valB) return this.order.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply offset and limit
    if (this.offsetCount > 0) {
      docs = docs.slice(this.offsetCount);
    }
    if (this.limitCount !== null) {
      docs = docs.slice(0, this.limitCount);
    }

    const snapDocs = docs.map((d) => new MockDocSnapshot(this.collName, d.id, d.data, this.store));
    return new MockQuerySnapshot(snapDocs);
  }

  _getNestedValue(obj, path) {
    if (!obj) return undefined;
    return path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
  }
}

class MockBatch {
  constructor(store) {
    this.store = store;
    this.operations = [];
  }

  set(docRef, data) {
    this.operations.push(() => docRef.set(data));
    return this;
  }

  update(docRef, data) {
    this.operations.push(() => docRef.update(data));
    return this;
  }

  delete(docRef) {
    this.operations.push(() => docRef.delete());
    return this;
  }

  async commit() {
    for (const op of this.operations) {
      await op();
    }
    this.operations = [];
  }
}

class MockFirestore {
  constructor() {
    this.store = {};
  }

  collection(name) {
    return new MockCollectionReference(name, this.store);
  }

  batch() {
    return new MockBatch(this.store);
  }

  doc(path) {
    const [collName, id] = path.split('/');
    return new MockDocumentReference(collName, id, this.store);
  }

  // Sequential stand-in for Firestore transactions: reads run immediately, writes apply on commit
  async runTransaction(fn) {
    const ops = [];
    const tx = {
      get: (ref) => ref.get(),
      update: (ref, data) => ops.push(() => ref.update(data)),
      set: (ref, data) => ops.push(() => ref.set(data)),
      create: (ref, data) => ops.push(() => ref.create(data)),
      delete: (ref) => ops.push(() => ref.delete())
    };
    const result = await fn(tx);
    for (const op of ops) await op();
    return result;
  }

  settings() {}

  reset() {
    for (const key of Object.keys(this.store)) {
      delete this.store[key];
    }
  }
}

const mockDb = new MockFirestore();
const originalReset = mockDb.reset.bind(mockDb);

/**
 * In-memory Auth registry. Tokens map to accounts; custom claims live on the account,
 * like real Firebase (verifyIdToken returns the claims of the account).
 *   valid_user_token / demo_token_<uid> / token_user_<x>  -> patient accounts (legacy role 'user')
 *   therapist_token                                      -> therapist_001_dr_sharma (legacy role 'therapist')
 *   doctor_token_<uid>                                   -> doctor account <uid>
 *   admin_token                                          -> admin_001
 *   revoked_token                                        -> auth/id-token-revoked
 */
const DEFAULT_ACCOUNTS = () => ({
  therapist_001_dr_sharma: { uid: 'therapist_001_dr_sharma', email: 'dr.sharma@example.com', disabled: false, customClaims: { role: 'therapist' } },
  admin_001: { uid: 'admin_001', email: 'admin@example.com', disabled: false, customClaims: { role: 'admin' } }
});

const mockAuth = {
  accounts: DEFAULT_ACCOUNTS(),
  revokedUids: new Set(),

  reset() {
    this.accounts = DEFAULT_ACCOUNTS();
    this.revokedUids = new Set();
  },

  addAccount(uid, role, extra = {}) {
    this.accounts[uid] = { uid, email: `${uid}@example.com`, disabled: false, customClaims: role ? { role } : {}, ...extra };
    return this.accounts[uid];
  },

  _ensure(uid, defaultRole) {
    if (!this.accounts[uid]) this.addAccount(uid, defaultRole);
    return this.accounts[uid];
  },

  async verifyIdToken(token, checkRevoked = false) {
    if (token === 'expired_token') {
      const err = new Error('Firebase ID token has expired');
      err.code = 'auth/id-token-expired';
      throw err;
    }
    if (token === 'invalid_token') {
      const err = new Error('Invalid Firebase ID token supplied');
      err.code = 'auth/invalid-id-token';
      throw err;
    }
    if (token === 'revoked_token') {
      const err = new Error('Firebase ID token has been revoked');
      err.code = 'auth/id-token-revoked';
      throw err;
    }

    let account;
    if (token === 'therapist_token') account = this._ensure('therapist_001_dr_sharma', 'therapist');
    else if (token === 'admin_token') account = this._ensure('admin_001', 'admin');
    else if (token.startsWith('doctor_token_')) account = this._ensure(token.replace('doctor_token_', ''), 'doctor');
    else if (token.startsWith('token_user_')) account = this._ensure(token.replace('token_', ''), 'user');
    else if (token === 'valid_user_token' || token.startsWith('demo_token_')) {
      const uid = token.startsWith('demo_token_') ? token.replace('demo_token_', '') : 'user_001_arjun';
      account = this._ensure(uid, 'user');
    } else {
      const err = new Error('Unknown or invalid token');
      err.code = 'auth/argument-error';
      throw err;
    }

    if (checkRevoked && this.revokedUids.has(account.uid)) {
      const err = new Error('Firebase ID token has been revoked');
      err.code = 'auth/id-token-revoked';
      throw err;
    }
    if (checkRevoked && account.disabled) {
      const err = new Error('The user account has been disabled');
      err.code = 'auth/user-disabled';
      throw err;
    }
    return { uid: account.uid, email: account.email, ...account.customClaims };
  },

  async getUser(uid) {
    const account = this.accounts[uid];
    if (!account) {
      const err = new Error('There is no user record corresponding to the provided identifier.');
      err.code = 'auth/user-not-found';
      throw err;
    }
    return JSON.parse(JSON.stringify(account));
  },

  async getUserByEmail(email) {
    const account = Object.values(this.accounts).find((a) => a.email === email);
    if (!account) {
      const err = new Error('There is no user record corresponding to the provided identifier.');
      err.code = 'auth/user-not-found';
      throw err;
    }
    return JSON.parse(JSON.stringify(account));
  },

  async setCustomUserClaims(uid, claims) {
    if (!this.accounts[uid]) {
      const err = new Error('There is no user record corresponding to the provided identifier.');
      err.code = 'auth/user-not-found';
      throw err;
    }
    this.accounts[uid].customClaims = { ...(claims || {}) };
  },

  async revokeRefreshTokens(uid) {
    this.revokedUids.add(uid);
  },

  async createCustomToken(uid) {
    return `custom_${uid}`;
  }
};

const mockTimestamp = {
  now: () => ({
    seconds: Math.floor(Date.now() / 1000),
    nanoseconds: 0,
    toDate: () => new Date(),
    toMillis: () => Date.now()
  }),
  fromDate: (date) => ({
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toDate: () => date,
    toMillis: () => date.getTime()
  })
};

module.exports = {
  mockDb,
  mockAuth,
  mockTimestamp
};

// Resetting the database also resets the Auth registry so each test starts clean.
mockDb.reset = function resetAll() {
  originalReset();
  mockAuth.reset();
};
