const UserModel = require("../models/User");

const getUsers = (req, res) => {
    UserModel.find()
        .then(users => res.json(users))
        .catch(err => {
            console.log(err);
            res.status(500).json({ error: 'Internal server error' });
        });
}

module.exports = { getUsers }
