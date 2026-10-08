const express = require("express");
const { signup, login, me, updateMe, changePassword } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/me", protect, me);
router.patch("/me", protect, updateMe);
router.post("/password", protect, changePassword);

module.exports = router;
