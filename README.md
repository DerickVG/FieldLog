# FieldLog PWA

A free, installable web-app edition of FieldLog for iPhone and other modern browsers.

## Features

- Spiess Properties dashboard
- Weekly timesheets with flexible project rows
- Daily progress reports and compressed jobsite photos
- Employee name settings
- Template-matched printable PDF exports
- Offline caching after the first successful visit
- Optional in-session reminder notifications
- Private on-device browser storage

## Test on Windows

Open this folder in Terminal and run:

    npx.cmd serve .

Open the displayed local address in a browser. Local-network testing may require allowing Node.js through Windows Firewall.

## Publish free

Upload every file in this folder to any HTTPS static host, such as GitHub Pages, Cloudflare Pages, or Netlify. No build command is required. The publish directory is the project root.

After publishing, send employees the HTTPS link.

## Install on iPhone

1. Open the published link in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Enable Open as Web App.
5. Tap Add.

## PDF export

Export opens a print-ready version using the supplied navy timesheet or daily-progress layout. In the iPhone print screen, use the Share control to save or send the PDF.

## Storage and notifications

Records and photos remain in each browser's local storage and are not uploaded. Clearing Safari website data removes them. Photos are compressed before storage.

Web reminders work while FieldLog is open. Reliable background reminders require a hosted Web Push service and are not included in this no-backend edition.

## Updating installed copies

Publish changes to the same GitHub Pages address and increase the cache name in `sw.js` for every release (`fieldlog-pwa-v2`, then `v3`, and so on). Employees keep the same Home Screen icon; they only need to close and reopen FieldLog after the update is published.

## Photo markup

Tap any attached jobsite photo to draw, add arrows, circles, boxes, or text. Undo removes the most recent change. Save replaces that photo with its marked-up copy in the report.
