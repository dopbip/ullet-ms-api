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
const sysUser = require('./data/sysUser');
const InventoryItem = require('./data/InventoryItem');
const companyProfile = require('./data/companyProfile');
const companyUser = require('./data/companyUser');
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

    const user = await sysUser.findOne({
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
      const { password, bio, ...rest } = user;
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
  if (role !== 'admin' && role !== 'clientAccess' && role !== 'HRUser') {
    return res
      .status(401)
      .json({ message: 'Request not authorized' });
  }
  next();
};

const requireCompanyUserHR = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'companyUserHR') {
    return res
      .status(401)
      .json({ message: 'Request not authorized' });
  }
  next();
};
app.get('/api/dashboard-data', requireAuth, (req, res) =>
  res.json(dashboardData)
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
      console.log('!!!!!!!!!!')
      console.log(companies)
        res.status(200).json({ companies })
      }

    } catch (err) {
      console.log(err)
      return res.status(400).json({ error: err });
    }
  }
);

app.post('/api/updateCompanyProfile',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    let existingEmail = false;
    const { companyId } = req.body;
    const { companyName, contact, email, town, address } = req.body
    const companyProfileUpdate = {}
    console.log(req.body)
    if (companyName !== '') {
      companyProfileUpdate.companyName = companyName
    } if(contact !==''){
      companyProfileUpdate.contact = contact
    } if(email !==''){
        const isEmail = await companyProfile.findOne({
        email: email.toLowerCase()
        });
        if(isEmail) {
          existingEmail = true;
        }
      companyProfileUpdate.email = email
    } if(town !==''){
      companyProfileUpdate.town = town
    } if(address !== ''){
      companyProfileUpdate.address = address
    }
    console.log(companyProfileUpdate)
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
      const userId = req.user.sub;
      const { 
        firstName, 
        lastName, 
        email, 
        phoneNumber,
        Nrc,
        employerId,
        employerName 
        } = req.body
        
      const existingEmail = await companyUser.findOne({
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
          Nrc,
          employerId,
          employerName,
          createdOn: dayjs().format("DD/MM/YYYY"),
          createdBy : userId,
          password: hashedtOtp,
          otpState:1,
          status: 'pending',
        };
        
        const newUserClient = new companyUser(userClientData);
        const saveUserClient = await newUserClient.save();

        if (saveUserClient) {
          sendEmail(email, 'OTP', `The OTP is ${otp}, Please login and update by creating a new PIN. Get Youllet app here ${'https://drive.google.com/file/d/1kYh3FIyG0zz1r8enY6cMlweQkrFKH8kO/view?usp=sharing'}`)
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
    console.log(req.body)
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
    console.log(companyUserProfileUpdate)
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
    console.log(req.body)
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
app.post('/api/getCompanyProfile',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    try {
      const {companyId} = req.body;
      console.log(companyId)
      const companyProfileArray = await companyProfile.find({ _id: companyId });
      //console.log(companyProfileArray)
      res.json({companyProfileArray});
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }
);

app.post('/api/getCountCompanyHasNoHR',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    try {
      if (_.has(req.body, 'createdBy')) {
        const {createdBy} = req.body;
        const companyProfileArray = await companyProfile.find({ hasHRUser: false }, {createdBy: createdBy});
        const arrCount = companyProfileArray.length
        res.json({arrCount});
      } 
      else {
        console.log('**************')
        console.log('getCountCompanyHasNoHR')
        const companyProfileArray = await companyProfile.find({ hasHRUser: false });
        const arrCount = companyProfileArray.length
        res.json({arrCount});
      }
      
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }
);

app.post('/api/allcompaniesHR',
  requireAuth,
  requireAdminOrClientAccess,
  async (req, res) => {
    try {
      if (_.has(req.body, 'createdBy')) {
        const {createdBy} = req.body
        const companyWithoutHRArray = await companyProfile.find({createdBy: createdBy,hasHRUser: false}).lean().select('_id companyName ');
        const companyWithHRArray = await sysUser
          .find({ role: "HRUser" }, { createdBy: createdBy })
          .lean()
          .select(
            "_id firstName lastName companyId companyName userState phoneNumber email createdOn"
          );
        const companiesWithoutHR = companyWithoutHRArray.reverse();
        const companiesWithHR = companyWithHRArray.reverse();
        const companies = [...companiesWithoutHR, ...companiesWithHR];
        console.log('00000000')
        console.log(companies)
        res.status(200).json({ companies })

      } else { 
        const companyWithoutHRArray = await companyProfile.find({hasHRUser: false}).lean().select('_id companyName ');
        const companyWithHRArray = await sysUser.find({role: 'HRUser'}).lean().select('_id firstName lastName companyId companyName userState phoneNumber email createdOn');
        const companiesWithoutHR = companyWithoutHRArray.reverse();
        const companiesWithHR = companyWithHRArray.reverse();
        const companies = [...companiesWithoutHR, ...companiesWithHR];
        console.log('00000000');
        console.log(companies);
        res.status(200).json({ companies });
      }

    } catch (err) {
      console.log(err)
      return res.status(400).json({ error: err });
    }
  }
);

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
      const existingEmail = await sysUser.findOne({
        email: HRUserData.email
      }).lean();

      if(existingEmail) {
        return res.status(400)
        .json({ message: 'Email already exists' });
      }

      const newSysUser = new sysUser(HRUserData);
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
  console.log('editHRUder++++++')  
  console.log(req.body)
    try {
      const { HRUserId } = req.body;
      if(_.has(req.body, 'createdBy')){
        const {createdBy} = req.body
        const companyHRUserProfileArray = await sysUser.find({_id: HRUserId}, {createdBy: createdBy}).lean().select('_id firstName lastName  phoneNumber email');
        return res.status(200).json({companyHRUserProfileArray});
     
      } else {
        const companyHRUserProfileArray = await sysUser.find({_id: HRUserId}).lean().select('_id firstName lastName  phoneNumber email');
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
    const { sysUserId } = req.body;
    const { firstName, lastName, email, phoneNumber } = req.body
    const companyHRUserProfileUpdate = {}
    console.log(req.body)
    if (firstName !== '') {
      companyHRUserProfileUpdate.firstName = firstName
    } if(lastName !==''){
      companyHRUserProfileUpdate.lastName = lastName
    } if(email !==''){
      const isEmail = await sysUser.findOne({
          email: email.toLowerCase()
        });
        if(isEmail) {
          existingEmail = true;
        }
      companyHRUserProfileUpdate.email = email
    } if(phoneNumber !==''){
      companyHRUserProfileUpdate.phoneNumber = phoneNumber
    }
    console.log(companyHRUserProfileUpdate)
    try {
        if(existingEmail) {
          return res.status(403).json({ message: 'Email already exists' });
        }
          await sysUser.findOneAndUpdate(
          {_id: sysUserId},         
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

app.post('/api/addSysUser', 
  //requireAuth,
  //requireAdmin,
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
        // console.log('@@@@ OTP @@@@')
        // console.log(otp)
        const hashedtOtp = await hashPassword(otp)
        const sysUserData = {
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
      const existingEmail = await sysUser.findOne({
        email: sysUserData.email
      }).lean();

      if(existingEmail) {
        return res.status(400)
        .json({ message: 'Email already exists' });
      }

      const newSysUser = new sysUser(sysUserData);
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

app.post('/api/getSystemUsers',requireAuth, requireAdmin, async(req, res) => {

    const { userId } = req.body
    console.log(userId) 
    try {
      const sysUserArray = await sysUser.find({_id: { $ne: userId }}).lean().select('_id firstName lastName role userState createdBy createdOn phoneNumber email');
      const SystemUsers = sysUserArray.reverse()
        return res.status(200).json({SystemUsers});
     
    } catch (err) {
      console.log(err)
      return res.json({message:'There was a problem getting users list'});
    }
  })

  app.post('/api/getSystemUserProfile',requireAuth, requireAdmin, async(req, res) => {
    console.log(req.body)
    try {
      const { sysUserId } = req.body;
      //console.log(res)
      const sysUserProfileArray = await sysUser.find({_id: sysUserId}).lean().select('_id firstName lastName  phoneNumber email');
        return res.status(200).json({sysUserProfileArray});
     
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
    const { sysUserId } = req.body;
    const { firstName, lastName, email, phoneNumber } = req.body
    const sysUserProfileUpdate = {}
    console.log(req.body)
    if (firstName !== '') {
      sysUserProfileUpdate.firstName = firstName
    } if(lastName !==''){
      sysUserProfileUpdate.lastName = lastName
    } if(email !==''){
      const isEmail = await sysUser.findOne({
          email: email.toLowerCase()
        });
        if(isEmail) {
          existingEmail = true;
        }
      sysUserProfileUpdate.email = email
    } if(phoneNumber !==''){
      sysUserProfileUpdate.phoneNumber = phoneNumber
    }
    console.log(sysUserProfileUpdate)
    try {
        if(existingEmail) {
          return res.status(300).json({ message: 'Email already exists' });
        }
          await sysUser.findOneAndUpdate(
          {_id: sysUserId},         
           sysUserProfileUpdate,
           {new: true}  
        );
        res.status(200).json({ message: 'Updated Successfully' })

    } catch (err) {
      console.log(err)
      return res.json({ error: err });
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
      console.log(companyId)
      const { role } = req.body;
      console.log(role)
      if (role === 'HRUser') {
        const companyUsersArray = await companyUser.find({
          employerId: companyId
          }).lean().select('firstName lastName email phoneNumber Nrc createdOn status ');
        const companyUsers = companyUsersArray.reverse();
        res.json({ companyUsers })
      } else if (role === 'clientAccess'){    
        const companyUsersArray = await companyUser.find({
        employerId: companyId
          }).lean().select('firstName lastName email phoneNumber Nrc createdBy status createdOn otpState');
        const companyUsers = companyUsersArray.reverse();
        console.log('UUUUUUUUUU')
        console.log(companyUsers)
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
