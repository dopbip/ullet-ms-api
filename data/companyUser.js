const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const companyUserModel = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, require: true },
  employerId: { type: String, require: true },
  employerName: { type: String, require: true },
  createdBy: { type: String, require: true },
  updatedBy: { type: String, require: false},
  createdOn: { type: String, require: false },
  updatedOn: {type: String, require: false},
  role: { type: String, required: false, default: 'client_user' },
  password: { type: String, required: false },
  otpState: { type: Number, required: false },
  status: { type: String, require: false },
  balance: { type: String, require: false, default: '0.00'},
  transactions: {  }
  
});

module.exports = mongoose.model('userClient', companyUserModel);
