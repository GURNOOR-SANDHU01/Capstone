/**
 * Drop-in replacement for src/config/firebase/firestore.js in tests:
 *   jest.mock('../src/config/firebase/firestore', () => require('./mocks/firestoreModuleMock'));
 */
const { mockDb, mockTimestamp } = require('./firebaseAdminMock');
const { COLLECTIONS } = require('../../src/config/firebase/collections');

module.exports = {
  db: mockDb,
  Timestamp: mockTimestamp,
  FieldValue: {
    serverTimestamp: () => mockTimestamp.now(),
    delete: () => undefined
  },
  COLLECTIONS
};
