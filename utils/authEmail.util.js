import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";
import geoip from "geoip-lite";
import { UAParser } from "ua-parser-js";
import { fileURLToPath } from "url";

// Get the current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const email = process.env.EMAIL;
const EmailPassword = process.env.EMAIL_PASSWORD;
const From = process.env.FROM;

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: email,
    pass: EmailPassword,
  },
});

export async function sendLoginAlert({ to, name, ipAddress, userAgentHeader }) {
  // GeoIP Lookup
  const geo = geoip.lookup(ipAddress) || {};
  const location = {
    city: geo.city || "Unknown",
    region: geo.region || "Unknown",
    country: geo.country || "Unknown",
  };

  // Device Detection
  const parser = new UAParser(userAgentHeader);
  const ua = parser.getResult();
  const deviceInfo = `${ua.device.type || "Desktop"} - ${ua.browser.name} on ${
    ua.os.name
  }`;

  // Render EJS email template
  const templatePath = `${__dirname}/../views/emails/login.ejs`;

  const html = await ejs.renderFile(templatePath, {
    name,
    ip: ipAddress,
    userAgent: deviceInfo,
    location,
    date: new Date().toLocaleString(),
    year: new Date().getFullYear(),
  });

  // Send email
  await transporter.sendMail({
    from: From,
    to,
    subject: "New Login Alert",
    html,
  });
}
