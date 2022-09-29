const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const systemUsersModel = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  phoneNumber: {type: String, require:true},
  createdBy: { type: String, required: true },
  createdOn: {type: String, require: true},
  otpState: {type: String, require:true},
  userState: {type: String, require:true},
  companyId: {type: String, require:true, default: null},
  companyName: {type: String, require:true, default: null}
});

module.exports = mongoose.model('sysusers', systemUsersModel);
