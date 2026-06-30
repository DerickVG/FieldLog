import {
  loadData, saveData, ensureWeek, ensureReport, currentDateKey, currentWeekKey,
  shiftDate, newEntry, totalHours, completionForDate, parseDate
} from './data.js';
import { exportTimesheet, exportDailyReport, exportTaskPlan } from './pdf.js';
import { openPhotoEditor } from './markup.js';
import { TASK_STATUSES, TASK_PRIORITIES, createTask, statusLabel, priorityLabel, isOverdue, isDueSoon, taskCounts, projectSummaries, sortTasks } from './tasks.js';

let data = loadData();
let screen = 'home';
let selectedWeek = currentWeekKey();
let selectedDate = currentDateKey();
let taskFilters = { search:'', project:'all', status:'open', priority:'all' };
let taskFormOpen = false;
let editingTaskId = null;
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

function parseWorkTime(value) {
  const match = String(value || '').trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3] || '';
  if (minute > 59 || hour > (meridiem ? 12 : 23) || hour < 0) return null;
  const originalHour = hour;
  if (meridiem) {
    hour = hour % 12;
    if (meridiem === 'pm') hour += 12;
  }
  return { minutes:hour*60+minute, meridiem:meridiem, hour:originalHour };
}

function calculateWorkHours(startValue, endValue) {
  const start = parseWorkTime(startValue);
  const end = parseWorkTime(endValue);
  if (!start || !end) return null;
  let endMinutes = end.minutes;
  if (!start.meridiem && !end.meridiem && start.hour <= 12 && end.hour <= 12 && endMinutes <= start.minutes) endMinutes += 12*60;
  if (endMinutes <= start.minutes) endMinutes += 24*60;
  const hours = (endMinutes-start.minutes)/60;
  return hours > 0 && hours <= 24 ? Math.round(hours*100)/100 : null;
}

function period(label, kind) {
  return '<div class="period"><button data-action="' + kind + '-previous">‹</button><div class="period-center"><div class="period-label">' + esc(label) + '</div><button class="period-current" data-action="' + kind + '-current">GO TO CURRENT</button></div><button data-action="' + kind + '-next">›</button></div>';
}

function nav() {
  const items = [
    ['home','⌂','Home'],['timesheet','▦','Timesheet'],['daily','▤','Report'],['tasks','✓','Tasks'],['settings','⚙','Settings']
  ];
  return '<nav class="bottom-nav">' + items.map(function(item) {
    return '<button class="nav-item ' + (screen === item[0] ? 'active' : '') + '" data-screen="' + item[0] + '"><span class="nav-icon">' + item[1] + '</span><span>' + item[2] + '</span></button>';
  }).join('') + '</nav>';
}

function homeView() {
  const dashboardTaskCounts = taskCounts(data.tasks || [], currentDateKey());
  const sheet = ensureWeek(data, selectedWeek);
  const report = ensureReport(data, selectedDate);
  const started = Boolean(report.project || report.completed || report.photos.length);
  return '<main class="page"><div class="kicker">FIELDLOG</div><h1 class="page-title">Renaissance</h1><p class="subtitle">Timesheets, task planning, daily reports, and jobsite photos in one place.</p>' +
    '<section class="hero"><div class="hero-label">SELECTED WEEK</div><div class="hero-value">' + totalHours(sheet).toFixed(2) + '</div><div class="hero-unit">hours logged</div><div class="hero-rule"></div><div class="hero-meta">Week of ' + esc(sheet.weekOf) + '</div></section>' +
    '<h2 class="section-title">Your paperwork</h2>' +
    '<div class="card-link" data-screen="timesheet"><div class="card-icon">▦</div><div class="card-copy"><div class="card-title">Weekly timesheet</div><div class="card-body">Add only the projects you worked on each day</div></div><div class="arrow">›</div></div>' +
    '<div class="card-link" data-screen="daily"><div class="card-icon warm">▤</div><div class="card-copy"><div class="card-title">Daily progress report</div><div class="card-body">' + (started ? report.photos.length + ' photos · draft saved' : 'Start the selected day’s field report') + '</div></div><div class="arrow">›</div></div>' +
    '<div class="card-link" data-screen="tasks"><div class="card-icon task-icon">✓</div><div class="card-copy"><div class="card-title">Task Tracker</div><div class="card-body">' + (dashboardTaskCounts.todo + dashboardTaskCounts.progress) + ' open · ' + dashboardTaskCounts.overdue + ' overdue across jobsites</div></div><div class="arrow">›</div></div>' +
    '<div class="card-link" data-screen="settings"><div class="card-icon green">⚙</div><div class="card-copy"><div class="card-title">Settings</div><div class="card-body">' + esc(data.settings.name || 'Set the name used on exported reports') + '</div></div><div class="arrow">›</div></div>' +
    '<div class="notice"><div class="notice-mark">✓</div><div><div class="notice-title">Saved on this device</div><div class="notice-body">Hours, tasks, reports, photos, and settings stay private in this web app.</div></div></div></main>';
}

function timesheetView() {
  const sheet = ensureWeek(data, selectedWeek);
  sheet.days.forEach(function(day) {
    day.entries.forEach(function(entry) {
      const hours = calculateWorkHours(entry.startTime,entry.endTime);
      if (hours !== null) entry.hours = hours.toFixed(2);
    });
  });
  const days = sheet.days.map(function(day, dayIndex) {
    const entries = day.entries.map(function(entry, entryIndex) {
      const base = 'data-day="' + dayIndex + '" data-entry="' + entryIndex + '"';
      return '<div class="entry"><div class="entry-heading"><div class="entry-number">PROJECT ' + (entryIndex + 1) + '</div>' +
        (day.entries.length > 1 ? '<button class="remove" data-action="remove-project" ' + base + '>Remove</button>' : '') + '</div>' +
        field('PROJECT', entry.project, 'class="ts-input input" data-field="project" ' + base + ' placeholder="Project name"', false) +
        '<div class="time-row">' +
        field('START', entry.startTime, 'class="ts-input input" data-field="startTime" ' + base + ' placeholder="7:00 AM"', false) +
        field('END', entry.endTime, 'class="ts-input input" data-field="endTime" ' + base + ' placeholder="3:30 PM"', false) +
        field('HOURS', entry.hours, 'class="ts-input input hours-auto" data-field="hours" ' + base + ' inputmode="decimal" placeholder="Auto" readonly title="Calculated from Start and End times"', false) + '</div>' +
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
    return '<section class="photo-card"><button type="button" class="photo-edit-target" data-action="edit-photo" data-photo="' + index + '" aria-label="Mark up jobsite photo ' + (index + 1) + '"><img src="' + photo.uri + '" alt="Jobsite photo ' + (index + 1) + '"><span>Tap photo to mark up</span></button><div class="photo-body"><div class="photo-head"><div class="photo-number">PHOTO ' + (index + 1) + '</div><div class="photo-head-actions"><button class="edit-photo" data-action="edit-photo" data-photo="' + index + '">Mark up</button><button class="remove" data-action="remove-photo" data-photo="' + index + '">Remove</button></div></div>' +
      field('CAPTION', photo.caption, 'class="photo-caption input" data-photo="' + index + '" placeholder="Location, activity, or condition shown"', false) + '</div></section>';
  }).join('');
  return '<main class="page"><div class="kicker">DAILY PROGRESS REPORT</div><h1 class="page-title">Capture the day</h1><p class="subtitle">Record the work, flag what is next, and attach jobsite photos.</p>' +
    period(report.date, 'date') +
    '<div class="meta-grid">' + field('DATE', report.date, 'disabled', false) + field('PROJECT', report.project, 'class="daily-input input" data-field="project" placeholder="Project name"', false) + '</div>' +
    '<section class="form-section"><div class="form-band">WORK COMPLETED TODAY</div>' + field('DETAILS', report.completed, 'class="daily-input textarea large" data-field="completed" placeholder="Describe completed work, quantities, locations, and crews..."', true, 'large') + '</section>' +
    '<section class="form-section"><div class="form-band">NEXT-DAY LOOK-AHEAD</div>' + field('PLAN', report.lookAhead, 'class="daily-input textarea" data-field="lookAhead" placeholder="What is planned for the next workday?"', true) + '</section>' +
    '<section class="form-section"><div class="dark-label">DELAYS, ISSUES, OR MATERIALS NEEDED</div>' + field('NOTES', report.issues, 'class="daily-input textarea" data-field="issues" placeholder="Safety concerns, delays, inspections, deliveries, or materials..."', true) + '</section>' +
    '<h2 class="section-title">Jobsite photos <span class="card-body">(' + report.photos.length + ')</span></h2><div class="buttons"><button class="button" data-action="camera">● Take photo</button><button class="button secondary" data-action="library">＋ Photo library</button></div>' + photos +
    '<section class="export-card"><div class="export-title">Create the report package</div><div class="export-body">The full report stays on page one; each photo follows with its caption directly above it.</div><button class="button" data-action="export-daily">Export report + photos as PDF</button></section></main>';
}

function formatTime(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '');
  if (!match) return 'Example: 17:30 means 5:30 PM';
  const hour = Number(match[1]);
  return (hour % 12 || 12) + ':' + match[2] + ' ' + (hour >= 12 ? 'PM' : 'AM');
}

function taskOptions(items, selected) {
  return items.map(function(item) {
    return '<option value="' + item.value + '" ' + (item.value === selected ? 'selected' : '') + '>' + esc(item.label) + '</option>';
  }).join('');
}

function taskDateLabel(value) {
  if (!value) return 'No due date';
  return parseDate(value).toLocaleDateString(undefined,{ month:'short', day:'numeric', year:'numeric' });
}

function filteredTasks() {
  const today = currentDateKey();
  const search = taskFilters.search.trim().toLowerCase();
  const filtered = (data.tasks || []).filter(function(task) {
    if (taskFilters.status === 'archived') {
      if (!task.archived) return false;
    } else if (task.archived) return false;
    if (taskFilters.project !== 'all' && task.project !== taskFilters.project) return false;
    if (taskFilters.priority !== 'all' && task.priority !== taskFilters.priority) return false;
    if (taskFilters.status === 'open' && task.status === 'complete') return false;
    if (['todo','progress','complete'].includes(taskFilters.status) && task.status !== taskFilters.status) return false;
    if (taskFilters.status === 'overdue' && !isOverdue(task,today)) return false;
    if (taskFilters.status === 'due-soon' && !isDueSoon(task,today)) return false;
    if (taskFilters.status === 'backlog' && (task.status === 'complete' || task.dueDate)) return false;
    if (search) {
      const haystack = [task.title,task.project,task.assignee,task.description,task.coordination].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
  return sortTasks(filtered,today);
}

function taskFormView() {
  if (!taskFormOpen) return '';
  const existing = editingTaskId ? (data.tasks || []).find(function(task) { return task.id === editingTaskId; }) : null;
  const task = existing || createTask();
  const projects = Array.from(new Set((data.tasks || []).map(function(item) { return item.project.trim(); }).filter(Boolean))).sort();
  const projectOptions = projects.map(function(project) { return '<option value="' + esc(project) + '"></option>'; }).join('');
  return '<form id="task-editor-form" class="task-editor panel"><div class="task-editor-head"><div><div class="kicker">' + (existing ? 'EDIT TASK' : 'QUICK CAPTURE') + '</div><h2>' + (existing ? 'Update jobsite task' : 'Add work that needs attention') + '</h2></div><button type="button" class="task-close" data-action="cancel-task-form" aria-label="Close task form">×</button></div>' +
    '<label class="field"><span>TASK NAME</span><input class="input" name="title" value="' + esc(task.title) + '" placeholder="What needs to be done?" required></label>' +
    '<label class="field"><span>PROJECT / JOBSITE</span><input class="input" name="project" list="task-projects" value="' + esc(task.project) + '" placeholder="Choose or enter a project" required><datalist id="task-projects">' + projectOptions + '</datalist></label>' +
    '<div class="task-form-grid"><label class="field"><span>STATUS</span><select class="input task-form-status" name="status">' + taskOptions(TASK_STATUSES,task.status) + '</select></label>' +
    '<label class="field"><span>PRIORITY</span><select class="input" name="priority">' + taskOptions(TASK_PRIORITIES,task.priority) + '</select></label></div>' +
    '<div class="task-form-grid"><label class="field"><span>DUE DATE <small>OPTIONAL</small></span><input class="input" type="date" name="dueDate" value="' + esc(task.dueDate) + '"></label>' +
    '<label class="field"><span>ASSIGNED TO <small>OPTIONAL</small></span><input class="input" name="assignee" value="' + esc(task.assignee) + '" placeholder="Employee or crew"></label></div>' +
    '<label class="field"><span>WORK DETAILS</span><textarea class="textarea" name="description" placeholder="Scope, location, materials, or expected result">' + esc(task.description) + '</textarea></label>' +
    '<label class="field"><span>COORDINATION / WAITING ON <small>OPTIONAL</small></span><textarea class="textarea compact-textarea" name="coordination" placeholder="Delivery, inspection, another trade, access, or decision needed">' + esc(task.coordination) + '</textarea></label>' +
    '<div class="task-editor-actions">' + (existing ? '<button type="button" class="button danger" data-action="delete-task" data-task="' + task.id + '">Delete</button>' : '') + '<button type="button" class="button secondary" data-action="cancel-task-form">Cancel</button><button class="button" type="submit">' + (existing ? 'Save changes' : 'Add task') + '</button></div></form>';
}

function taskDueMarkup(task, today) {
  if (isOverdue(task,today)) return '<span class="task-due overdue">OVERDUE · ' + taskDateLabel(task.dueDate) + '</span>';
  if (isDueSoon(task,today)) return '<span class="task-due soon">DUE SOON · ' + taskDateLabel(task.dueDate) + '</span>';
  if (task.dueDate) return '<span class="task-due">DUE ' + taskDateLabel(task.dueDate) + '</span>';
  return '<span class="task-due backlog">BACKLOG · NO DUE DATE</span>';
}

function taskCardView(task, today) {
  const statusOptions = taskOptions(TASK_STATUSES,task.status);
  const priorityOptions = taskOptions(TASK_PRIORITIES,task.priority);
  const description = task.description ? '<div class="task-description">' + esc(task.description).replace(/\n/g,'<br>') + '</div>' : '';
  const coordination = task.coordination ? '<div class="coordination-note"><b>COORDINATION</b><span>' + esc(task.coordination).replace(/\n/g,'<br>') + '</span></div>' : '';
  return '<article class="task-card status-' + task.status + (task.archived ? ' archived' : '') + '">' +
    '<div class="task-card-top"><div class="task-project">' + esc(task.project || 'Unassigned project') + '</div><select aria-label="Task status" class="task-status-select status-' + task.status + '" data-task-status="' + task.id + '">' + statusOptions + '</select></div>' +
    '<h3>' + esc(task.title || 'Untitled task') + '</h3><div class="task-tags"><select aria-label="Task priority" class="task-priority-select priority-' + task.priority + '" data-task-priority="' + task.id + '">' + priorityOptions + '</select>' + taskDueMarkup(task,today) + '</div>' +
    (task.assignee ? '<div class="task-assignee">ASSIGNED TO <b>' + esc(task.assignee) + '</b></div>' : '<div class="task-assignee unassigned">NOT YET ASSIGNED</div>') +
    description + coordination +
    '<div class="task-card-actions"><button data-action="edit-task" data-task="' + task.id + '">Edit details</button><button data-action="archive-task" data-task="' + task.id + '">' + (task.archived ? 'Restore' : 'Archive') + '</button></div></article>';
}

function tasksView() {
  const today = currentDateKey();
  const allTasks = data.tasks || [];
  const counts = taskCounts(allTasks,today);
  const projects = Array.from(new Set(allTasks.filter(function(task) { return !task.archived && task.project.trim(); }).map(function(task) { return task.project.trim(); }))).sort();
  const visibleTasks = filteredTasks();
  const summaries = projectSummaries(allTasks);
  const projectOptions = '<option value="all">All jobsites</option>' + projects.map(function(project) { return '<option value="' + esc(project) + '" ' + (taskFilters.project === project ? 'selected' : '') + '>' + esc(project) + '</option>'; }).join('');
  const statusFilters = [
    ['open','Open work'],['all','All active'],['todo','To-do'],['progress','In Progress'],['complete','Complete'],['overdue','Overdue'],['due-soon','Due soon'],['backlog','Backlog'],['archived','Archived']
  ].map(function(item) { return '<option value="' + item[0] + '" ' + (taskFilters.status === item[0] ? 'selected' : '') + '>' + item[1] + '</option>'; }).join('');
  const priorityFilters = '<option value="all">All priorities</option>' + TASK_PRIORITIES.map(function(item) { return '<option value="' + item.value + '" ' + (taskFilters.priority === item.value ? 'selected' : '') + '>' + item.label + '</option>'; }).join('');
  const overview = summaries.map(function(summary) {
    return '<button class="project-summary" data-task-project="' + esc(summary.project) + '"><div><b>' + esc(summary.project) + '</b><span>' + summary.open + ' open · ' + summary.complete + ' complete</span></div><strong>' + summary.percent + '%</strong><i><span style="width:' + summary.percent + '%"></span></i></button>';
  }).join('');
  const cards = visibleTasks.map(function(task) { return taskCardView(task,today); }).join('');
  return '<main class="page task-page"><div class="kicker">TASK TRACKER</div><h1 class="page-title">Coordinate every jobsite</h1><p class="subtitle">Capture work, assign responsibility, track deadlines, and see what needs attention across projects.</p>' +
    '<div class="task-command"><button class="button" data-action="add-task">＋ Add task</button><button class="button secondary" data-action="export-tasks">Export plan</button></div>' +
    '<section class="task-stats"><button data-task-filter-status="open"><b>' + (counts.todo+counts.progress) + '</b><span>OPEN</span></button><button data-task-filter-status="progress"><b>' + counts.progress + '</b><span>IN PROGRESS</span></button><button data-task-filter-status="overdue" class="' + (counts.overdue ? 'attention' : '') + '"><b>' + counts.overdue + '</b><span>OVERDUE</span></button><button data-task-filter-status="backlog"><b>' + counts.backlog + '</b><span>BACKLOG</span></button></section>' +
    (counts.overdue ? '<div class="task-alert"><b>' + counts.overdue + ' task' + (counts.overdue === 1 ? '' : 's') + ' need immediate attention.</b><span>Review overdue work before planning today’s crew assignments.</span></div>' : '') +
    taskFormView() +
    '<form id="task-filter-form" class="task-filters panel"><div class="task-search-row"><input id="task-search" class="input" value="' + esc(taskFilters.search) + '" placeholder="Search task, jobsite, or assignee"><button class="button" type="submit">Search</button></div><div class="task-filter-grid"><select class="input task-filter" data-task-filter="project">' + projectOptions + '</select><select class="input task-filter" data-task-filter="status">' + statusFilters + '</select><select class="input task-filter" data-task-filter="priority">' + priorityFilters + '</select></div><button type="button" class="task-reset" data-action="reset-task-filters">Reset filters</button></form>' +
    (overview ? '<h2 class="section-title">Project overview</h2><div class="project-summary-list">' + overview + '</div>' : '') +
    '<div class="task-list-head"><h2 class="section-title">Work plan</h2><span>' + visibleTasks.length + ' shown</span></div>' +
    (cards || '<div class="task-empty"><div>✓</div><h3>No tasks match this view</h3><p>Add a task or change the filters to see more work.</p></div>') + '</main>';
}

function saveTaskForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = {
    title:form.elements.title.value.trim(),
    project:form.elements.project.value.trim(),
    status:form.elements.status.value,
    priority:form.elements.priority.value,
    dueDate:form.elements.dueDate.value,
    assignee:form.elements.assignee.value.trim(),
    description:form.elements.description.value.trim(),
    coordination:form.elements.coordination.value.trim()
  };
  if (!values.title) return alert('Enter what needs to be done.');
  if (!values.project) return alert('Enter the project or jobsite.');
  const now = new Date().toISOString();
  if (editingTaskId) {
    const task = data.tasks.find(function(item) { return item.id === editingTaskId; });
    if (task) Object.assign(task,values,{ updatedAt:now, completedAt:values.status === 'complete' ? (task.completedAt || now) : '' });
  } else {
    data.tasks.unshift(createTask(Object.assign(values,{ completedAt:values.status === 'complete' ? now : '' })));
  }
  persist();
  taskFormOpen = false;
  editingTaskId = null;
  render();
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
  const view = screen === 'timesheet' ? timesheetView() : screen === 'daily' ? dailyView() : screen === 'tasks' ? tasksView() : screen === 'settings' ? settingsView() : homeView();
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
      const dayIndex = Number(el.dataset.day);
      const entryIndex = Number(el.dataset.entry);
      const entry = sheet.days[dayIndex].entries[entryIndex];
      entry[el.dataset.field] = el.value;
      if (el.dataset.field === 'startTime' || el.dataset.field === 'endTime') {
        const calculated = calculateWorkHours(entry.startTime,entry.endTime);
        entry.hours = calculated === null ? '' : calculated.toFixed(2);
        const hoursInput = document.querySelector('.ts-input[data-day="' + dayIndex + '"][data-entry="' + entryIndex + '"][data-field="hours"]');
        if (hoursInput) hoursInput.value = entry.hours;
      }
      const total = document.querySelector('.total-value');
      if (total) total.textContent = totalHours(sheet).toFixed(2);
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
  const taskEditorForm = document.getElementById('task-editor-form');
  if (taskEditorForm) taskEditorForm.addEventListener('submit', saveTaskForm);
  const taskFilterForm = document.getElementById('task-filter-form');
  if (taskFilterForm) taskFilterForm.addEventListener('submit', function(event) {
    event.preventDefault();
    taskFilters.search = document.getElementById('task-search').value;
    render();
  });
  document.querySelectorAll('.task-filter').forEach(function(el) {
    el.addEventListener('change',function() {
      taskFilters[el.dataset.taskFilter] = el.value;
      render();
    });
  });
  document.querySelectorAll('[data-task-filter-status]').forEach(function(el) {
    el.addEventListener('click',function() {
      taskFilters.status = el.dataset.taskFilterStatus;
      render();
    });
  });
  document.querySelectorAll('[data-task-project]').forEach(function(el) {
    el.addEventListener('click',function() {
      taskFilters.project = el.dataset.taskProject;
      taskFilters.status = 'open';
      render();
    });
  });
  document.querySelectorAll('[data-task-status]').forEach(function(el) {
    el.addEventListener('change',function() {
      const task = data.tasks.find(function(item) { return item.id === el.dataset.taskStatus; });
      if (!task) return;
      task.status = el.value;
      task.updatedAt = new Date().toISOString();
      task.completedAt = task.status === 'complete' ? (task.completedAt || task.updatedAt) : '';
      persist();
      render();
    });
  });
  document.querySelectorAll('[data-task-priority]').forEach(function(el) {
    el.addEventListener('change',function() {
      const task = data.tasks.find(function(item) { return item.id === el.dataset.taskPriority; });
      if (!task) return;
      task.priority = el.value;
      task.updatedAt = new Date().toISOString();
      persist();
      render();
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
  if (action === 'edit-photo') editPhoto(Number(el.dataset.photo));
  if (action === 'remove-photo') {
    ensureReport(data,selectedDate).photos.splice(Number(el.dataset.photo),1); persist(); render();
  }
  if (action === 'add-task') {
    editingTaskId = null;
    taskFormOpen = true;
    render();
  }
  if (action === 'cancel-task-form') {
    editingTaskId = null;
    taskFormOpen = false;
    render();
  }
  if (action === 'edit-task') {
    editingTaskId = el.dataset.task;
    taskFormOpen = true;
    render();
  }
  if (action === 'delete-task') {
    const task = data.tasks.find(function(item) { return item.id === el.dataset.task; });
    if (task && confirm('Delete "' + task.title + '"? This cannot be undone.')) {
      data.tasks = data.tasks.filter(function(item) { return item.id !== task.id; });
      editingTaskId = null;
      taskFormOpen = false;
      persist();
      render();
    }
  }
  if (action === 'archive-task') {
    const task = data.tasks.find(function(item) { return item.id === el.dataset.task; });
    if (task) {
      task.archived = !task.archived;
      task.updatedAt = new Date().toISOString();
      persist();
      render();
    }
  }
  if (action === 'reset-task-filters') {
    taskFilters = { search:'', project:'all', status:'open', priority:'all' };
    render();
  }
  if (action === 'export-tasks') {
    const tasks = filteredTasks();
    if (!tasks.length) return alert('There are no tasks in the current view to export.');
    exportTaskPlan(tasks, taskFilters.project === 'all' ? 'All Jobsites' : taskFilters.project);
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

async function editPhoto(index) {
  const photo = ensureReport(data, selectedDate).photos[index];
  if (!photo) return;
  try {
    const baseUri = photo.baseUri || photo.uri;
    const edited = await openPhotoEditor({ source:baseUri, actions:photo.markup || [] });
    if (!edited) return;
    photo.baseUri = baseUri;
    photo.uri = edited.uri;
    photo.markup = edited.actions;
    persist();
    render();
  } catch {
    alert('The photo could not be opened for editing.');
  }
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
