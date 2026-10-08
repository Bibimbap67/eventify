// Usage: node shoot.js <outDir> [filter]
// Logs in per role via the API, stores the token, screenshots every page at 375/768/1280.
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");

const OUT = process.argv[2];
const FILTER = process.argv[3] || "";
const BASE = "http://localhost:3000";
const API = "http://localhost:5000/api";
const WIDTHS = (process.env.WIDTHS || "375,768,1280").split(",").map(Number);
const CREDS = {
  student: ["student@eventify.com", "Student@12345"],
  admin: ["admin@eventify.com", "Admin@12345"],
  manager: ["manager@eventify.com", "Manager@12345"],
};

const SHOTS = [
  ["guest", "landing", "/"],
  ["guest", "login", "/login"],
  ["guest", "signup", "/login", async (p) => p.getByRole("tab", { name: /create account/i }).click()],
  ["guest", "events", "/events"],
  ["student", "home-signed-in", "/"],
  ["student", "workspace", "/workspace"],
  ["student", "my-events", "/my-events"],
  ["student", "schedule", "/schedule"],
  ["student", "attendance", "/attendance"],
  ["student", "certificates", "/certificates"],
  ["student", "notifications", "/notifications"],
  ["student", "profile", "/profile"],
  ["guest", "event-detail", "/events/demo-event-6"],
  ["student", "event-detail-registered", "/events/demo-event-6"],
  ["student", "my-events-ticket-modal", "/my-events", async (p) => p.getByRole("button", { name: /view digital pass/i }).first().click()],
  ["student", "certificates-modal", "/certificates", async (p) => p.getByRole("button", { name: /view & print certificate/i }).first().click()],
  ...["", "events", "registrations", "attendance", "users", "venues", "sessions", "announcements",
    "feedback", "certificates", "reports", "settings"].map((s) => ["admin", `admin-${s || "dashboard"}`, `/admin/${s}`]),
  ...["", "events", "registrations", "attendance", "schedule", "participants", "announcements",
    "feedback", "reports"].map((s) => ["manager", `manager-${s || "overview"}`, `/manager/${s}`]),
  ...["overview", "details", "schedule", "participants", "announcements", "feedback", "reports"]
    .map((t) => ["manager", `manager-event-${t}`, `/manager/events/demo-event-6/${t}`]),
];

async function token(role) {
  const [email, password] = CREDS[role];
  const res = await fetch(`${API}/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${role}: ${res.status}`);
  return (await res.json()).token;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [];
  const tokens = {};
  for (const [role, name, url, act] of SHOTS.filter((s) => s[1].includes(FILTER))) {
    if (role !== "guest" && !tokens[role]) tokens[role] = await token(role);
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 375 ? 812 : 900 }, deviceScaleFactor: 1 });
      if (tokens[role]) await ctx.addInitScript((t) => localStorage.setItem("eventify_token", t), tokens[role]);
      const page = await ctx.newPage();
      page.on("console", (m) => m.type() === "error" && errors.push(`${name}@${w}: ${m.text().slice(0, 200)}`));
      page.on("pageerror", (e) => errors.push(`${name}@${w} PAGEERROR: ${e.message.slice(0, 200)}`));
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      if (act) await act(page);
      await page.waitForTimeout(600);
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      if (scrollW > w) errors.push(`${name}@${w}: HORIZONTAL SCROLL (${scrollW}px)`);
      await page.screenshot({ path: path.join(OUT, `${name}-${w}.png`), fullPage: true });
      await ctx.close();
    }
    process.stdout.write(".");
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, "_console.txt"), errors.join("\n") + "\n");
  console.log(`\n${errors.length} issues -> ${path.join(OUT, "_console.txt")}`);
})().catch((e) => { console.error(e); process.exit(1); });
