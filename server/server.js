const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const userRoutes = require('./routes/userRoutes');
const app = express();
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect("mongodb://localhost:27017/test");
app.use("/api", userRoutes);

const { faker } = require("@faker-js/faker");

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});

// app.get("/api/tryserver", (req, res) => {
//     res.json({ message: "Test api" });
// });

// app.get("/api/showperson", (req, res ) => {
//     res.json ({
//         firstName: faker.name.firstName(),
//         lastName: faker.name.lastName(),
//         email: faker.internet.email()
//     })
// })

// app.get("/api/fiend", (req, res) => {
//     res.json({ fiend })
// })
