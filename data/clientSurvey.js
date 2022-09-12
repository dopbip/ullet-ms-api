const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const clientSurveyModel = new Schema({
    createdBy:{ type: String, require: true },
    companyName: { type: String, require: true },
    companyId: { type: String, require: true },
    surveyType: { type: String, require: true },
    surveyFromDate: {type: String, require: true},
    surveyToDate: {type: String, require: true},
    urlId: {type: String, require: true},
})

module.exports = mongoose.model('clientSurvey', clientSurveyModel);