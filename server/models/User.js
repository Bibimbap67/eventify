const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Stored as a bcrypt hash. Hidden from queries unless you call .select("+password").`
    password: { type: String, required: true, minlength: 6, select: false },
    // Only the server/seed script can set this. Public signup is always "user".
    role: { type: String, enum: ["user", "manager", "admin"], default: "user" },
    // Used by ManagerContext to scope events to one manager.
    managerId: { type: String, default: null },
    // "active" can sign in; "inactive" is blocked at login.
    status: { type: String, enum: ["active", "inactive"], default: "active", lowercase: true },
    // Profile details edited on the attendee Profile page.
    studentId: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    program: { type: String, default: "", trim: true },
    yearLevel: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    avatar: { type: String, default: "" },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id.toString(); // the React app expects `id`, not `_id`
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model("User", userSchema);
