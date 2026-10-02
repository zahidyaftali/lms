# GA Healthcare Training — Learning Portal

A React + Tailwind LMS built for [GA Healthcare Training & Consulting](https://gahealthcaretraining.com/).
Single-tenant: there is no plan to buy, no marketplace billing and no public sign-up — **every account is
created by an administrator** and the login details are handed to the student.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
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

### Accounts and passwords

Only administrators create accounts (Users → Add user, or Import user(s)); there is no sign-up page.

- The password box starts empty and saves exactly what is typed. Generate fills in a random one. The
  Login details window and its Copy button show that same password.
- Edit user → New password, or Set new password on the user's page, replaces a password. The old one stops
  working immediately.
- Imports take an optional fifth column, Password. Accounts without one get a generated password, and every
  new account's details are listed once after the import, with a CSV download.
- Passwords must be at least the minimum length in Account & Settings → Users (8 by default) and cannot
  start or end with a space.
- Only administrators change passwords. Learners and instructors have no Password tab and there is no
  "Forgot password" link; they ask the program office.

### History

**Account & Settings → History** (administrators only) lists who created, edited or deleted users and
courses, who set whose password, and who changed portal settings, with the details of each edit. With the
shared database the server writes every entry itself, naming the signed-in user; passwords are never
recorded. Repeated edits of the same thing by the same person within ten minutes are grouped into one line,
and the latest 2,000 entries are kept. Export downloads the filtered list as CSV.

## Access levels

| | Admin / SuperAdmin | Trainer | Learner |
| --- | --- | --- | --- |
| Dashboard | Portal-wide | Own courses | Own progress |
| Users | Create, edit, deactivate, delete, import/export | Sees own learners only | — |
| Courses | Full authoring on every course | Authoring on assigned courses | Takes assigned courses |
| Course store | Add ready-made outlines | — | — |
| Learning paths / Automations / Skills | Full | — | — |
| Groups / Branches / Notifications | Full | — | — |
| Reports | Portal-wide + activity log | Own courses | — |
| Grading | Yes | Yes | — |
| Account & Settings / Subscription | Yes | — | — |
| Profile, messages, certificates | Yes | Yes | Yes |

Routes are guarded on both the navigation and the router, so a learner who types `/users` is returned to
their own home page.

## Learning paths, automations, skills and subscription

The administrator menu follows the TalentLMS layout: Home, Users, Courses, Learning paths, Course store,
Groups, Branches, Automations, Notifications, Reports, Skills, Account & Settings, Subscription.

- **Learning paths** — an ordered list of courses with its own learners. Saving an active path enrolls its
  learners in every course of the path. The Options tab (take courses in order, completion rule, time limit,
  certificate, self-join) is stored but not enforced yet.
- **Automations** — rules such as "24 hours after course X is completed, assign courses Y" or "deactivate
  users who have not signed in for 90 days". Rules are stored; **nothing runs them yet**, and the page says so.
- **Skills** — skills with a description, the courses that teach them, outside resources and the users who
  have them. Administrators only for now; learners do not see skills.
- **Subscription** — the portal's usage (active users, courses, branches, groups), optional limits to be
  warned about, hosting details and billing details. The portal is not billed, so there are no invoices.

## Account & Settings

| Tab | What it holds |
| --- | --- |
| Portal | Identity, logo, **favicon**, theme, contact, locale, **announcements**, custom homepage |
| Users | Registration defaults, sign-up rules, terms of service, social sign-in, single sign-on, custom user fields, passwords & inactivity |
| User types, Categories | As before |
| Courses | Course defaults, learning experience, catalog, certificates, custom course fields |
| Skills | Skills on/off, learner options, assessment rules |
| Gamification | Points, badges, levels, rewards, leaderboard |
| E-commerce | Payment processor, currency, subscription, discounts, coupons, credits, invoices |
| Integrations | Zoom, Microsoft Teams, GoTo Meeting, BigBlueButton, BambooHR, Salesforce, Zapier, Shopify, WooCommerce, API |
| Security | Two-factor, session timeout, lockout, audit log, password policy, sessions and allowed IPs |
| Import-Export, History | As before |

Live today: the favicon (browser tab icon), the internal announcement (a bar above every page for signed-in
users) and the external announcement (on the sign-in page), alongside everything that already worked.
Skills, Gamification, E-commerce, Integrations and the options marked "Saved for later" store their values
and are **not acted on yet**; each says so on the page. Saving writes only the settings that were edited, so
History names what really changed.

Integrations, API, single sign-on, e-commerce and billing settings are sent to administrators only
(`ADMIN_SETTINGS` in `server/access.js`). Do not add secret keys to these settings until that feature is
built with server-side storage for them.

## Course authoring

The builder (`/courses/:id`) mirrors the portal layout: unit list and Add menu on the left, live course
preview on the right, Publish in the header.

**Standard content** — rich text lessons, web links, video (upload or YouTube/Vimeo), audio,
PDF/presentation/document upload, iFrame embeds.
**Learning activities** — tests (single choice, multiple answers, true/false, free text, pass mark, time
limit, attempts, shuffle), surveys, assignments with file upload, instructor-led sessions with
date/location/capacity, SCORM · xAPI · cmi5 packages.
**More** — sections, clone units from another course, link units from another course.

Course-level tools: enrolled users panel, duplicate course, and **Course options** (the gear button), a
tabbed panel whose settings all take effect for learners:

| Tab | Options |
| --- | --- |
| Info | Activation, unique code, category, intro video (YouTube/Vimeo link or uploaded file, shown under the description in the builder, as a play button on the catalog card and on the public page), price, instructors, difficulty, banner theme |
| Availability | Catalog visibility; capacity (a full course leaves the catalog, manual enrollment still works); public sharing (`/share/:courseId`, no account needed, guest progress kept in that browser); enrollment request (switching it off lets learners enroll themselves, but only if self-enrollment is also on in Account & Settings → Courses) |
| Limits | Time limit in days from enrollment, or a start/end timeframe; access retention keeps completed learners in after either runs out. Expired or not-yet-open courses are locked in My courses and the player. |
| Completion | Completion rule and certificate template: Classic, Fancy, Modern or Simple. Issued certificates keep the template they were issued with. |

The rules live in `src/lib/courseAccess.js`.

## Courses copied from TalentLMS

The real GA Healthcare courses were copied from gahctc.talentlms.com on 27/09/2026: **Nursing Assistant**,
**NCLEX PN REVIEW COURSE**, **NCLEX RN REVIEW** and **Instructor onbording** (names as they were in
TalentLMS). Only courses came across. No users, enrollments or other data were copied, and TalentLMS's two
built-in sample courses were skipped.

- `src/lib/importedCourses.json` holds the courses: sections, lessons, the assignment, test settings and
  instructions. `src/lib/importedCourses.js` merges them into the portal once (marker: `courseImports`), so
  existing portals keep their users and later edits are never overwritten. The first three replace the
  portal's sample courses of the same name, keeping their ids.
- `public/course-files/<course>/` holds the 40 documents and 24 videos (about 335 MB), served with the app.
  Documents are TalentLMS's PDF renderings, because downloads of the original Word and PowerPoint files are
  switched off there.
- **Test questions were not copied.** TalentLMS refused to release them for the signed-in account. The 30
  tests keep their names, pass marks, attempts and instructions, and the test editor flags each one until
  questions are added. A test with no questions cannot be taken, so those courses cannot be completed until
  then.

## Enrollment requests

Learners cannot enroll themselves. From **Course catalog** a learner can *request* a course; the request
lands in the **Enrollment requests** widget on the administrator dashboard, where Approve creates the
enrollment immediately and Decline closes the request (the learner can ask again). A pending request shows
as "Awaiting approval" on the learner's catalog card.

## Responsive layout

The portal is built for phones, tablets and desktops:

- Below `lg` the blue rail becomes an off-canvas drawer opened from the hamburger, with a backdrop, and it
  closes automatically on navigation. From `lg` up the same button collapses the rail to icons.
- The topbar shrinks to 64px, drops the boxed logo and the name/role block, and keeps search usable.
- Account & Settings turns its vertical tab rail into a scrollable strip; the course builder stacks the
  unit list above the preview; tables scroll horizontally inside their card.
- Modals become full-width sheets with stacked footer buttons.

Motion is kept light — page and card fades, a slide-in drawer, scaling menus, animated progress bars — and
everything is disabled under `prefers-reduced-motion`.

## What learners get

Assigned courses with a unit-by-unit player, progress tracking, quizzes graded on submit, assignment
uploads, feedback from instructors, an automatically issued certificate on completion, an internal
message box and their own profile and password settings.

## Hosting

The live site is on Vercel (`lms-xi-five-47.vercel.app`), deployed from `main`. `vercel.json` sends every
path that is not a real file or an `/api` route to `index.html`, so reloading `/users` or `/courses/...`
opens the app instead of Vercel's 404 page.

## Shared database

Accounts and data are shared across devices once a Postgres database is connected; until then the portal
keeps everything in the browser where it was entered, and administrators see a notice saying so.

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
  (`collection`, `id`, `data`); password hashes (scrypt) live in their own table and never reach a browser.
- Signing in sets an HttpOnly session cookie. Setting a new password or deactivating an account signs that
  user out everywhere.
- Every change is sent to `/api/sync`, where `server/access.js` checks it against the user's role:
  learners can only change their own profile, progress, submissions and requests; instructors their own
  courses and grading; administrators everything. Learners receive only their own records.
- Open pages pick up other people's changes when the tab regains focus and once a minute.
- `npm run dev` runs the same API locally against `.data/lms-db.json` (or against Neon if
  `DATABASE_URL` is set). After changing `src/lib/seed.js`, run `npm run seed:export`.

## Data & storage

- Without a database: structured data (users, courses, enrollments, settings) → `localStorage`.
- With a database: the same data in Postgres, as above.
- Course files copied from TalentLMS → `public/course-files`, served with the site.
- Media uploaded from the course builder (video, audio, PDFs, SCORM zips, attachments) → IndexedDB in the
  uploading browser (`src/lib/fileStore.js`). **These uploads are not shared yet**: learners on other
  devices will not see them until file storage (for example Vercel Blob) is added.
- Backup and restore from **Account & Settings → Import-Export**, which also resets the portal to the
  sample content.

## Project layout

```
src/
  components/
    charts/      activity bar chart, donut, mini bars
    course/      course hero, unit editors, unit viewer, unit type registry
    layout/      topbar, sidebar, app shell, logo
    ui/          buttons, fields, tables, modals, drawers, icons
  context/       data store (local or server-synced), auth/session, toasts
  lib/           storage, file store, permissions, seed data, API client, sync, helpers
api/             Vercel Functions, one per API route
server/          API handler, access rules, password hashing, Postgres/file store, seed data
scripts/         export-seed.mjs
  pages/
    admin/       dashboard, users, courses, builder, store, learning paths, groups,
                 branches, automations, notifications, reports, skills, settings,
                 subscription
    instructor/  home, learners, grading
    learner/     home, my courses, player, catalog, certificates
    shared/      profile, messages, not found
```

## Branding

Colours, fonts and spacing are defined in `tailwind.config.js` and `src/index.css` — navy `#012053`,
action blue `#1a56db`, rail blue `#1052a8`, GA gold `#c9a227`, and Mulish throughout (700 at 23px/30px
for page headings, 700 at 16px/21px for widget titles, 400 at 14px/22px for body copy). Upload a logo file in
**Account & Settings → Portal → Branding** to replace the built-in wordmark everywhere.
