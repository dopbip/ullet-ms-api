
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const companyProfileModel = new Schema({
  //user: { type: mongoose.Types.ObjectId, required: true },
  createdBy: { type: String, require: true },
  companyName: { type: String, required: true },
  contact: { type: String, required: true },
  email: { type: String, required: true },
  town: { type: String, required: true },
  address: { type: String, required: true },
  createdOn: { type: String, required: true },
  hasHRUser: { type: Boolean, require: true, default: false },
  HRUserId: { type: String, require: true, default: "" },
  HRUserFirstName: { type: String, require: true, default: "" },
  HRUserLastName: { type: String, require: true, default: "" },
  status: { type: String, required: true, default: "pending" },
});

module.exports = mongoose.model(
  'company-profile',
  companyProfileModel
);