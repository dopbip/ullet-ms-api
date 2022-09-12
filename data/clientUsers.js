const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const clientUsersModel = new Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, required: true },
  parentAgency: { type: String, required: true, default: '' },
  contact: {type: String, require:true},
  createdBy: { type: String, required: true },
  createdOn: {type: String, require: true},
  otpState: {type: String, require:true},
  userState: {type: String, require:true},
  companyId: {type: String, require:true, default: ''},
  companyName: {type: String, require:true, default: ''}
});

module.exports = mongoose.model('clientUsers', clientUsersModel);
