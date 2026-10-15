# How Eventify Works

Eventify is a website for school events. People find an event, sign up for it, get a ticket with a QR code, scan in at the door, scan the exit QR on the way out, and get a certificate.

**Main path:** Find event → Join it → Get QR ticket → Check in at the door → Scan the exit QR when leaving → Get certificate → Give feedback

---

## Contents

1. [Who uses Eventify](#who-uses-eventify)
2. [How to read the charts](#how-to-read-the-charts)
3. [Flow 1: The big picture](#flow-1-the-big-picture)
4. [Flow 2: Sign up and log in](#flow-2-sign-up-and-log-in)
5. [Flow 3: Life of an event](#flow-3-life-of-an-event)
6. [Flow 4: Join an event](#flow-4-join-an-event)
7. [Flow 5: Check in at the door](#flow-5-check-in-at-the-door)
8. [Flow 6: Leave the event (exit QR)](#flow-6-leave-the-event-exit-qr)
9. [Flow 7: After the event](#flow-7-after-the-event)
10. [Flow 8: Check a certificate is real](#flow-8-check-a-certificate-is-real)
11. [Flow 9: How the parts talk](#flow-9-how-the-parts-talk)

---

## Who uses Eventify

Every account has one role. The role decides which pages a person can open.

| Role | What they can do |
|---|---|
| **Attendee** | Find and join events, pick a seat, show a QR ticket, scan the exit QR when leaving, give feedback, get certificates |
| **Event Manager** | Make events, plan sessions, post announcements, see who joined, mark someone as exited if they couldn't scan, read feedback and reports |
| **Staff** | Open the check-in desk, scan QR tickets at the door, and show the exit QR when the event ends |
| **Admin** | Approve or reject events (and undo a rejection), manage users, venues, and settings, and see everything |

> Anyone can sign up, but a new account is always an **Attendee**.
> Only the Admin can make Event Manager, Staff, or Admin accounts.
> Anyone, even without an account, can check that a certificate is real on the **Verify** page.

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
[ Look at events and the calendar, or verify a certificate ]
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

**Good to know**

- Explore Events shows events you can still go to first, soonest first by date and then start time. Finished events come after them.
- Long lists show one page at a time (for example 20 events on Explore Events, 10 tickets per tab on My Events). The page buttons only appear when a list is longer than one page.

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
< 10 wrong passwords for this email lately? > --Yes--> (STOP) "Too many wrong passwords... Try again in 15 minutes."
  | No
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
- After 10 wrong passwords for one email, signing in to it waits 15 minutes. Resetting the password ends the wait.

---

## Flow 3: Life of an event

An event moves through these steps. Attendees can only join when it is **Published**.

```
[ Event Manager makes an event ]
  |
  v
< PENDING: the Admin checks it >
  |
  +-- Admin says no --> REJECTED --(Admin clicks Undo)--> back to PENDING, and the Manager is told
  |
  | Admin says yes
  v
[ APPROVED: people see "Opens Soon" ]
  |
  | Admin publishes it
  v
[ PUBLISHED: "Registration Open", people can join ]
  |
  | The end time passes (or it is marked completed)
  v
(OK) COMPLETED
```

| Status | What it means | Who can set it |
|---|---|---|
| Pending | Waiting for the Admin | Set by itself when a Manager makes an event |
| Approved | Allowed, but not open to join yet | Admin |
| Published | Open, people can join | Admin |
| Completed | The event is over | Set by itself when the end time passes, or by the Admin, or by the event's own Manager once the Admin approved it |
| Cancelled | The event will not happen | Admin, or the event's own Manager |
| Rejected | The Admin said no. The Admin can undo it: the event goes back to Pending and its Manager gets a notice | Admin |
| Archived | Old event, put away | Admin |

**Good to know**

- For an event made by a Manager, "Admin says yes" opens registration right away.
- Admins can also make events themselves.
- Deleting an event also deletes its tickets, certificates, sessions, announcements, and feedback.
- Renaming a venue renames it on the events booked there, so the double-booking check keeps working.

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
< Do you already have a ticket to another event at the same time (same day, any venue)? >
  |
  +-- Yes --> (STOP) "This clashes with <event> (<time>). Cancel that registration to register here."
  |             The page shows a "Cancel that registration" button
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
- An Attendee can cancel their ticket until it is checked in. A cancelled ticket cannot be used again, and its seat opens up for others.
- When many people sign up for the last seats at once, the earliest sign-ups keep them; the rest get "maximum capacity".
- Once an event is over, its ticket moves from Upcoming to Past in My Events, marked Attended or Missed.
- Two events clash only when their times overlap. An event ending at 11:00 and another starting at 11:00 do not clash. The server checks this too, so it cannot be skipped.

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
< Has the event started? > --No--> (STOP) "Too early. Check-in opens when the event starts."
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
- Check-in opens at the event's start time (its date and start time). Until then the Event Manager's **Check in** button is locked and reads "Opens Oct 11, 10:00 AM"; it unlocks by itself at the start time, without a page reload.

---

## Flow 6: Leave the event (exit QR)

A certificate needs proof that the person stayed, so attendees scan an exit QR on the way out. Exit verification runs from **15 minutes before the event ends until 2 hours after**.

```
[ Staff picks the event on the check-in desk ]
  |
  v
[ Staff clicks "Start Exit Verification" ]
  |
  v
[ The screen shows an exit QR. A new one appears every 30 seconds ]
  |
  v
[ Attendee scans it: with the phone camera, or "Scan exit QR" in My Events ]
  |
  v
< Logged in as an Attendee? > --No--> [ Log in, then scan again ]
  | Yes
  v
< Is exit verification running for this event? > --No--> (STOP) "Exit verification isn't running right now."
  | Yes
  v
< Does the attendee have a ticket to this event? > --No--> (STOP) "You don't have a ticket to this event."
  | Yes
  v
< Already exited? > --Yes--> (STOP) "Your exit is already verified."
  | No
  v
< Was the ticket checked in at the door? > --No--> (STOP) "Your ticket was never checked in."
  | Yes
  v
< Is this the code on screen right now, and not too old? > --No--> (STOP) "This code has expired or was already used."
  | Yes
  v
[ The code is used up and the screen shows a new one ]
  |
  v
[ Save "Attended" and the exit time ]
  |
  v
(OK) Attendee gets a notice, and the certificate is made
```

**Good to know**

- Each exit code works for **one** scan only, and only for 30 seconds, so a screenshot is not much use.
- If two people scan the same code at the same moment, only one gets through. The other scans the new code.
- A failed scan does **not** use up the code on screen.
- The staff screen shows how many people have exited, and the last few names.
- If someone could not scan (for example, their phone died), the event's **Manager** can click **Mark exited** on a checked-in person. It is saved in the activity log with the Manager's name.
- Someone who checks in but never exits stays "Checked in" and gets **no certificate**.

---

## Flow 7: After the event

```
[ The end time passes, so the event becomes COMPLETED ]
  |
  v
< Did the attendee check in AND scan the exit QR? > --No--> (STOP) No certificate
  | Yes
  v
[ The server makes the certificate by itself ]
  |
  +-------> [ "Give Feedback": 1 to 5 stars and a comment, once ] ---> the organizer reads it
  |
  v
(OK) Attendee sees it on the Certificates page
```

**Good to know**

- If the attendee exits after the event is already completed, the certificate is made right away. Otherwise it is made when the event completes.
- Each person gets only one certificate per event.
- Only the server makes certificates, using its own records, so nobody can change the name, event or hours on one.
- The Certificates page has a search (event name, organizer, or credential ID) and shows 10 at a time.

---

## Flow 8: Check a certificate is real

Anyone can do this, with or without an account. Open the profile menu (top right) and click **Verify a Certificate**.

```
[ Open the Verify page ]
  |
  v
< Type the credential ID, or scan the certificate's QR? >
  |
  +-- Type --> [ Type it, e.g. CERT-NU-2026-AB12CD34, and click Verify ]
  |
  +-- Scan --> [ Click "Scan QR": use the camera, or upload a photo of the QR ]
  |              |
  |              v
  |            < Is it an Eventify certificate QR? > --No--> (STOP) "This isn't an Eventify certificate QR."
  |              | Yes
  |<-------------+
  v
< Does a certificate have this ID? > --No--> (STOP) "Not verified: no certificate has this credential ID."
  | Yes
  v
(OK) "Valid certificate": who it was awarded to, the event, the date, and the hours
  |
  v
[ "Verify another certificate" goes back to an empty box ]
```

**Good to know**

- Small mistakes are fixed by themselves: lowercase letters, spaces, or a missing "CERT-NU-" at the start.
- The QR printed on a certificate opens its result straight away.

---

## Flow 9: How the parts talk

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

**What the database keeps:** Users, Events, Registrations (tickets, check-in and exit), Exit codes (the current exit QR of each event), Certificates, Notifications, Sessions, Announcements, Feedback, Venues, Activity log.
