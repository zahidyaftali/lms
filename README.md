# GA Healthcare Training — Learning Portal

A React + Tailwind LMS built for [GA Healthcare Training & Consulting](https://gahealthcaretraining.com/),
modelled on the school's TalentLMS portal. Single-tenant: the school owns its portal, so there is no plan to buy.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173, with the API and a local database file
npm run build    # production bundle in dist/
```

## Signing in

The portal ships with sample data. Any of these accounts works. Change these passwords before real
students use the portal: this repository is public.

| Role | Email | Password |
| --- | --- | --- |
| SuperAdmin | ynozile@gahealthcaretraining.com | `Ga@2026!` |
| SuperAdmin | zahidaliyaftali999@gmail.com | `Ga@2026!` |
| Admin | barbara.simmons@allianthealth.org | `Welcome1` |
| Trainer | drelisme@elismeconsultingservices.com | `Welcome1` |
| Learner | marcus.bennett@example.com | `Welcome1` |

Administrators can preview the portal as an instructor or learner from the avatar menu ("Switch role").

## Two ways the portal stores its data

| | Shared database connected | No database (browser only) |
| --- | --- | --- |
| Where data lives | Postgres, through the API in `server/` | `localStorage` of each browser |
| Accounts work on any device | Yes | No: each browser has its own copy |
| Who enforces the rules | The server | The browser |

**The live site needs the database to be useful to a school.** Without it a student on their own phone cannot
sign in to an account an administrator created on another computer. See [Shared database](#shared-database).

Everything on this list needs the server, and so the database. Each setting says so on its page until then:

- Two-factor authentication, one session at a time, allowed IP addresses
- Email (welcome messages, notifications, sign-up confirmation, invoices)
- Card payments, the REST API, webhooks, BambooHR import, Zoom and BigBlueButton rooms
- Sign in with Google / Facebook / LinkedIn or an organization account (OpenID Connect)
- Uploaded files that every device can open

Everything else works in both: the same rules run in the browser when there is no server
(`src/lib/rules.js`, `engine.js`, `commerce.js`, `gamification.js` are shared by both sides).

## Accounts and passwords

- Administrators create accounts (Users → Add user, or Import user(s)). With **Self-registration** on
  (Account & Settings → Users) the sign-in page also offers "Create an account"; people who sign up are
  always learners, can be limited to email domains, and can be held for a CAPTCHA question, an email
  confirmation or an administrator's activation.
- The password box starts empty and saves exactly what is typed. Generate fills in a random one.
- Administrators set and change passwords. Everyone else chooses their own only when the portal asks them
  to: **New password at first sign-in**, or **Passwords expire after** (both under Security).
- Password rules (minimum length, strong passwords) are checked on the form and again on the server.
- A wrong password counts towards **Failed login attempts before lockout**; an administrator can unlock an
  account from the Users page.

## Access levels

| | Admin / SuperAdmin | Trainer | Learner |
| --- | --- | --- | --- |
| Dashboard | Portal-wide | Own courses | Own progress |
| Users | Create, edit, deactivate, delete, import/export | Sees own learners only | — |
| Courses | Full authoring on every course | Authoring on assigned courses | Takes assigned courses |
| Learning paths / Automations / Skills | Full | — | Own paths, skills, achievements |
| Groups / Branches / Notifications | Full | — | — |
| Reports | Portal-wide, activity log, sales | Own courses | — |
| Grading | Yes | Yes | — |
| Account & Settings / Subscription | Yes | — | — |
| Profile, messages, certificates | Yes | Yes | Yes |

Routes are guarded on both the navigation and the router, and every change is checked again on the server
(`server/access.js`).

## What the portal does by itself

`src/lib/engine.js` looks at each change and does what follows from it. With the database the server runs it
after every accepted change, and on a timer (`/api/cron` daily, and at most every ten minutes while someone is
using the portal). Without one the browser runs it.

- **Certificates** are issued when a course is completed, using the course's template.
- **Learning paths** — taken in order (the next course opens as the previous one is completed) or all at
  once; completion rule; time limit from the day a learner joins; an optional certificate for the whole
  path; learners can join from the catalog when a path allows it.
- **Automations** — assign courses after assignment / completion / a score range / failure / user creation,
  before a course expires, reset and reassign around certificate expiry, deactivate users, give points, call
  a web address. Delayed ones are queued and run when due.
- **Notifications** — each active rule puts a message in the recipient's portal inbox and, with an email
  service connected, emails it. Notifications → Sent lists every email and what became of it.
- **Webhooks** — portal events are posted as JSON to the addresses under Integrations.
- **Inactivity** — learners and instructors idle for the number of days under Users are deactivated;
  administrators never are.

## Account & Settings

Every option acts. The settings that reach outside the portal need the service's own credentials.

| Tab | What it does |
| --- | --- |
| Portal | Site name and description (browser tab, search results), custom domain (printed on certificates), logo, favicon, **theme** (four colour schemes), **language** (English, Spanish, French for the menu, sign-in and learner pages), **time zone**, **date format**, **currency**, announcements, **custom homepage** for visitors |
| Users | Self-registration and its rules, default user type and **default group**, welcome email, **visible name format**, **terms of service** (accepted at first sign-in and whenever the text changes), social sign-in, single sign-on (OpenID Connect), **custom user fields**, minimum password length, deactivation after inactivity |
| User types, Categories | As before; renaming a type or changing its access level updates its accounts |
| Courses | Default completion rule, progress bar, self-enrollment, **units in order**, **summary page**, **discussions**, **ratings**, **external catalog** (`/explore`), catalog layout, social sharing, certificates on/off, **certificate validity**, default template, **custom course fields** |
| Skills | Skills for learners, suggestions, levels, and the assessment rules (questions, pass mark, retry, expiry) |
| Gamification | Points, badges, levels, rewards (a discount at checkout) and the leaderboard — all worked out from what learners have done, so changing a rule re-scores everyone |
| E-commerce | Stripe, PayPal, paying the program office, subscription, global discount, coupons, credits, invoices |
| Integrations | Email service, video conferencing, BambooHR, webhooks, REST API and its keys |
| Security | Two-factor (authenticator app), session timeout, lockout, audit log, strong passwords, password expiry, new password at first sign-in, one session at a time, allowed IP addresses |
| Import-Export, History | Backup and restore; who changed what |

Settings saved by an earlier version of the portal held placeholder values that were never acted on. The
ones that would have locked learners out the moment they started working are switched off once
(`withSettingDefaults` in `src/lib/settingsDefaults.js`): units in order, certificate expiry, a new password
at first sign-in, deactivation after inactivity. Turn them on deliberately.

### Connecting outside services

Keys and client secrets are typed into the settings page and saved **on the server only** (the `_secrets`
record; `server/services.js`). A browser is only ever told "saved, ending in 1234". The same values can be
supplied as environment variables instead.

| Service | Where | What to enter |
| --- | --- | --- |
| Email | Integrations → Email | Resend or SendGrid API key and a verified "from" address |
| Card payments | E-commerce → Stripe | Stripe secret key. Learners pay on Stripe's checkout page; the server asks Stripe whether the session was paid before enrolling anyone |
| PayPal | E-commerce → PayPal | Account email. PayPal does not report back, so each order waits for "Mark as paid" under Reports → Sales |
| Zoom | Integrations → Zoom | A Server-to-Server OAuth app's account ID, client ID and secret; sessions get a "Create meeting" button |
| BigBlueButton | Integrations → BigBlueButton | Server address and shared secret; the room opens when the first person joins |
| Teams, GoTo | — | Paste the meeting link into the session |
| BambooHR | Integrations → BambooHR | Subdomain and API key, then "Import employees now" |
| Google, Facebook, LinkedIn sign-in | Users | Client ID and secret; redirect address `/api/oauth` |
| Single sign-on | Users | OpenID Connect issuer, client ID and secret. SAML and LDAP are not supported |
| Zapier, Salesforce, Shopify, WooCommerce | Integrations | Through webhooks and the REST API below |

These connections were written against each service's published API and **have not been run against live
accounts**; test each one after entering its keys.

### REST API

Switched on under Integrations → API, where keys are issued (shown once; only a fingerprint is stored).
Send the key as `Authorization: Bearer <key>`.

```
GET    /api/v1/users            ?email=
POST   /api/v1/users            { firstName, lastName, email, password?, userType? }
PATCH  /api/v1/users/:id        { active?, firstName?, lastName?, phone? }
GET    /api/v1/courses
GET    /api/v1/enrollments      ?userId=&courseId=&email=
POST   /api/v1/enrollments      { userId | email, courseId | courseCode }
DELETE /api/v1/enrollments      same fields
GET    /api/v1/certificates     ?userId=&email=
POST   /api/v1/orders           { email, firstName, lastName, courseCodes | courseIds, reference?, amount? }
```

`POST /api/v1/orders` is for online stores: it creates the buyer's account if needed and enrolls it.

## Course authoring

The builder (`/courses/:id`) mirrors the portal layout: unit list and Add menu on the left, live course
preview on the right, Publish in the header.

**Standard content** — rich text lessons, web links, video (upload or YouTube/Vimeo), audio,
PDF/presentation/document upload, iFrame embeds.
**Learning activities** — tests (single choice, multiple answers, true/false, free text, pass mark, time
limit, **attempt limit**, shuffle), surveys, assignments with file upload, instructor-led sessions with
date/location/capacity and an **online meeting**, SCORM · xAPI · cmi5 packages.
**More** — sections, clone units from another course, link units from another course.

Course-level tools: enrolled users panel (mark complete, reset attempts), the course's discussion, duplicate
course, and **Course options** (the gear button):

| Tab | Options |
| --- | --- |
| Info | Activation, unique code, category, intro video, price, instructors, difficulty, banner theme, custom fields |
| Availability | Catalog visibility; capacity; public sharing (`/share/:courseId`); enrollment request |
| Limits | Time limit in days from enrollment, or a start/end timeframe; access retention |
| Completion | Completion rule — all units, only the final test, or an instructor marks it — and certificate template |

A learner who uses up a test's attempts fails the course until an instructor resets it.

## Courses copied from TalentLMS

The real GA Healthcare courses were copied from gahctc.talentlms.com on 27/09/2026: **Nursing Assistant**,
**NCLEX PN REVIEW COURSE**, **NCLEX RN REVIEW** and **Instructor onbording** (names as they were in
TalentLMS). Only courses came across. No users, enrollments or other data were copied.

- `src/lib/importedCourses.json` holds the courses; `src/lib/importedCourses.js` merges them in once.
- `public/course-files/<course>/` holds the 40 documents and 24 videos (about 335 MB), served with the app.
- **Test questions were not copied.** TalentLMS refused to release them. The 30 tests keep their names, pass
  marks, attempts and instructions, and the test editor flags each one until questions are added. A test with
  no questions cannot be taken, so those courses cannot be completed until then — and with **Unit navigation**
  set to "In order", learners would stop at the first empty test.

## What learners get

Assigned courses with a unit-by-unit player (summary page, units in order when that is on, discussion,
rating), tests graded on submit, assignment uploads, feedback from instructors, certificates with a public
verification page (`/verify/<number>`), learning paths, a Skills page with assessments, an Achievements page
with points, badges, levels and the leaderboard, the catalog with checkout for paid courses, an internal
message box and their profile with purchases and invoices.

## Responsive layout

- Below `lg` the rail becomes an off-canvas drawer opened from the hamburger; from `lg` up the same button
  collapses the rail to icons.
- Account & Settings turns its vertical tab rail into a scrollable strip; the course builder stacks the
  unit list above the preview; tables scroll horizontally inside their card.
- Modals become full-width sheets with stacked footer buttons.

Motion is kept light and is disabled under `prefers-reduced-motion`.

## Hosting

The live site is on Vercel (`lms-xi-five-47.vercel.app`), deployed from `main`. `vercel.json` sends every
path that is not a real file or an `/api` route to `index.html`, maps `/api/v1/...` to the REST API, and
runs `/api/cron` once a day.

## Shared database

**Connecting it (one time, in the Vercel dashboard):**

1. Open the `lms` project → **Storage** → **Create Database** → **Neon** (Serverless Postgres) → free plan.
2. Connect it to the project for all environments. Vercel adds `DATABASE_URL` for you.
3. **Deployments** → latest deployment → **⋯** → **Redeploy**.
4. Open the site. The first visit fills the database with the portal's sample data and the copied
   TalentLMS courses (`server/seed-data.js`).
5. Sign in as an administrator. If this browser still holds data from the browser-only days, a notice
   offers to move it (Account & Settings → Import-Export); that also carries over the passwords set here.
6. **Change the SuperAdmin passwords** (Profile → Password). The sample passwords are listed in this
   public README.

**How it works:**

- `api/*.js` are Vercel Functions that call `server/handler.js`. Records live in one Postgres table
  (`collection`, `id`, `data`); password hashes (scrypt) and uploaded files have their own tables.
  Collections whose name starts with `_` (sessions and two-factor secrets, service keys, API key
  fingerprints) never reach a browser.
- Signing in sets an HttpOnly session cookie. Setting a new password or deactivating an account signs that
  user out everywhere.
- Every change is sent to `/api/sync`, where `server/access.js` checks it against the user's role. Orders,
  scheduled jobs and the email log are written by the server only; prices are always worked out there.
- Single actions (sign-up, two-factor, checkout, uploads, keys) go through `/api/rpc` (`server/rpc.js`).
- Open pages pick up other people's changes when the tab regains focus and once a minute.
- `npm run dev` runs the same API locally against `.data/lms-db.json` (or against Neon if
  `DATABASE_URL` is set). After changing `src/lib/seed.js`, run `npm run seed:export`.

## Data & storage

- Course files copied from TalentLMS → `public/course-files`, served with the site.
- Files uploaded in the portal (course media, assignment attachments): with the database, files **up to
  4 MB** are stored in it and open on every device. Larger ones stay in the uploading browser (IndexedDB)
  and the editor says so; use a YouTube or Vimeo link for video.
- Backup and restore from **Account & Settings → Import-Export**. Passwords and service keys are never in
  the export.

## Project layout

```
src/
  components/
    charts/      activity bar chart, donut, mini bars
    course/      hero, unit editors and viewer, catalog card, checkout, discussion, invoice, certificate
    layout/      topbar, sidebar, app shell, sign-in shell, logo
    ui/          buttons, fields, tables, modals, drawers, icons
    users/       password and login-details dialogs, custom field inputs
  context/       data store (local or server-synced), auth/session/gates, toasts
  lib/           rules, engine, commerce, gamification, settings defaults (shared with the server);
                 storage, file store, permissions, seed data, API client, sync, translations
  pages/
    admin/       dashboard, users, courses, builder, store, learning paths, groups, branches,
                 automations, notifications, reports, skills, settings, subscription
    instructor/  home, learners, grading
    learner/     home, my courses, player, catalog, certificates, paths, skills, achievements
    public/      homepage, external catalog, email confirmation, certificate verification
    shared/      profile, messages, public course, not found
api/             Vercel Functions, one per API route
server/          handler (routes), core (sessions, saving), access rules, rpc actions, REST API,
                 outside services, password hashing and two-factor, Postgres/file store, seed data
scripts/         export-seed.mjs
```

## Branding

Colours, fonts and spacing are defined in `tailwind.config.js` and `src/index.css`. The menu, action and
text colours are CSS variables, so the theme chosen under Account & Settings → Portal restyles the portal;
the default is navy `#012053`, action blue `#1a56db`, rail blue `#1052a8`, GA gold `#c9a227`, in Mulish.
Upload a logo in **Account & Settings → Portal → Branding** to replace the built-in wordmark everywhere.
