const adminService = require('../services/adminService');
const { success } = require('../utils/apiResponse');

const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listUsers: wrap(async (req, res) => success(res, await adminService.listUsers(req.query))),
  setRole: wrap(async (req, res) => success(res, await adminService.setRole(req.user, req.params.uid, req.body.role))),
  updateDoctorProfile: wrap(async (req, res) =>
    success(res, await adminService.updateDoctorProfile(req.user, req.params.uid, req.body))
  ),
  addDoctor: wrap(async (req, res) => success(res, await adminService.addDoctorByEmail(req.user, req.body), 201)),
  stats: wrap(async (req, res) => success(res, await adminService.stats())),
  listAuditLogs: wrap(async (req, res) => success(res, await adminService.listAuditLogs(req.query.limit)))
};
