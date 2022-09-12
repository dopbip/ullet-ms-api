const mongoose = require('mongoose')
const Schema = mongoose.Schema
const surveyTemplateModel = new Schema ({
    type: { type: String, required: true },
    questionaire: {type: Object, require: true}
});

module.exports = mongoose.model('surveys', surveyTemplateModel)