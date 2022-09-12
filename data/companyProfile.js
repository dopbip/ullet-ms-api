
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const companyProfileModel = new Schema({
  //user: { type: mongoose.Types.ObjectId, required: true },
  createdBy: { type: String, require: true },
  companyName: { type: String, required: true },
  contact: { type: String, required: true },
  address: { type: String, required: true },
  createdOn: { type: String, required: true },
  clientAdminLastName: { type: String, require: true},
  clientAdminFirstName: { type: String, require: true},
  parentAgency: { type: String, default: null},
  clientAdminEmail: { type: String, require: true},
  clientType: { type: String, require: true},
  modifiedBy: { type: String, default: null },
  modifiedOn: { type: String,default: null },
  status: { type: String, required: true, default: "active" },
});

module.exports = mongoose.model(
  'company-profile',
  companyProfileModel
);
