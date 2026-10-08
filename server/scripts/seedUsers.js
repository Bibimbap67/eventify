// Creates (or resets) one account for each role. Run from /server: npm run seed
// Safe to re-run: existing accounts with these emails get their password re-hashed
// and their role/status reset. This also repairs accounts added by hand in Compass
// with a plain-text password, which login would otherwise reject.
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed default accounts in production.");
  process.exit(1);
}

// Values in server/.env win. The fallbacks are for local development only.
const accounts = [
  {
    name: "Test Admin",
    email: process.env.SEED_ADMIN_EMAIL || "admin@eventify.com",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin@12345",
    role: "admin",
  },
  {
    name: "Test Manager",
    email: process.env.SEED_MANAGER_EMAIL || "manager@eventify.com",
    password: process.env.SEED_MANAGER_PASSWORD || "Manager@12345",
    role: "manager",
    managerId: "manager-1",
  },
  {
    name: "Test Student",
    email: process.env.SEED_STUDENT_EMAIL || "student@eventify.com",
    password: process.env.SEED_STUDENT_PASSWORD || "Student@12345",
    role: "user", // "user" is the attendee/student role the React app checks for
  },
];

async function run() {
  await connectDB();
  for (const account of accounts) {
    const email = account.email.toLowerCase();
    let user = await User.findOne({ email });
    const action = user ? "Reset" : "Created";
    if (!user) user = new User({ email });
    user.name = account.name;
    user.password = account.password; // hashed by the model before saving
    user.role = account.role;
    user.managerId = account.managerId || null;
    user.status = "active";
    await user.save();
    console.log(`${action} ${account.role.padEnd(7)} ${email}`);
  }
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
