require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");

const app = express();
const passport = require("passport");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const { verifyUser, signJwt } = require("./middleware/auth");
const uploadVideoRoute = require("./controllers/pitchVideoController");

const API_PORT = process.env.API_PORT || 3000;
const BASE_URL = "/api";

// Handle CORS
const cors = require("cors");


app.use(
  cors({
    origin: `${process.env.BASE_URL}:${process.env.FRONTEND_PORT}`,
  })
);


// Set up Express to listen on API_PORT
app.listen(API_PORT, () => {
  console.log(`Listening on port ${API_PORT}`);
});

// Connect to MongoDB using Mongoose

mongoose.connect(process.env.MONGO_URI).then((db) => {
  const User = require("./models/User")(db);
  const Joblisting = require("./models/Joblisting")(db);
  const JobseekerProfile = require("./models/JobseekerProfile")(db);
  const Pitch = require("./models/Pitch")(db);
  const Application = require('./models/Application')(db);
  const RecruiterProfile = require("./models/RecruiterProfile")(db);

  app.get(`${BASE_URL}`, (req, res) => {
    res.send("EasyApply API");
  });

  // Setup body-parser middleware
  app.use(
    bodyParser.urlencoded({
      extended: true,
      parameterLimit: 100000000,
      limit: "50mb",
    })
  );
  app.use(bodyParser.json({ limit: "50mb", parameterLimit: 100000000 }));

  // Initialize passport
  app.use(passport.initialize());

  // Initialize passport strategies
  require("./middleware/localStrategy")(User, passport);
  require("./middleware/googleStrategy")(User, passport);

  // Setup Router
  app.use(`${BASE_URL}`, router);

  // Verify JWT endpoint
  router.get(`/user/verify_header`, verifyUser, (req, res, next) => {
    const decoded = res.locals.authData;
    res.status(200).json({ status: "Authorized", data: decoded });
  });
  router.post(`/jobs/apply`, (req, res) => {
		
		 const {  listing_id,
          firstName,
          lastName,
          email,
          city,
          province,
          zip} = req.body;
		  const app = new Application({_id: new mongoose.Types.ObjectId().toHexString(), listing_id, firstName, lastName, email, city, province, zip}, { collection: "application" });
		  //change _id later 
	 try {
         app.save();
        res.status(201).json(app);
    } catch (error) {
        res.status(409).json({ message: error.message });
    }
 
  
	console.log(req)
		
	});

  // Google OAuth2 endpoint callback
  router.get(`/user/auth/google_callback`, (req, res, next) => {
    passport.authenticate(
      "google-login",
      { session: false },
      (err, user, info) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          res.redirect(
            `${process.env.BASE_URL}:${process.env.FRONTEND_PORT}/signin`
          );
        } else {
          const token = signJwt(user);
          const returnData = Buffer.from(
            JSON.stringify({
              token: token,
              authData: jwt.decode(token, { json: true, complete: true }),
            })
          ).toString("base64");
          res.redirect(
            `${process.env.BASE_URL}:${process.env.FRONTEND_PORT}/signin/callback/?d=${returnData}`
          );
        }
      }
    )(req, res, next);
  });

  router.get(
    `/user/auth/google`,
    passport.authenticate("google-login", {
      scope: ["email", "profile"],
    })
  );

  // Login route with Passport
  router.post(`/user/authenticate`, (req, res, next) => {
    passport.authenticate("local-signin", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({
          message: "Login failed.",
        });
      }
      const token = signJwt(user);

      return res.status(200).json({
        message: "Login successful",
        token: token,
        authData: jwt.decode(token, { json: true, complete: true }),
      });
    })(req, res, next);
  });

  router.post(`/user/create`, (req, res, next) => {
    passport.authenticate("local-signup", (err, user, info) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(409).json({
          message: info.message,
        });
      }
      return res.status(200).json({
        message: "Registration successful",
      });
    })(req, res, next);
  });

  router.delete(`/user/delete`, verifyUser, (req, res, next) => {
    User.findById(res.locals.authData.id, (err, user) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(404).json({
          message:
            "User not found. This probably means the user has already been deleted.",
        });
      }

      user.remove((err) => {
        if (err) {
          return next(err);
        }
      });

      return res.status(200).json({
        message: "User deleted",
      });
    });
  });

	router.get(`/joblistings/:id`, (req, res) => {
		Joblisting.find({listing_id:req.params.id}).then(ret => {
			res.json(ret);
		});
	});
	router.get(`/joblistings`, (req, res) => {
		Joblisting.find().then(ret => {
			res.json(ret);
		});
	});

	router.get(`/jobseekerprofile/`, (req, res) => {
		const authEmail = req.query.email || "";
		JobseekerProfile.find({email : authEmail}).then(ret => {
			res.json(ret);
		})});

  /**
   * @api {get} /api/pitch/get Get the user's pitch video, if it exists
   */
  router.get("/pitch/get", [verifyUser], (req, res) => {
    const uid = res.locals.authData.id;
    Pitch.findOne({ userId: uid }).then((pitch) => {
      if (pitch) {
        res.json(pitch);
      } else {
        res.status(404).json({ success: false, message: "No pitch found" });
      }
    });
  });

  /**
   * @api {post} /api/pitch/getUnprocessed Get all unprocessed pitches
   */
  router.get("/pitch/getUnprocessed", (req, res) => {
    if (
      "authorization" in req.headers &&
      req.headers["authorization"] === "Bearer " + process.env.ADMIN_TOKEN
    ) {
      Pitch.find({ processingStatus: 1 }).then((pitches) => {
        if (pitches) {
          res.json({
            success: true,
            pitches: pitches,
          });
        } else {
          res.status(404).json({ success: false, message: "No pitches found" });
        }
      });
    } else {
      res.status(401).json({ success: false, message: "Unauthorized" });
    }
  });

  /**
   * @api {post} /api/pitch/process Update the processed status of a pitch
   */
  router.post("/pitch/process", (req, res) => {
    if (
      "authorization" in req.headers &&
      req.headers["authorization"] === "Bearer " + process.env.ADMIN_TOKEN
    ) {
      const pitchId = req.body.pitchId;
      const processed = req.body.processed || 1;
      const transcription = req.body.transcription || "";
      Pitch.findOneAndUpdate(
        { _id: pitchId },
        { processingStatus: processed, transcription: transcription }
      ).then((pitch) => {
        if (pitch) {
          res.json({
            success: true,
            pitch,
          });
        } else {
          res.status(404).json({ success: false, message: "No pitch found" });
        }
      });
    } else {
      res.status(401).json({ success: false, message: "Unauthorized" });
    }
  });

  uploadVideoRoute(router, Pitch);

  /**
   * @api {post} /api/updateprofilesummary Update user summary
   */
  router.post(`/updateprofilesummary`, (req, res) => {
    JobseekerProfile.updateOne(
      { email: req.body.email || "" },
      { summary: req.body.summary }
    ).then((ret) => {
      res.json(ret);
    });
  });

  /**
   * @api {post} /api/updateprofileskills Update user skills
   */
  router.post(`/updateprofileskills`, (req, res) => {
    JobseekerProfile.updateOne(
      { email: req.body.email || "" },
      { skills: req.body.skills }
    ).then((ret) => {
      res.json(ret);
    });
  });

  /**
   * @api {post} /api/updateworkexperiences Update user work experiences
   */
  router.post(`/updateworkexperiences`, (req, res) => {
    JobseekerProfile.updateOne(
      { email: req.body.email || "" },
      { workExperience: req.body.workExperience }
    ).then((ret) => {
      res.json(ret);
    });
  });

  /**
   * @api {post} /api/updatecontactinformation Update user contact information
   */
  router.post(`/updatecontactinformation`, (req, res) => {
    JobseekerProfile.updateOne(
      { email: req.body.email || "" },
      {
        firstName: req.body.profile.firstName,
        lastName: req.body.profile.lastName,
        email: req.body.profile.email,
        address: req.body.profile.address,
        githubID: req.body.profile.github,
        facebookID: req.body.profile.facebook,
        resumeUrl: req.body.profile.resumeURL,
      }
    ).then((ret) => {
      res.json(ret);
    });
  });
});
