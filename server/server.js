// Event dates and times are typed in Philippine time. Hosts like Render run on UTC, which made
// check-in open 8 hours late, so the server reads every time as Manila time.
process.env.TZ = "Asia/Manila";
require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const dataRoutes = require("./routes/dataRoutes");
const ticketRoutes = require("./routes/ticketRoutes");
const adminRoutes = require("./routes/adminRoutes");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Add it to server/.env (see the README).");
  process.exit(1);
}

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "https://eventifys.vercel.app" }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api", dataRoutes);
app.use("/api", ticketRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found." }));

// Express 5 sends errors from async routes here. Errors meant for the user (`expose`, like a refused change or a broken JSON body) keep their status and message; anything else is a 500.
app.use((err, req, res, next) => {
  if (err.expose) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: "Internal server error." });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err.message);
    process.exit(1);
  });
