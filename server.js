//TODO: Add functions for the repeative process [systemUser]
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('express-jwt');
const dayjs = require('dayjs');
const jwtDecode = require('jwt-decode');
const randomstring = require('randomstring');
const mongoose = require('mongoose');
const _ = require('lodash');

const dashboardData = require('./data/dashboard');
const systemUsers = require('./data/systemUsers');
const companyProfile = require('./data/companyProfile');
const companyUser = require('./data/companyUser');
const clientSurvey = require('./data/clientSurvey');
const surveyTemplate = require('./data/surveyTemplate')
const clientUsers = require('./data/clientUsers')
const sendEmail = require('./helper/nodeMailer');

const {
  createToken,
  hashPassword,
  verifyPassword
} = require('./util');

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());



app.post('/api/authenticate', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await systemUsers.findOne({
      email
    }).lean();
    if (!user) {
      return res.status(403).json({
        message: 'Wrong email or password.'
      });
    }

    const passwordValid = await verifyPassword(
      password,
      user.password
    );

    if (passwordValid) {
      const { password, bio, createdBy,createdOn, ...rest } = user;
      const userInfo = Object.assign({}, { ...rest });

      const token = createToken(userInfo);

      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;

      res.json({
        message: 'Authentication successful!',
        token,
        userInfo,
        expiresAt
      });
    } else {
      res.status(403).json({
        message: 'Wrong email or password.'
      });
    }
  } catch (err) {
    console.log(err);
    return res
      .status(400)
      .json({ message: 'Something went wrong.' });
  }
});

const attachUser = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .json({ message: 'Authentication invalid' });
  }
  const decodedToken = jwtDecode(token.slice(7));

  if (!decodedToken) {
    return res.status(401).json({
      message: 'There was a problem authorizing the request'
    });
  } else {
    req.user = decodedToken;
    next();
  }
};

app.use(attachUser);

const requireAuth = jwt({
  secret:  '?J35u151h4',//process.env.JWT_SECRET,
  audience: 'api.youllet.app',
  issuer: 'api.youllet.app'
});

const requireAdmin = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'admin') {
    return res
      .status(401)
      .json({ message: 'Request not authorized' });
  }
  next();
};

const requireClientAccess = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'clientAccess') {
    return res
      .status(401)
      .json({ message: 'Request not authorized' });
  }
  next();
};

const requireAdminOrClientAccess = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'admin' && role !== 'clientAccess') {
    return res
      .status(401)
      .json({ message: 'Request not authorized' });
  }
  next();
};

const requireAllUserType = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'admin' && role !== 'clientAccess' && role !== 'agency' && role !== 'corporate') {
    return res
      .status(401)
      .json({ message: 'Request not authorized' });
  }
  next();
};

app.post('/api/addCompany',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    //console.log(req)name
    
    try {
      const {companyName} = req.body
      let isCompanyNameExist = await companyProfile.findOne({
        companyName: companyName
      }).lean();

      if (isCompanyNameExist) {
        return res.status(300)
        .json({ message: 'Company already exists' });
      }
      const userId = req.user.sub;
      // const companyName = req.body

      const input = await Object.assign({}, req.body, {
        createdBy: userId }, {createdOn: dayjs().format("DD/MM/YYYY")}
        );
        
        console.log(input);
      const addCompanyProfile = new companyProfile(input);
      await addCompanyProfile.save();
      res.status(201).json({
        message: 'company profile created!',
        addCompanyProfile
      });
    } catch (err) {
      console.log(err)
      return res.status(400).json({
        message: 'There was a problem creating the company profile'
      });
    }
  }
);

async function connect() {
  try {
    mongoose.Promise = global.Promise;
    await mongoose.connect ( 'mongodb+srv://youllet_bd_user:6xYadcwYfuxaNzL3@cluster0.jy2dw.mongodb.net/youllet?retryWrites=true&w=majority',{//(process.env.ATLAS_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false
    });
  } catch (err) {
    console.log('Mongoose error', err);
  }
  app.listen(3001);
  console.log('API listening on localhost:3001');
}

connect();
