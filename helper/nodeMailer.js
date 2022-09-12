"use strict";
const nodemailer = require("nodemailer");

const sendEmail = (recipientEmail, emailSubject, emailContent) => {

    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'dopbipdev@gmail.com',
            pass: '?J35u151h4'
            }
    });

    let mailOptions = {
        from: 'dopbipdev@gmail.com',
        to: recipientEmail,
        subject: emailSubject,
        text: emailContent
    };

    transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.log(error);
    } else {
        console.log('Email sent: ' + info.response);
    }
    });
}

module.exports = sendEmail