# Eventify

Event management system project. A React app (this folder) talks to an Express + MongoDB
server (`server/`). See `SYSTEM_FLOW.md` for how the parts work together.

**Target client:** National University - Mall of Asia (NU MOA). Eventify runs events for the
whole campus: every college, the Student Council and offices such as Career Services.

## Clone the Repository

```bash
git clone https://github.com/Bibimbap67/eventify.git
cd eventify
```

## Install Dependencies

```bash
npm install
npm --prefix server install
```

## Set Up the Server

You need MongoDB, either installed locally or a free MongoDB Atlas database.

1. Create `server/.env` with at least these two lines:

   ```text
   MONGODB_URI=mongodb://127.0.0.1:27017/eventify
   JWT_SECRET=any-long-random-text
   ```

   Optional: `PORT` (default 5000), `CLIENT_URL` (default https://eventifys.vercel.app; set it to http://localhost:3000 locally),
   `JWT_EXPIRES_IN` (default 7d), and `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
   `MAIL_FROM` for password-reset emails (without them the reset link prints in the server console).
2. Optional: add `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_PASSWORD_SUFFIX`, then load
   the demo data. **This wipes every event, registration and non-admin account in that database first.**

```bash
npm --prefix server run seed
```

## Run the Project

Start the server and the app in two terminals:

```bash
npm run server
```

```bash
npm start
```

The application will run at:

```text
http://localhost:3000
```

## Run the Tests

```bash
npm test
```
