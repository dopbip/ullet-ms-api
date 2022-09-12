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


app.get('/api/p', async(req, res) => {
  console.log('UrlId:', req.query.surlid)
  const urlId = req.query.surlid
 try {
    const clientSurveydetails = await clientSurvey.findOne({
    urlId: urlId
  })
    if(clientSurveydetails) {
      const todayDate = dayjs().format('DD/MM/YYYY')
      const surveyEndDate = clientSurveydetails.surveyToDate
      const surveyType = clientSurveydetails.surveyType
      const companyName = clientSurveydetails.companyName

      if(dayjs(todayDate).diff(surveyEndDate) == 0 || dayjs(todayDate).diff(surveyEndDate) < 0 ) {
        res.json({})
      } else {
        try {
          const surveyModel = await surveyTemplate.findOne({ type: surveyType})
          const surveyObj = Object.assign(surveyModel, {clientName:companyName})
          console.log(surveyObj)
          res.json(surveyObj)
        } catch (error) {
          console.log(error)
        }
      }
    } else {
      res.json({})
    }
  
 } catch (error) {
   console.log(error)
 }
})

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
  secret: process.env.JWT_SECRET,
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

const requireCorporateOrAgency = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'corporate' || role !== 'agency') {
    return res
      .status(401)
      .json({ message: 'Request not authorized' });
  }
  next();
};

app.get('/api/dashboard-data', requireAuth, (req, res) =>{
  //console.log("dashboardData",dashboardData)
  res.json(dashboardData)
}
);

// app.patch('/api/user-role', async (req, res) => {
//   try {
//     const { role } = req.body;
//     const allowedRoles = ['user', 'admin'];

//     if (!allowedRoles.includes(role)) {
//       return res
//         .status(400)
//         .json({ message: 'Role not allowed' });
//     }
//     await User.findOneAndUpdate(
//       { _id: req.user.sub },
//       { role }
//     );
//     res.json({
//       message:
//         'User role updated. You must log in again for the changes to take effect.'
//     });
//   } catch (err) {
//     return res.status(400).json({ error: err });
//   }
// });


app.post('/api/allcompanies',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    try {
      if (_.has(req.body, 'createdBy')) {
        const {createdBy} = req.body
        const companyArray = await companyProfile.find({createdBy: createdBy});
        const companies = companyArray.reverse()
        res.status(200).json({ companies })

      } else { 
      const companyArray = await companyProfile.find();
      const companies = companyArray.reverse()
      // console.log('!!!!!!!!!!')
      // console.log(companies)
        res.status(200).json({ companies })
      }

    } catch (err) {
      console.log(err)
      return res.status(400).json({ error: err });
    }
  }
);

app.post('/api/getSurveyDetails',
  requireAuth,
  requireAllUserType,
  async (req, res) => {
    console.log('<=::::::::=>')
    let clientSurveydetails
    if (_.has(req.body, 'agentId')) {
      const { agentId } = req.body
      clientSurveydetails = await clientSurvey.find({
        agentId: agentId
      })
    } else if(_.has(req.body, 'companyId')) {
      const { companyId } = req.body
      console.log('companyId:', companyId)
      clientSurveydetails = await clientSurvey.find({
        companyId: companyId
      })
    } else {
      clientSurveydetails = await clientSurvey.find({})
    }
   try { 
      const todayDate = dayjs().format('DD/MM/YYYY')
      const surveyEndDate = clientSurveydetails.surveyToDate
      if(dayjs(todayDate).diff(surveyEndDate) == 0) {
        console.log('No valid Link')
        res.json({})
      } else {
        try {
          console.log(clientSurveydetails)
          res.json(clientSurveydetails)
        } catch (error) {
          console.log(error)
        }
      }
    
   } catch (error) {
     console.log(error)
   }
  }
);

app.post('/api/updateCompanyProfile',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    let existingEmail = false;
    const modifiedOn = dayjs().format("DD/MM/YYYY")
    const { companyId } = req.body;
    const { companyName, contact, exporterEmail, type, address, modifiedBy } = req.body
    const companyProfileUpdate = {}
    companyProfileUpdate.modifiedBy = modifiedBy
    companyProfileUpdate.modifiedOn = modifiedOn
    //console.log(req.body)
    if (companyName !== '') {
      companyProfileUpdate.companyName = companyName
    } if(contact !== ''){
      companyProfileUpdate.contact = contact
    } if(exporterEmail !== ''){
        const isEmail = await companyProfile.findOne({
          exporterEmail: exporterEmail.toLowerCase()
        });
        if(isEmail) {
          existingEmail = true;
        }
      companyProfileUpdate.exporterEmail = exporterEmail
    } if(type !== ''){
      companyProfileUpdate.clientType = type
    } if(address !== ''){
      companyProfileUpdate.address = address
    }
    //console.log(companyProfileUpdate)
    try {
        if(existingEmail) {
          return res.status(300).json({ message: 'Email already exists' });
        }
          await companyProfile.findOneAndUpdate(
          {_id: companyId},         
           companyProfileUpdate,
           {new: true}  
        );
        res.status(200).json({ message: 'Updated Successfully' })

    } catch (err) {
      console.log(err)
      return res.status(400).json({ error: err });
    }
  }
);

app.post('/api/addCompanyUser',
  requireAuth,
  requireAdminOrClientAccess,
  async(req, res) => {
    try {
      
      const { 
        firstName, 
        lastName, 
        email, 
        phoneNumber,
        companyId,
        companyName,
        createdBy,
        role
        } = req.body
        
      const existingEmail = await systemUsers.findOne({
      email: email
      }).lean();

      if(existingEmail) {
        return res.status(300)
        .json({ message: 'Email already exists' });
      } else {
        const otp = randomstring.generate(
          {
            length:5, 
            charset:'alphabetic'
          });
        
        const hashedtOtp = await hashPassword(otp)
        const userClientData = {
          firstName,
          lastName,
          email: email.toLowerCase(),
          phoneNumber,
          companyId,
          companyName,
          createdOn: dayjs().format("DD/MM/YYYY"),
          createdBy,
          role,
          password: hashedtOtp,
          otpState:1,
          userState: 'active',
        };
        
        const newUserClient = new systemUsers(userClientData);
        const saveUserClient = await newUserClient.save();

        if (saveUserClient) {
          sendEmail(email, 'OTP', `The OTP is ${otp}, Please login and update by creating a new password.\n\nBipData Team'}`)
          return res.json({
            message: 'Client Created successfully'
          }) 
      }
      }

    } catch (error) {
      console.log(error)
      return res.status(400).json({
        message: 'There was a problem creating your account'
      })
    }

  })

  app.post('/api/updateCompanyUserProfile',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    let existingEmail = false;
    const { companyUserId } = req.body;
    const { firstName, lastName, email, phoneNumber, Nrc } = req.body
    const companyUserProfileUpdate = {}
    //console.log(req.body)
    if (firstName !== '') {
      companyUserProfileUpdate.firstName = firstName
    } if(lastName !==''){
      companyUserProfileUpdate.lastName = lastName
    } if(email !==''){
      const isEmail = await companyUser.findOne({
          email: email.toLowerCase()
        });
        if(isEmail) {
          existingEmail = true;
        }
      companyUserProfileUpdate.email = email
    } if(phoneNumber !==''){
      companyUserProfileUpdate.phoneNumber = phoneNumber
    } if(Nrc !== ''){
      companyUserProfileUpdate.Nrc = Nrc
    }
    //console.log(companyUserProfileUpdate)
    try {
        if(existingEmail) {
          return res.status(300).json({ message: 'Email already exists' });
        }
          await companyUser.findOneAndUpdate(
          {_id: companyUserId},         
           companyUserProfileUpdate,
           {new: true}  
        );
        res.status(200).json({ message: 'Updated Successfully' })

    } catch (err) {
      console.log(err)
      return res.json({ error: err });
    }
  }
);

app.post('/api/getCompanyUserProfile',requireAuth, requireAdminOrClientAccess, async(req, res) => {
    //console.log(req.body)
    try {
      const { companyUserId } = req.body;
      //console.log(res)
      const companyUserProfileArray = await companyUser.find({_id: companyUserId}).lean().select('_id firstName lastName employerName employerId Nrc phoneNumber email');
        return res.status(200).json({companyUserProfileArray});
     
    } catch (err) {
      console.log(err)
      return res.json({message:'There was a problem geting profile detail'});
    }
  })

app.post('/api/addCompany',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    
    try {
      let parentAgency = null
      const {
        companyName,
        clientType
      } = req.body

      let isCompanyNameExist = await companyProfile.findOne({
        companyName: companyName
      }).lean();

      if (isCompanyNameExist) {
        return res.status(300)
        .json({ message: 'Company already exists' });
      }
      if (clientType == 'agency') {
         parentAgency = clientType
      }
      const input = await Object.assign({}, req.body, 
        {
          createdOn: dayjs().format("DD/MM/YYYY")
        },
        {
          parentAgency: parentAgency
        }
      );        
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

app.post('/api/getCompanyProfile',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    try {
      const {companyId} = req.body;
      //console.log(companyId)
      const companyProfileArray = await companyProfile.find({ _id: companyId });
      //console.log(companyProfileArray)
      res.json({companyProfileArray});
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }
);

app.post('/api/addSysUser', 
  requireAuth,
  requireAdmin,
  async(req, res) => {
    try {
      const { 
        firstName, 
        lastName, 
        email, 
        phoneNumber,
        createdBy, 
        role } = req.body
        
        const otp = randomstring.generate(
          {
            length:5, 
            charset:'alphabetic'
          })
         console.log('@@@@ OTP @@@@')
         console.log(otp)
        const hashedtOtp = await hashPassword(otp)
        const systemUsersData = {
          firstName,
          lastName,
          email: email.toLowerCase(),
          phoneNumber,
          createdOn: dayjs().format("DD/MM/YYYY"),
          createdBy,
          role,
          password: hashedtOtp,
          otpState:1,
          userState: 'active'
        };
      const existingEmail = await systemUsers.findOne({
        email: systemUsersData.email
      }).lean();

      if(existingEmail) {
        return res.status(400)
        .json({ message: 'Email already exists' });
      }

      const newSysUser = new systemUsers(systemUsersData);
      const saveUserAuth = await newSysUser.save();

      if (saveUserAuth) {
        sendEmail(email, 'OTP', `The OTP is ${otp}, Please login and update by creating a new password`)
        return res.json({
          message: 'User Created successfully'
        }) 
      }
    } catch (error) {
      console.log(error)
      return res.status(400).json({
        message: 'There was a problem creating your account'
      })
    }

  })

app.post('/api/addHRUser', 
  requireAuth,
  requireAdminOrClientAccess,
  async(req, res) => {
    try {
      const { 
        companyId,
        companyName,
        firstName, 
        lastName, 
        email, 
        phoneNumber,
        createdBy, 
        role } = req.body
        
        const otp = randomstring.generate(
          {
            length:5, 
            charset:'alphabetic'
          })
        console.log('@@@@ OTP @@@@')
        console.log(otp)
        const hashedtOtp = await hashPassword(otp)
        const HRUserData = {
          firstName,
          lastName,
          email: email.toLowerCase(),
          phoneNumber,
          createdOn: dayjs().format("DD/MM/YYYY"),
          createdBy,
          role,
          password: hashedtOtp,
          otpState:1,
          userState: 'active',
          companyId,
          companyName

        };
      const existingEmail = await systemUsers.findOne({
        email: HRUserData.email
      }).lean();

      if(existingEmail) {
        return res.status(400)
        .json({ message: 'Email already exists' });
      }

      const newSysUser = new systemUsers(HRUserData);
      const saveUserAuth = await newSysUser.save();

      if (saveUserAuth) {
        await companyProfile.findOneAndUpdate(
            {_id: companyId },
            { hasHRUser: true,},
            {new: true}  
           );
        return res.json({
          message: 'HR User Created successfully'
        }) 
      }
    } catch (error) {
      console.log(error)
      return res.status(400).json({
        message: 'There was a problem creating your account'
      })
    }

  })

app.post('/api/getCompanyHRUserProfile',requireAuth, requireAdminOrClientAccess, async(req, res) => {
  // console.log('editHRUder++++++')  
  // console.log(req.body)
    try {
      const { HRUserId } = req.body;
      if(_.has(req.body, 'createdBy')){
        const {createdBy} = req.body
        const companyHRUserProfileArray = await systemUsers.find({_id: HRUserId}, {createdBy: createdBy}).lean().select('_id firstName lastName  phoneNumber email');
        return res.status(200).json({companyHRUserProfileArray});
     
      } else {
        const companyHRUserProfileArray = await systemUsers.find({_id: HRUserId}).lean().select('_id firstName lastName  phoneNumber email');
        return res.status(200).json({companyHRUserProfileArray});
      }
      
     
    } catch (err) {
      console.log(err)
      return res.json({message:'There was a problem geting profile detail'});
    }
  })

app.post('/api/updateCompanyHRUserProfile',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    let existingEmail = false;
    const { systemUsersId } = req.body;
    const { firstName, lastName, email, phoneNumber } = req.body
    const companyHRUserProfileUpdate = {}
    //console.log(req.body)
    if (firstName !== '') {
      companyHRUserProfileUpdate.firstName = firstName
    } if(lastName !==''){
      companyHRUserProfileUpdate.lastName = lastName
    } if(email !==''){
      const isEmail = await systemUsers.findOne({
          email: email.toLowerCase()
        });
        if(isEmail) {
          existingEmail = true;
        }
      companyHRUserProfileUpdate.email = email
    } if(phoneNumber !==''){
      companyHRUserProfileUpdate.phoneNumber = phoneNumber
    }
    //console.log(companyHRUserProfileUpdate)
    try {
        if(existingEmail) {
          return res.status(403).json({ message: 'Email already exists' });
        }
          await systemUsers.findOneAndUpdate(
          {_id: systemUsersId},         
           companyHRUserProfileUpdate,
           {new: true}  
        );
        return res.json({ message: 'Updated Successfully' })

    } catch (err) {
      console.log(err)
      return res.json({ error: err });
    }
  }
);



app.post('/api/getSystemUsers',requireAuth, requireAdmin, async(req, res) => {

    const { userId } = req.body
    //console.log(userId) 
    try {
      const systemUsersArray = await systemUsers.find({_id: { $ne: userId }}).lean().select('_id firstName lastName role userState createdBy createdOn phoneNumber email');
      const SystemUsers = systemUsersArray.reverse()
        return res.status(200).json({SystemUsers});
     
    } catch (err) {
      console.log(err)
      return res.json({message:'There was a problem getting users list'});
    }
  })

  app.post('/api/getSystemUserProfile',requireAuth, requireAdmin, async(req, res) => {
    //console.log(req.body)
    try {
      const { systemUsersId } = req.body;
      //console.log(res)
      const systemUsersProfileArray = await systemUsers.find({_id: systemUsersId}).lean().select('_id firstName lastName  phoneNumber email');
        return res.status(200).json({systemUsersProfileArray});
     
    } catch (err) {
      console.log(err)
      return res.json({message:'There was a problem geting profile detail'});
    }
  })

app.post('/api/updateSysUserProfile',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    let existingEmail = false;
    const { systemUsersId } = req.body;
    const { firstName, lastName, email, phoneNumber } = req.body
    const systemUsersProfileUpdate = {}
    //console.log(req.body)
    if (firstName !== '') {
      systemUsersProfileUpdate.firstName = firstName
    } if(lastName !==''){
      systemUsersProfileUpdate.lastName = lastName
    } if(email !==''){
      const isEmail = await systemUsers.findOne({
          email: email.toLowerCase()
        });
        if(isEmail) {
          existingEmail = true;
        }
      systemUsersProfileUpdate.email = email
    } if(phoneNumber !==''){
      systemUsersProfileUpdate.phoneNumber = phoneNumber
    }
    //console.log(systemUsersProfileUpdate)
    try {
        if(existingEmail) {
          return res.status(300).json({ message: 'Email already exists' });
        }
          await systemUsers.findOneAndUpdate(
          {_id: systemUsersId},         
           systemUsersProfileUpdate,
           {new: true}  
        );
        res.status(200).json({ message: 'Updated Successfully' })

    } catch (err) {
      console.log(err)
      return res.json({ error: err });
    }
  }
);

app.post('/api/setSurvey',
  requireAuth, 
  requireAdminOrClientAccess,
  async(req, res) => {
    //TODO: Put url in .env
    try {
     
      console.log("surveyDetails", req.body)
      const urlId = randomstring.generate({ length:10, charset:'alphabetic'})
      const surveyDetails  = await Object.assign( req.body , {urlId: urlId})
      const newSurvey = new clientSurvey(surveyDetails)
      const addSurvey = await newSurvey.save()
      if (addSurvey) {
        //TODO: send email to the client after creating a survey
        //sendEmail(email, 'OTP', `The OTP is ${otp}, Please login and update by creating a new password.\n\nBipData Team'}`)
        res.json({message: "Survey Created Successfully"})
      }
      
      } catch (error) {
        console.log(error)
      }
    }
  );


app.delete(
  '/api/inventory/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const deletedItem = await InventoryItem.findOneAndDelete(
        { _id: req.params.id, user: req.user.sub }
      );
      res.status(201).json({
        message: 'Inventory item deleted!',
        deletedItem
      });
    } catch (err) {
      return res.status(400).json({
        message: 'There was a problem deleting the item.'
      });
    }
  }
);

// app.get('/api/users', requireAuth, async (req, res) => {
//   try {
//     const users = await User.find()
//       .lean()
//       .select('_id firstName lastName avatar bio');

//     res.json({
//       users
//     });
//   } catch (err) {
//     return res.status(400).json({
//       message: 'There was a problem getting the users'
//     });
//   }
// });

app.post(
  '/api/companyUsers', 
  requireAuth,
  requireAllUserType, 
  async(req, res) => {
    try {
      const { companyId } = req.body;
      //console.log(companyId)
      const { role } = req.body;
      //console.log(role)
      if (role === 'clientAccess') {
        const companyUsersArray = await companyUser.find({
          employerId: companyId
          }).lean().select('firstName lastName email phoneNumber createdOn status ');
        const companyUsers = companyUsersArray.reverse();
        res.json({ companyUsers })
      } else if (role === 'admin'){    
        const companyUsersArray = await companyUser.find({
        employerId: companyId
          }).lean().select('firstName lastName email phoneNumber createdBy status createdOn otpState');
        const companyUsers = companyUsersArray.reverse();
        // console.log('UUUUUUUUUU')
         //console.log(companyUsers)
        res.json({ companyUsers })
      } else {

      }
      
    } catch (err) {
      return res.status(400).json({
        message: 'There was a problem fetching company users'
      });
    }
  });

async function connect() {
  try {
    mongoose.Promise = global.Promise;
    await mongoose.connect(process.env.ATLAS_URL, {
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
