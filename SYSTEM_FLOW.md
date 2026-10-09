# How Eventify Works

Eventify is a website for school events. People find an event, sign up for it, get a ticket with a QR code, scan in at the door, and get a certificate when the event is over.

**Main path:** Find event → Join it → Get QR ticket → Check in at the door → Give feedback → Get certificate

---

## Contents

1. [Who uses Eventify](#who-uses-eventify)
2. [How to read the charts](#how-to-read-the-charts)
3. [Flow 1: The big picture](#flow-1-the-big-picture)
4. [Flow 2: Sign up and log in](#flow-2-sign-up-and-log-in)
5. [Flow 3: Life of an event](#flow-3-life-of-an-event)
6. [Flow 4: Join an event](#flow-4-join-an-event)
7. [Flow 5: Check in at the door](#flow-5-check-in-at-the-door)
8. [Flow 6: After the event](#flow-6-after-the-event)
9. [Flow 7: How the parts talk](#flow-7-how-the-parts-talk)

---

## Who uses Eventify

Every account has one role. The role decides which pages a person can open.

| Role | What they can do |
|---|---|
| **Attendee** | Find and join events, pick a seat, show a QR ticket, give feedback, get certificates |
| **Event Manager** | Make events, plan sessions, post announcements, see who joined, read feedback and reports |
| **Staff** | Open the check-in desk and scan QR tickets at the door |
| **Admin** | Approve events, manage users, venues, and settings, and see everything |

> Anyone can sign up, but a new account is always an **Attendee**.
> Only the Admin can make Event Manager, Staff, or Admin accounts.

---

## How to read the charts

```
[ Step ]          something that happens
< Question? >     a check: follow "Yes" or "No"
(OK)              the flow ends well
(STOP)            the flow stops here, with the message the user sees
```

---

## Flow 1: The big picture

Anyone can look at events without an account. You only need to log in when you want to join an event.

```
[ Visitor opens Eventify ]
  |
  v
[ Home page ]
  |
  v
[ Look at events and the calendar ]
  |
  v
< Want to join an event? > --No--> keep looking
  | Yes
  v
< Logged in? > --No--> [ Log in or sign up ]
  | Yes                  |
  |<---------------------+
  v
< What is your role? >
  |
  +-- Attendee -------> (OK) Back to the event. Also opens My Events, Schedule, Certificates
  +-- Event Manager --> (OK) Manager area (only their own events)
  +-- Staff ----------> (OK) Check-in desk
  +-- Admin ----------> (OK) Admin area (the whole system)
```

---

## Flow 2: Sign up and log in

### Sign up

```
[ Type name, email, and password ]
  |
  v
< Name filled in, email looks right, password has 6 or more characters? >
  |
  +-- No --> (STOP) Show what to fix
  |
  | Yes
  v
< Is the email free (no other account uses it)? >
  |
  +-- No --> (STOP) "An account with this email already exists."
  |
  | Yes
  v
[ Save the new account as an Attendee ]
  |
  v
(OK) Logged in
```

### Log in

```
[ Type email and password ]
  |
  v
< Email and password correct? > --No--> (STOP) "Incorrect email or password."
  | Yes
  v
< Is the account active? > --No--> (STOP) "This account is inactive. Contact an administrator."
  | Yes
  v
[ Server gives the browser a login pass (token), good for 7 days ]
  |
  v
(OK) Go to the area for your role
```

**Good to know**

- The browser shows the login pass every time it asks the server for something.
- Passwords are saved in a scrambled form (hashed), never as plain text.

---

## Flow 3: Life of an event

An event moves through these steps. Attendees can only join when it is **Published**.

```
[ Event Manager makes an event ]
  |
  v
< PENDING: the Admin checks it >
  |
  +-- Admin says no --> (STOP) REJECTED
  |
  | Admin says yes
  v
[ APPROVED: people see "Opens Soon" ]
  |
  | Admin publishes it
  v
[ PUBLISHED: "Registration Open", people can join ]
  |
  | The event is over
  v
(OK) COMPLETED
```

| Status | What it means | Who can set it |
|---|---|---|
| Pending | Waiting for the Admin | Set by itself when a Manager makes an event |
| Approved | Allowed, but not open to join yet | Admin |
| Published | Open, people can join | Admin |
| Completed | The event is over | Admin, or the event's own Manager |
| Cancelled | The event will not happen | Admin, or the event's own Manager |
| Rejected | The Admin said no | Admin |
| Archived | Old event, put away | Admin |

**Good to know**

- For an event made by a Manager, "Admin says yes" opens registration right away.
- Admins can also make events themselves.
- Deleting an event also deletes its tickets, certificates, sessions, announcements, and feedback.

---

## Flow 4: Join an event

Before a ticket is made, the server checks a few things. An event has either:

- **Free seating:** first come, first served. No seat number.
- **Reserved seating:** you pick your own seat on a seat map.

```
[ Attendee opens an event and clicks Register ]
  |
  v
< Logged in? > --No--> [ Log in first, then come back ]
  | Yes
  v
< Is registration open? > --No--> (STOP) "Registration is not open for this event."
  | Yes
  v
< Already joined this event? > --Yes--> (STOP) "You are already registered for this event."
  | No
  v
< Any space left? > --No--> (STOP) "Sorry, this event has reached maximum capacity."
  | Yes
  v
< Reserved seating? > --Yes--> [ Pick a seat on the seat map ]
  | No                           |
  |                              v
  |                            < Is the seat still free? > --No--> "That seat was just taken. Pick another seat."
  |                              | Yes
  |<-----------------------------+
  v
[ Ticket is saved as CONFIRMED ]
  |
  v
(OK) Ticket pass with a QR code
```

**Good to know**

- The QR code holds a secret code made by the server. It cannot be guessed.
- Two people can never get the same seat, even if they click at the same time.
- An Attendee can cancel their ticket. A cancelled ticket cannot be used again, and its seat opens up for others.

---

## Flow 5: Check in at the door

Staff scan each ticket with the camera. The server checks the ticket and tells the desk yes or no, with the reason.

```
[ Staff opens the check-in desk ]
  |
  v
[ Pick the event ]
  |
  v
[ Scan the attendee's QR code ]
  |
  v
< Is it an Eventify ticket? > --No--> (STOP) "This QR code is not an Eventify ticket."
  | Yes
  v
< Is the ticket in the system? > --No--> (STOP) "Ticket not found. It may be fake."
  | Yes
  v
< Is it for this event? > --No--> (STOP) "Wrong event."
  | Yes
  v
< Is the ticket still Confirmed? > --No--> (STOP) "This ticket was cancelled."
  | Yes
  v
< Is the event still open? > --No--> (STOP) "Check-in is closed."
  | Yes
  v
< Already checked in? > --Yes--> (STOP) "Already checked in."
  | No
  v
[ Save "Checked in" and the time ]
  |
  v
(OK) Attendee gets a notice: "Welcome to the event!"
```

**Good to know**

- If two desks scan the same ticket at the same time, only one lets the person in.
- Only Staff accounts can open the check-in desk.

---

## Flow 6: After the event

```
[ The event is marked COMPLETED ]
  |
  v
< Was the attendee checked in at the door? > --No--> (STOP) No certificate
  | Yes
  v
[ Attendee clicks "Complete attendance" in My Events ]
  |
  +-------> [ "Give Feedback": 1 to 5 stars and a comment ] ---> the organizer reads it
  |
  v
[ A certificate is made by itself ]
  |
  v
[ Attendee sees it on the Certificates page ]
  |
  v
(OK) Anyone can check that it is real on the Verify page, using its Credential ID
```

**Good to know**

- Each person gets only one certificate per event.
- The server checks that you really attended before it saves a certificate.

---

## Flow 7: How the parts talk

Eventify has three parts:

| Part | What it is | Its job |
|---|---|---|
| Website | React, runs in the browser | Shows the pages and sends requests |
| Server | Node.js and Express | Checks who is asking and what they may do |
| Database | MongoDB | Keeps all the saved data |

The website never touches the database directly. It always goes through the server.

```
[ Website in the browser ]
  |
  | asks for data, and shows the login pass
  v
[ Server ]
  |
  v
< Who is asking? Are they allowed? > --No--> (STOP) "Not logged in" or "Not allowed"
  | Yes
  v
[ Database reads or saves the data ]
  |
  v
[ Server keeps only what this person may see ]
  |
  v
(OK) Website shows it
```

**What each person gets back**

- An **Attendee** gets only their own tickets, certificates, and notices.
- An **Event Manager** gets only the events they made, and the people who joined them.
- An **Admin** gets everything.

**What the database keeps:** Users, Events, Registrations (tickets), Certificates, Notifications, Sessions, Announcements, Feedback, Venues, Activity log.
