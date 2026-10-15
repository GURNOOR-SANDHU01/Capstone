const { Timestamp, FieldValue } = require('firebase-admin/firestore');
const { db } = require('./admin');
const { COLLECTIONS } = require('./collections');

module.exports = {
  db,
  Timestamp,
  FieldValue,
  COLLECTIONS
};
