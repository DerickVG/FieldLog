const STORE_KEY = 'fieldlog-pwa-data-v1';
const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

export function isoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function parseDate(value) {
  const parts = String(value).split('-').map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 12);
}

export function startOfWeek(value) {
  const date = new Date(value || new Date());
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

export function currentDateKey() { return isoDate(new Date()); }
export function currentWeekKey() { return isoDate(startOfWeek(new Date())); }

export function shiftDate(value, days) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

export function newEntry() {
  return { id: Math.random().toString(36).slice(2) + Date.now().toString(36), project:'', startTime:'', endTime:'', hours:'', notes:'' };
}

export function createTimesheet(weekOf) {
  const monday = parseDate(weekOf);
  return {
    weekOf,
    days: dayNames.map(function(day, index) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      return { day, date: isoDate(date), entries: [newEntry()] };
    })
  };
}

export function createReport(date) {
  return { date, project:'', completed:'', lookAhead:'', issues:'', photos:[] };
}

export function createInitialData() {
  const week = currentWeekKey();
  const date = currentDateKey();
  const timesheets = {};
  const reports = {};
  timesheets[week] = createTimesheet(week);
  reports[date] = createReport(date);
  return {
    timesheets,
    reports,
    settings: { name:'', notificationsEnabled:false, reminderTime:'17:00' },
    tasks: []
  };
}

function hasContent(entry) {
  return Boolean(entry.project || entry.startTime || entry.endTime || entry.hours || entry.notes);
}

function normalize(data) {
  const fresh = data || createInitialData();
  fresh.timesheets = fresh.timesheets || {};
  fresh.reports = fresh.reports || {};
  fresh.settings = Object.assign({ name:'', notificationsEnabled:false, reminderTime:'17:00' }, fresh.settings || {});
  fresh.tasks = Array.isArray(fresh.tasks) ? fresh.tasks.map(function(task) {
    return Object.assign({ id:Math.random().toString(36).slice(2)+Date.now().toString(36), title:'', project:'', status:'todo', priority:'medium', dueDate:'', assignee:'', description:'', coordination:'', archived:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), completedAt:'' }, task || {});
  }) : [];
  Object.keys(fresh.timesheets).forEach(function(key) {
    fresh.timesheets[key].days.forEach(function(day) {
      day.entries = (day.entries || []).filter(function(entry, index) { return index === 0 || hasContent(entry); });
      if (!day.entries.length) day.entries = [newEntry()];
    });
  });
  return fresh;
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return normalize(raw ? JSON.parse(raw) : createInitialData());
  } catch {
    return createInitialData();
  }
}

export function saveData(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

export function ensureWeek(data, key) {
  if (!data.timesheets[key]) data.timesheets[key] = createTimesheet(key);
  return data.timesheets[key];
}

export function ensureReport(data, key) {
  if (!data.reports[key]) data.reports[key] = createReport(key);
  return data.reports[key];
}

export function totalHours(sheet) {
  return sheet.days.reduce(function(total, day) {
    return total + day.entries.reduce(function(sum, entry) { return sum + (Number(entry.hours) || 0); }, 0);
  }, 0);
}

export function completionForDate(data, date) {
  const dateKey = isoDate(date);
  const weekKey = isoDate(startOfWeek(date));
  const sheet = data.timesheets[weekKey];
  const day = sheet && sheet.days.find(function(item) { return item.date === dateKey; });
  const hoursComplete = Boolean(day && day.entries.reduce(function(sum, entry) { return sum + (Number(entry.hours) || 0); }, 0) > 0);
  const report = data.reports[dateKey];
  const reportComplete = Boolean(report && report.project.trim() && report.completed.trim());
  return { hoursComplete, reportComplete };
}
