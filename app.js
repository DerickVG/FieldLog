import {
  loadData, saveData, ensureWeek, ensureReport, currentDateKey, currentWeekKey,
  shiftDate, newEntry, totalHours, completionForDate, parseDate
} from './data.js';
import { exportTimesheet, exportDailyReport } from './pdf.js';

let data = loadData();
let screen = 'home';
let selectedWeek = currentWeekKey();
let selectedDate = currentDateKey();
let reminderTimer = null;
const app = document.getElementById('app');
const cameraInput = document.getElementById('camera-input');
const libraryInput = document.getElementById('library-input');

function esc(value) {
  return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function persist() {
  try { saveData(data); }
  catch { alert('This device is running low on browser storage. Remove older photos before adding more.'); }
}

function field(label, value, attrs, multiline, extraClass) {
  const hasClass = String(attrs || '').indexOf('class=') >= 0;
  const defaultClass = multiline ? 'textarea ' + (extraClass || '') : 'input';
  const classAttr = hasClass ? '' : ' class="' + defaultClass.trim() + '"';
  const tag = multiline
    ? '<textarea' + classAttr + ' ' + attrs + '>' + esc(value) + '</textarea>'
    : '<input' + classAttr + ' value="' + esc(value) + '" ' + attrs + '>'; 
  return '<div class="field"><label>' + esc(label) + '</label>' + tag + '</div>';
}

function period(label, kind) {
  return '<div class="period"><button data-action="' + kind + '-previous">‹</button><div class="period-center"><div class="period-label">' + esc(label) + '</div><button class="period-current" data-action="' + kind + '-current">GO TO CURRENT</button></div><button data-action="' + kind + '-next">›</button></div>';
}

function nav() {
  const items = [
    ['home','⌂','Home'],['timesheet','▦','Timesheet'],['daily','▤','Report'],['settings','⚙','Settings']
  ];
  return '<nav class="bottom-nav">' + items.map(function(item) {
    return '<button class="nav-item ' + (screen === item[0] ? 'active' : '') + '" data-screen="' + item[0] + '"><span class="nav-icon">' + item[1] + '</span><span>' + item[2] + '</span></button>';
  }).join('') + '</nav>';
}

function homeView() {
  const sheet = ensureWeek(data, selectedWeek);
  const report = ensureReport(data, selectedDate);
  const started = Boolean(report.project || report.completed || report.photos.length);
  return '<main class="page"><div class="kicker">FIELDLOG</div><h1 class="page-title">Spiess Properties</h1><p class="subtitle">Timesheets, daily reports, and jobsite photos in one place.</p>' +
    '<section class="hero"><div class="hero-label">SELECTED WEEK</div><div class="hero-value">' + totalHours(sheet).toFixed(2) + '</div><div class="hero-unit">hours logged</div><div class="hero-rule"></div><div class="hero-meta">Week of ' + esc(sheet.weekOf) + '</div></section>' +
    '<h2 class="section-title">Your paperwork</h2>' +
    '<div class="card-link" data-screen="timesheet"><div class="card-icon">▦</div><div class="card-copy"><div class="card-title">Weekly timesheet</div><div class="card-body">Add only the projects you worked on each day</div></div><div class="arrow">›</div></div>' +
    '<div class="card-link" data-screen="daily"><div class="card-icon warm">▤</div><div class="card-copy"><div class="card-title">Daily progress report</div><div class="card-body">' + (started ? report.photos.length + ' photos · draft saved' : 'Start the selected day’s field report') + '</div></div><div class="arrow">›</div></div>' +
    '<div class="card-link" data-screen="settings"><div class="card-icon green">⚙</div><div class="card-copy"><div class="card-title">Settings</div><div class="card-body">' + esc(data.settings.name || 'Set the name used on exported reports') + '</div></div><div class="arrow">›</div></div>' +
    '<div class="notice"><div class="notice-mark">✓</div><div><div class="notice-title">Saved on this device</div><div class="notice-body">Hours, reports, photos, and settings stay private in this web app.</div></div></div></main>';
}

function timesheetView() {
  const sheet = ensureWeek(data, selectedWeek);
  const days = sheet.days.map(function(day, dayIndex) {
    const entries = day.entries.map(function(entry, entryIndex) {
      const base = 'data-day="' + dayIndex + '" data-entry="' + entryIndex + '"';
      return '<div class="entry"><div class="entry-heading"><div class="entry-number">PROJECT ' + (entryIndex + 1) + '</div>' +
        (day.entries.length > 1 ? '<button class="remove" data-action="remove-project" ' + base + '>Remove</button>' : '') + '</div>' +
        field('PROJECT', entry.project, 'class="ts-input input" data-field="project" ' + base + ' placeholder="Project name"', false) +
        '<div class="time-row">' +
        field('START', entry.startTime, 'class="ts-input input" data-field="startTime" ' + base + ' placeholder="7:00 AM"', false) +
        field('END', entry.endTime, 'class="ts-input input" data-field="endTime" ' + base + ' placeholder="3:30 PM"', false) +
        field('HOURS', entry.hours, 'class="ts-input input" data-field="hours" ' + base + ' inputmode="decimal" placeholder="8.0"', false) + '</div>' +
        field('WORK DESCRIPTION / NOTES', entry.notes, 'class="ts-input textarea" data-field="notes" ' + base + ' placeholder="Work performed, location, or notes"', true) + '</div>';
    }).join('');
    return '<section class="day-card"><div class="day-header"><div class="day-name">' + day.day + '</div><div class="date-label">' + day.date + '</div></div>' + entries +
      '<button class="add-project" data-action="add-project" data-day="' + dayIndex + '"><b>＋</b>Add another project</button></section>';
  }).join('');
  return '<main class="page"><div class="kicker">WEEKLY TIMESHEET</div><div class="title-row"><div class="title-copy"><h1 class="page-title">Log the week</h1><p class="subtitle">Add another project only when you need one</p></div><div class="total-badge"><div class="total-value">' + totalHours(sheet).toFixed(2) + '</div><div class="total-label">HOURS</div></div></div>' +
    period('Week of ' + sheet.weekOf, 'week') + days +
    '<section class="export-card"><div class="export-title">Ready to submit?</div><div class="export-body">Creates a landscape PDF using the supplied navy timesheet layout.</div><button class="button" data-action="export-timesheet">Export weekly timesheet PDF</button></section></main>';
}

function dailyView() {
  const report = ensureReport(data, selectedDate);
  const photos = report.photos.map(function(photo, index) {
    return '<section class="photo-card"><img src="' + photo.uri + '" alt="Jobsite photo ' + (index + 1) + '"><div class="photo-body"><div class="photo-head"><div class="photo-number">PHOTO ' + (index + 1) + '</div><button class="remove" data-action="remove-photo" data-photo="' + index + '">Remove</button></div>' +
      field('CAPTION', photo.caption, 'class="photo-caption input" data-photo="' + index + '" placeholder="Location, activity, or condition shown"', false) + '</div></section>';
  }).join('');
  return '<main class="page"><div class="kicker">DAILY PROGRESS REPORT</div><h1 class="page-title">Capture the day</h1><p class="subtitle">Record the work, flag what is next, and attach jobsite photos.</p>' +
    period(report.date, 'date') +
    '<div class="meta-grid">' + field('DATE', report.date, 'disabled', false) + field('PROJECT', report.project, 'class="daily-input input" data-field="project" placeholder="Project name"', false) + '</div>' +
    '<section class="form-section"><div class="form-band">WORK COMPLETED TODAY</div>' + field('DETAILS', report.completed, 'class="daily-input textarea large" data-field="completed" placeholder="Describe completed work, quantities, locations, and crews..."', true, 'large') + '</section>' +
    '<section class="form-section"><div class="form-band">NEXT-DAY LOOK-AHEAD</div>' + field('PLAN', report.lookAhead, 'class="daily-input textarea" data-field="lookAhead" placeholder="What is planned for the next workday?"', true) + '</section>' +
    '<section class="form-section"><div class="dark-label">DELAYS, ISSUES, OR MATERIALS NEEDED</div>' + field('NOTES', report.issues, 'class="daily-input textarea" data-field="issues" placeholder="Safety concerns, delays, inspections, deliveries, or materials..."', true) + '</section>' +
    '<h2 class="section-title">Jobsite photos <span class="card-body">(' + report.photos.length + ')</span></h2><div class="buttons"><button class="button" data-action="camera">● Take photo</button><button class="button secondary" data-action="library">＋ Photo library</button></div>' + photos +
    '<section class="export-card"><div class="export-title">Create the report package</div><div class="export-body">The first page matches the supplied daily report; photos follow on captioned pages.</div><button class="button" data-action="export-daily">Export report + photos as PDF</button></section></main>';
}

function formatTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  if (!match) return 'Example: 17:30 means 5:30 PM';
  const hour = Number(match[1]);
  return (hour % 12 || 12) + ':' + match[2] + ' ' + (hour >= 12 ? 'PM' : 'AM');
}

function settingsView() {
  const settings = data.settings;
  return '<main class="page"><div class="kicker">SETTINGS</div><h1 class="page-title">Your profile</h1><p class="subtitle">Set the name that appears at the top of every exported timesheet and daily progress report.</p>' +
    '<section class="panel settings-card">' + field('NAME', settings.name, 'id="name-setting" placeholder="Enter your full name" autocomplete="name"', false) + '<div class="saved">Changes save automatically on this device.</div></section>' +
    '<section class="preview"><div class="preview-label">EXPORT PREVIEW</div><div class="preview-name">' + esc(settings.name || 'Your Name') + '</div><div class="preview-rule"></div><div class="preview-doc">WEEKLY TIMESHEET / DAILY PROGRESS REPORT</div></section>' +
    '<section class="panel settings-card" style="margin-top:20px"><div class="toggle-row"><div class="toggle-copy"><div class="card-title">Daily reminder</div><div class="card-body">Optional reminder when today’s hours or progress report are incomplete.</div></div><input id="notification-toggle" class="toggle" type="checkbox" ' + (settings.notificationsEnabled ? 'checked' : '') + '></div>' +
    (settings.notificationsEnabled ? '<div class="time-section">' + field('REMINDER TIME (24-HOUR HH:MM)', settings.reminderTime, 'id="reminder-time" maxlength="5" inputmode="numeric" placeholder="17:00"', false) + '<div class="help">' + formatTime(settings.reminderTime) + '</div><div class="card-body" style="margin-top:8px">Web reminders run while FieldLog is open. Fully background reminders require a hosted push service.</div></div>' : '<div class="card-body">Notifications are optional and currently off.</div>') + '</section>' +
    '<section class="panel settings-card" style="margin-top:20px"><div class="card-title">Install FieldLog</div><ol class="install-steps"><li>Open this site in Safari.</li><li>Tap Share.</li><li>Tap Add to Home Screen.</li><li>Turn on Open as Web App, then tap Add.</li></ol></section></main>';
}

function render() {
  ensureWeek(data, selectedWeek);
  ensureReport(data, selectedDate);
  const view = screen === 'timesheet' ? timesheetView() : screen === 'daily' ? dailyView() : screen === 'settings' ? settingsView() : homeView();
  app.innerHTML = '<div class="shell">' + view + nav() + '</div>';
  bind();
}

function bind() {
  document.querySelectorAll('[data-screen]').forEach(function(el) {
    el.addEventListener('click', function() { screen = el.dataset.screen; render(); });
  });
  document.querySelectorAll('.ts-input').forEach(function(el) {
    el.addEventListener('input', function() {
      const sheet = ensureWeek(data, selectedWeek);
      sheet.days[Number(el.dataset.day)].entries[Number(el.dataset.entry)][el.dataset.field] = el.value;
      persist();
    });
  });
  document.querySelectorAll('.daily-input').forEach(function(el) {
    el.addEventListener('input', function() {
      ensureReport(data, selectedDate)[el.dataset.field] = el.value;
      persist();
    });
  });
  document.querySelectorAll('.photo-caption').forEach(function(el) {
    el.addEventListener('input', function() {
      ensureReport(data, selectedDate).photos[Number(el.dataset.photo)].caption = el.value;
      persist();
    });
  });
  const name = document.getElementById('name-setting');
  if (name) name.addEventListener('input', function() {
    data.settings.name = name.value;
    const previewName = document.querySelector('.preview-name');
    if (previewName) previewName.textContent = name.value.trim() || 'Your Name';
    persist();
  });
  const time = document.getElementById('reminder-time');
  if (time) time.addEventListener('input', function() { data.settings.reminderTime = time.value; persist(); configureReminder(); });
  const toggle = document.getElementById('notification-toggle');
  if (toggle) toggle.addEventListener('change', handleNotificationToggle);
  document.querySelectorAll('[data-action]').forEach(function(el) {
    el.addEventListener('click', function() { handleAction(el.dataset.action, el); });
  });
}

function handleAction(action, el) {
  if (action === 'week-previous') { selectedWeek = shiftDate(selectedWeek,-7); render(); }
  if (action === 'week-next') { selectedWeek = shiftDate(selectedWeek,7); render(); }
  if (action === 'week-current') { selectedWeek = currentWeekKey(); render(); }
  if (action === 'date-previous') { selectedDate = shiftDate(selectedDate,-1); render(); }
  if (action === 'date-next') { selectedDate = shiftDate(selectedDate,1); render(); }
  if (action === 'date-current') { selectedDate = currentDateKey(); render(); }
  if (action === 'add-project') {
    ensureWeek(data,selectedWeek).days[Number(el.dataset.day)].entries.push(newEntry()); persist(); render();
  }
  if (action === 'remove-project') {
    ensureWeek(data,selectedWeek).days[Number(el.dataset.day)].entries.splice(Number(el.dataset.entry),1); persist(); render();
  }
  if (action === 'camera') cameraInput.click();
  if (action === 'library') libraryInput.click();
  if (action === 'remove-photo') {
    ensureReport(data,selectedDate).photos.splice(Number(el.dataset.photo),1); persist(); render();
  }
  if (action === 'export-timesheet') {
    if (!data.settings.name.trim()) return alert('Enter your name in Settings before exporting.');
    exportTimesheet(ensureWeek(data,selectedWeek),data.settings.name.trim());
  }
  if (action === 'export-daily') {
    const report = ensureReport(data,selectedDate);
    if (!data.settings.name.trim()) return alert('Enter your name in Settings before exporting.');
    if (!report.project.trim()) return alert('Enter a project name before exporting.');
    exportDailyReport(report,data.settings.name.trim());
  }
}

async function compressPhoto(file) {
  const source = await new Promise(function(resolve,reject) {
    const reader = new FileReader();
    reader.onload = function() { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise(function(resolve,reject) {
    const img = new Image();
    img.onload = function() { resolve(img); };
    img.onerror = reject;
    img.src = source;
  });
  const max = 1600;
  const scale = Math.min(1,max / Math.max(image.width,image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',0.72);
}

async function addPhotos(files) {
  const report = ensureReport(data,selectedDate);
  for (const file of Array.from(files)) {
    try {
      report.photos.push({ id:Date.now().toString(36)+Math.random().toString(36).slice(2), uri:await compressPhoto(file), caption:'' });
    } catch {
      alert('One photo could not be added. Try a JPEG or PNG image.');
    }
  }
  persist();
  cameraInput.value = '';
  libraryInput.value = '';
  render();
}
cameraInput.addEventListener('change',function(){addPhotos(cameraInput.files);});
libraryInput.addEventListener('change',function(){addPhotos(libraryInput.files);});

async function handleNotificationToggle(event) {
  if (!event.target.checked) {
    data.settings.notificationsEnabled = false; persist(); configureReminder(); render(); return;
  }
  if (!('Notification' in window)) {
    alert('This browser does not support web notifications.'); event.target.checked = false; return;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Notification permission was not granted.'); event.target.checked = false; return;
  }
  data.settings.notificationsEnabled = true; persist(); configureReminder(); render();
}

function configureReminder() {
  if (reminderTimer) clearTimeout(reminderTimer);
  if (!data.settings.notificationsEnabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(data.settings.reminderTime || '');
  if (!match) return;
  const now = new Date();
  const next = new Date();
  next.setHours(Number(match[1]),Number(match[2]),0,0);
  if (next <= now) next.setDate(next.getDate()+1);
  reminderTimer = setTimeout(async function() {
    const complete = completionForDate(data,new Date());
    if (!complete.hoursComplete || !complete.reportComplete) {
      const body = !complete.hoursComplete && !complete.reportComplete ? 'Remember to log your hours and complete today’s progress report.' : !complete.hoursComplete ? 'Remember to log today’s hours.' : 'Remember to complete today’s progress report.';
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification('FieldLog reminder',{body,icon:'./icons/icon-192.png'});
      } else {
        new Notification('FieldLog reminder',{body});
      }
    }
    configureReminder();
  },next.getTime()-now.getTime());
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(function(){});
}
configureReminder();
render();
