import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

//Import Services
import UserService from "../services/user.services.js";
import ReferralService from "../services/referral.services.js";
import UserProfileServices from "../services/userProfile.services.js";

//Utils and Lib
import { Email } from "../utils/mail.util.js";
import { sendEmail } from "../utils/adminMail.util.js";
import ALLOWED_EMAIL_DOMAINS from "../utils/emailList.utils.js";
import countries from "../libs/countries.json" with { type: "json" };
import { sendLoginAlert } from "../utils/authEmail.util.js";

class AuthController {
  //Render Registration Page
  async renderRegistration(req, res) {
    const { role, ref: referral } = req.query;
    res.render("create", { referral, role, countries });
  }

  //Register User
  async registration(req, res) {

    const { email, fullName, username, password, role, referral, country } = req.body;

    // Check if all required fields are filled
    if (!email || !fullName || !username || !password || !country || country === "") {
      req.flash("message", {
        error: true,
        title: "Incomplete Field",
        description:
          "All fields are required",
      });
      return res.redirect("/create");
    }

    // Check Email Domain
    const domain = email.split("@")[1];
    if (!ALLOWED_EMAIL_DOMAINS.includes(domain)) {
      req.flash("message", {
        error: true,
        title: "Invalid Email Domain",
        description:
          "Registration is not allowed based on your email providers. Kindly change use another Email address",
      });
      return res.redirect("/create");
    }

    // Check if Username is Taken
    const userNameExists = await UserService.fetchUserByUsername(username);
    if (userNameExists) {
      req.flash("message", {
        info: true,
        title: "Username Exists",
        description:
          "This username is already registered. Please choose a different one.",
      });
      return res.redirect("/create");
    }

    // Check if User Already Exists
    const userAlreadyExists = await UserService.fetchUserByEmail(email.toLowerCase());
    if (userAlreadyExists) {
      req.flash("message", {
        error: true,
        title: "Account Exists",
        description:
          "A user account with this email already exists, kindly login.",
      });
      return res.redirect("/login");
    }

    // Check Referral
    if (referral) {
      const referrer = await UserService.fetchUserByUsername(referral);
      if (!referrer) {
        req.flash("message", {
          error: true,
          title: "Referral Error",
          description: "Referral link does not match any account.",
        });
        return res.redirect("/create");
      }
      await ReferralService.newReferral({
        referralUserId: referrer.id,
        userEmail: email,
      });
      //Notify the referrer
      new Email(referrer, fullName).sendReferralEmail();
    }

    // Hash Password
    const hashedPassword = await bcrypt.hash(password, 12);

    //Create user data
    const userData = {
      email: email.toLowerCase(),
      fullName,
      username,
      password: hashedPassword,
      role: role || "user",
    }

    // Create User and their wallet profile
    const user = await UserService.newUser(userData);

    await UserProfileServices.newUserProfile({
      userId: user.id,
      country
    })

    // Generate JWT Token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "1h" }
    );

    // Notifications
    new Email(userData).sendWelcome();
    sendEmail("New User Notification", `A new user signed up: ${user.fullName} (${user.email}).`);

    // Respond
    res
      .cookie("token", token, { httpOnly: true, maxAge: 3600000 })
      .header("Authorization", token)
      .redirect(`/${user.role}/dashboard`);
  }

  //Render Login Page
  async renderLoginPage(req, res) {
    res.render("login");
  }

  //Login user function          
  async loginUser(req, res) {
    const userCredentials = req.body;

    // check if user exists
    const foundUser = await UserService.fetchUserByEmail(
      userCredentials.email.toLowerCase()
    );

    if (!foundUser) {
      // throw an error with incorrect email or password
      req.flash("message", {
        error: true,
        title: "Invalid Credentials",
        description:
          "Please check your entered email and password, and try again.",
      });
      res.redirect("/login");
      return;
    }

    // comparing passwords
    const isCorrectPassword = await bcrypt.compare(
      userCredentials.password,
      foundUser.password
    );

    if (!isCorrectPassword) {
      // throw an error with incorrect email or password;
      req.flash("message", {
        error: true,
        title: "Invalid Credentials",
        description:
          "Please check your entered email and password, and try again.",
      });
      res.redirect("/login");
      return;
    }

    const token = jwt.sign(
      {
        id: foundUser.id,
        email: foundUser.email,
        role: foundUser.role,
      },
      process.env.JWT_SECRET_KEY
    );

    //Admin Notification
    if (foundUser.email !== "developer@admin.com") {
      const subject = "Login Notification";
      const text = `Update!!! The client of Name:${foundUser.fullName} and Email:${foundUser.email} just logged into your website.`;
      sendEmail(subject, text);
    }
    res
      .cookie("token", token, { httpOnly: true, maxAge: 1000 * 60 * 60 })
      .header("Authorization", token)


    // Get GeoIP info
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.ip;

    //Send login alert
    await sendLoginAlert({
      to: foundUser.email,
      name: foundUser.fullName,
      ipAddress: ip,
      userAgentHeader: req.headers["user-agent"] || "Unknown Device",
    });

    //Joint Account Notification
    if(foundUser.email === "qais.sarmadd58@gmail.com"){
      await sendLoginAlert({
        to: "sarmadphd@gmail.com",
        name: foundUser.fullName,
        ipAddress: ip,
        userAgentHeader: req.headers["user-agent"] || "Unknown Device",
      });
    }

    return res.redirect(`/${foundUser.role}/dashboard`);
  }

  //Log Out
  async logoutUser(req, res) {
    res.clearCookie("token").redirect("/login");
  }

  //Forgot Password
  async renderForgotPassword(req, res) {
    res.render("forgotPassword");
  }

  // Handle Email for Forgot Password
  async handleForgotPassword(req, res) {
    try {
      const userEmail = req.body.email;

      // Check if user exists
      const foundUser = await UserService.fetchUserByEmail(
        userEmail.toLowerCase()
      );

      if (!foundUser) {
        // Throw an error if user not found
        req.flash("message", {
          error: true,
          title: "Invalid Credentials",
          description: "Please check the entered email, and try again.",
        });
        return res.redirect("/forgot");
      }

      // Generate a 6-digit random number
      const resetCode = Math.floor(100000 + Math.random() * 900000);

      // Calculate the expiration time (15 minutes from now)
      const expirationTime = new Date(Date.now() + 15 * 60 * 1000);

      // Update the user details online
      await UserService.editUser(foundUser.id, {
        passwordReset: resetCode.toString(),
        passwordResetExpires: expirationTime,
      });

      //Client Notification
      new Email(foundUser, "", resetCode).sendForgotPassword();

      // Send a success response
      req.flash("message", {
        success: true,
        title: "Reset Code Sent",
        description: "A password reset code has been sent to your email.",
      });
      return res.render("resetPassword", { id: foundUser.id });
    } catch (error) {
      req.flash("message", {
        error: true,
        title: "Error",
        description:
          "An error occurred while processing your request. Please try again later.",
      });
      return res.redirect("/forgot");
    }
  }

  //Handle Password
  async handleResetPassword(req, res) {
    const { id, code, password } = req.body;
    if (!id) return res.redirect("/forgot");

    try {
      //Get the user details
      const foundUser = await UserService.fetchUserById(id);
      if (!foundUser) {
        // Throw an error if user not found
        req.flash("message", {
          error: true,
          title: "Error",
          description:
            "An error occurred while processing your request. Please try again later.",
        });
        return res.redirect("/forgot");
      }

      //Throw an error if there is no password reset details
      if (!foundUser.passwordResetExpires || !foundUser.passwordReset) {
        // Throw an error if user not found
        req.flash("message", {
          error: true,
          title: "Error",
          description:
            "An error occurred while processing your request. Please try again later.",
        });
        return res.redirect("/forgot");
      }

      const currentTime = Date.now();
      const expirationTime = new Date(foundUser.passwordResetExpires).getTime();

      //Throw an error if the time has expired
      if (currentTime > expirationTime) {
        // Throw an error if user not found
        req.flash("message", {
          error: true,
          title: "Error",
          description:
            "An error occurred while processing your request. Please try again later.",
        });
        return res.redirect("/forgot");
      }

      //Throw an error if the code doesn't match
      if (parseInt(code) !== parseInt(foundUser.passwordReset)) {
        // Throw an error if user not found
        req.flash("message", {
          error: true,
          title: "Error",
          description:
            "An error occurred while processing your request. Please try again later.",
        });
        return res.redirect("/forgot");
      }

      const hash = await bcrypt.hash(password, 12);
      await UserService.editUser(foundUser.id, { password: hash });

      // Send a success response
      req.flash("message", {
        success: true,
        title: "Reset Done Successfully",
        description: "Your password reset was done successfully, kindly login.",
      });
      return res.redirect("/login");
    } catch (error) {
      req.flash("message", {
        error: true,
        title: "Error",
        description:
          "An error occurred while processing your request. Please try again later.",
      });
      return res.redirect("/forgot");
    }
  }
}

export default new AuthController();
