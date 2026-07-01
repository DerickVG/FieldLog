# FieldLog v5 QA Report

Date: 2026-07-01

## Result

38 automated checks passed with no code or PDF failures. The release archive was created only after these checks.

## Automated checks completed

### Timesheets

- Start/End calculations: normal AM/PM, 24-hour overnight, shorthand time, and incomplete time
- Weekly total uses the same saved row hours as the Home dashboard
- True US Letter landscape PDF (792 × 612 points)
- 14 entry rows with 10 distinct projects remain on one page
- More than 10 project totals continue onto dedicated summary pages
- Dates render without leading zeroes
- Weekly project totals and combined total are separate
- No browser URL, browser timestamp, or print footer

### Daily reports

- Long report text creates continuation pages instead of clipping
- No blank PDF pages
- Exactly one attached photo per photo page
- Caption appears above its photo
- Full employee/report title fits the header
- No browser URL, generated timestamp, or print footer

### Tasks and directories

- All seven requested assignee names are seeded
- Active/inactive state survives data normalization
- Existing one-assignee tasks migrate safely
- Multiple assignees remain attached to a task
- Task PDF includes all listed assignees
- All 29 rendered button actions have matching handlers
- Jobsite dropdown contracts are present in timesheet, daily report, and task forms

### Storage and migration

- Photos save to IndexedDB
- Saved photos reload and hydrate into reports
- Existing localStorage photos migrate into IndexedDB
- Individual photo deletion removes the database record
- Backup retains full photo content while removing runtime-only flags
- Backup picker, storage usage, quota/persistence status, and cleanup contracts are present

### Offline and compatibility audit

- Every service-worker cache file exists
- Cache version is fieldlog-pwa-v5
- All JavaScript modules parse successfully
- Responsive rules cover 430 px and 380 px phone widths
- Photo markup keeps the two-finger gesture surface and existing Select/Move controls

## Visual PDF review

Rendered pages were inspected as images. Timesheet columns, dates, totals, and combined hours no longer overlap. Daily-report content stays inside its navy template, and photo pages keep the caption and image together.

## Field-device verification checklist

The workspace browser security policy prevented it from opening the local PWA, so installation-specific behavior still needs a short real-device smoke test after publishing:

1. Close and reopen the installed app to receive v5.
2. Confirm the old reports and photos appear.
3. Add one camera photo and one gallery photo.
4. Mark up a photo, save it, reopen it, and confirm edits remain movable.
5. Export one timesheet, daily report, and task plan through the preview screen.
6. Create a backup, then verify the JSON file appears in Files/Downloads.
7. Check Settings → Data & Storage on iPhone and one Android device.

No cloud service or paid account is required for these checks.
