# FieldLog PWA v5.1

A free, installable, offline-first edition of FieldLog for iPhone, Android, and modern desktop browsers.

## What v5 includes

- Renaissance dashboard
- Weekly timesheets with automatic Start/End hour calculations and flexible project rows
- Daily progress reports with compressed jobsite photos and advanced photo markup
- Task Tracker with primary and unlimited additional assignees
- Managed assignee and jobsite dropdown lists in Settings
- Active/inactive directory controls without changing historical records
- IndexedDB photo storage with device usage, warnings, protected-storage request, and cleanup tools
- Complete JSON backup and restore, including photos
- PDF preflight checks and an in-app preview before Share / Save
- Deterministic navy PDF layouts with no browser URL, timestamp, or blank print pages
- Offline caching after the first successful visit
- Optional in-session daily reminders

## Test on Windows

Open this folder in Terminal and run:

    npx.cmd serve .

Open the displayed local address in a browser. Local-network testing may require allowing Node.js through Windows Firewall.

## Publish free

Upload every file in this folder to the same HTTPS static host, such as GitHub Pages, Cloudflare Pages, or Netlify. No build command is required. The publish directory is the project root.

Employees who already installed FieldLog keep the same Home Screen icon. After v5 is published at the same address, close and reopen the app to receive the new version.

## Install on iPhone

1. Open the published link in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Enable Open as Web App.
5. Tap Add.

On Android, open the link in Chrome and choose Install app or Add to Home screen.

## PDF workflow

Timesheets, daily reports, and task plans run a preflight check first. Warnings can be reviewed or bypassed with Export Anyway. FieldLog then opens an in-app PDF preview. Use Share / Save PDF to send or save the finished file.

Timesheets are true landscape PDFs. Daily reports place the report first and then one captioned photo per page. Browser URLs and generated timestamps are not added.

## Storage, backup, and privacy

Text records stay in lightweight browser storage. Photos are compressed and stored in IndexedDB, which normally provides substantially more room than localStorage, although the exact quota is decided by the device and browser.

Open Settings → Data & Storage to:

- See current usage and the browser-provided quota
- Request protected offline storage
- Create or restore a complete unencrypted backup
- Open photo reports or remove photos from selected/older reports

FieldLog never deletes photos automatically. Clearing browser website data can still erase offline information, so create backups periodically. No data is uploaded by this offline edition.

## Updating installed copies

Publish replacement files to the same website address. The service-worker cache is named fieldlog-pwa-v5-1. Increase that cache name for each future release so installed copies update without being removed from the Home Screen.

## Photo markup

Tap any attached photo to draw, add arrows, circles, boxes, or text. Pinch with two fingers to zoom or pan without creating markup. Select / Move lets you reposition, resize, edit text size, or delete an individual object. Undo removes the most recent edit.

## Notifications

Daily reminders work while FieldLog is open. Reliable background reminders require a hosted push service and are intentionally not included in this offline-only version.

## v5.1 dropdown and Settings update

Jobsite and assignee fields now use a dependable in-app dropdown that opens when the field or arrow is tapped. Only active Settings entries appear, and manual typing remains available. Assignee names, jobsite names, and Photo Cleanup are collapsible. Photo Cleanup displays five reports per numbered page.
