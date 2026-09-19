# GA Healthcare Training — Learning Portal

A React + Tailwind LMS built for [GA Healthcare Training & Consulting](https://gahealthcaretraining.com/).
Single-tenant: there is no subscription, no marketplace billing and no public sign-up — **every account is
created by an administrator** and the login details are handed to the student.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

## Signing in

The portal ships with sample data. Any of these accounts works (the login screen also lists them under
"View portal accounts for testing"):

| Role | Email | Password |
| --- | --- | --- |
| SuperAdmin | ynozile@gahealthcaretraining.com | `Ga@2026!` |
| SuperAdmin | zahidaliyaftali999@gmail.com | `Ga@2026!` |
| Admin | barbara.simmons@allianthealth.org | `Welcome1` |
| Trainer | drelisme@elismeconsultingservices.com | `Welcome1` |
| Learner | marcus.bennett@example.com | `Welcome1` |

Administrators can preview the portal as an instructor or learner from the avatar menu ("Switch role").

## Access levels

| | Admin / SuperAdmin | Trainer | Learner |
| --- | --- | --- | --- |
| Dashboard | Portal-wide | Own courses | Own progress |
| Users | Create, edit, deactivate, delete, import/export | Sees own learners only | — |
| Courses | Full authoring on every course | Authoring on assigned courses | Takes assigned courses |
| Course store | Add ready-made outlines | — | — |
| Groups / Branches / Notifications | Full | — | — |
| Reports | Portal-wide + activity log | Own courses | — |
| Grading | Yes | Yes | — |
| Account & Settings | Yes | — | — |
| Profile, messages, certificates | Yes | Yes | Yes |

Routes are guarded on both the navigation and the router, so a learner who types `/users` is returned to
their own home page.

## Course authoring

The builder (`/courses/:id`) mirrors the portal layout: unit list and Add menu on the left, live course
preview on the right, Publish in the header.

**Standard content** — rich text lessons, web links, video (upload or YouTube/Vimeo), audio,
PDF/presentation/document upload, iFrame embeds.
**Learning activities** — tests (single choice, multiple answers, true/false, free text, pass mark, time
limit, attempts, shuffle), surveys, assignments with file upload, instructor-led sessions with
date/location/capacity, SCORM · xAPI · cmi5 packages.
**More** — sections, clone units from another course, link units from another course.

Course-level tools: enrolled users panel, duplicate course, settings (code, price, category, level,
instructors, completion rule, time limit, certificate, banner theme).

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

## Data & storage

The portal runs entirely in the browser — no backend is required to demo it.

- Structured data (users, courses, enrollments, settings) → `localStorage`
- Uploaded media (video, audio, PDFs, SCORM zips, attachments) → IndexedDB (`src/lib/fileStore.js`)
- Backup and restore from **Account & Settings → Import-Export**, which also resets the portal to the
  sample content.

To connect a real backend, replace the action implementations in `src/context/DataContext.jsx` with API
calls; the pages only ever talk to that context.

## Project layout

```
src/
  components/
    charts/      activity bar chart, donut, mini bars
    course/      course hero, unit editors, unit viewer, unit type registry
    layout/      topbar, sidebar, app shell, logo
    ui/          buttons, fields, tables, modals, drawers, icons
  context/       data store, auth/session, toasts
  lib/           storage, file store, permissions, seed data, helpers
  pages/
    admin/       dashboard, users, courses, builder, store, groups, branches,
                 notifications, reports, settings
    instructor/  home, learners, grading
    learner/     home, my courses, player, catalog, certificates
    shared/      profile, messages, not found
```

## Branding

Colours, fonts and spacing are defined in `tailwind.config.js` and `src/index.css` — navy `#012053`,
action blue `#1a56db`, rail blue `#1052a8`, GA gold `#c9a227`, and Mulish throughout (700 at 23px/30px
for page headings, 700 at 16px/21px for widget titles, 400 at 14px/22px for body copy). Upload a logo file in
**Account & Settings → Portal → Branding** to replace the built-in wordmark everywhere.
