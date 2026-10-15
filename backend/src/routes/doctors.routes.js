const express = require('express');
const authenticate = require('../middleware/authenticate');
const userRepository = require('../repositories/userRepository');
const { ROLES } = require('../config/roles');
const { success } = require('../utils/apiResponse');

const router = express.Router();

router.use(authenticate);

/**
 * Doctor directory for patients choosing whom to share with / book.
 * Listed from the users.role mirror (written only by the backend), and exposes
 * display fields only. Consent itself is re-verified against Auth claims.
 */
router.get('/', async (req, res, next) => {
  try {
    const doctors = await userRepository.listByRole(ROLES.DOCTOR, 200);
    return success(
      res,
      doctors
        .filter((d) => (d.doctor_profile?.status || 'Active') !== 'Inactive')
        .map((d) => ({
          id: d.id,
          full_name: d.full_name || '',
          specialization: d.doctor_profile?.specialization || null,
          clinic_name: d.doctor_profile?.clinic_name || null,
          status: d.doctor_profile?.status || 'Active'
        }))
    );
  } catch (err) {
    next(err);
  }
});

module.exports = router;
