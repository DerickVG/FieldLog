const STORE_KEY = 'fieldlog-pwa-data-v1';
const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const defaultEmployees = ['Scott Spiess','Chloe Spiess','Derick Van Gorp','Jacqueline Winne','Josiah Rose','Olessya','Jeff'];

function id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function isoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset()*60000);
  return local.toISOString().slice(0,10);
}

export function parseDate(value) {
  const parts = String(value).split('-').map(Number);
  return new Date(parts[0],(parts[1]||1)-1,parts[2]||1,12);
}

export function startOfWeek(value) {
  const date = new Date(value || new Date());
  const day = date.getDay();
  date.setDate(date.getDate()+(day===0?-6:1-day));
  return date;
}

export function currentDateKey() { return isoDate(new Date()); }
export function currentWeekKey() { return isoDate(startOfWeek(new Date())); }

export function shiftDate(value,days) {
  const date = parseDate(value);
  date.setDate(date.getDate()+days);
  return isoDate(date);
}

export function newEntry() {
  return { id:id(),project:'',startTime:'',endTime:'',hours:'',notes:'' };
}

export function createTimesheet(weekOf) {
  const monday = parseDate(weekOf);
  return {
    weekOf:weekOf,
    days:dayNames.map(function(day,index) {
      const date = new Date(monday);
      date.setDate(monday.getDate()+index);
      return { day:day,date:isoDate(date),entries:[newEntry()] };
    })
  };
}

export function createReport(date) {
  return { date:date,project:'',completed:'',lookAhead:'',issues:'',photos:[] };
}

export function directoryItem(name) {
  return { id:id(),name:String(name||'').trim(),active:true,lastUsed:'' };
}

function initialSettings() {
  return {
    name:'',
    notificationsEnabled:false,
    reminderTime:'17:00',
    employees:defaultEmployees.map(directoryItem),
    jobsites:[],
    directoriesInitialized:true
  };
}

export function createInitialData() {
  const week = currentWeekKey();
  const date = currentDateKey();
  const timesheets = {};
  const reports = {};
  timesheets[week] = createTimesheet(week);
  reports[date] = createReport(date);
  return { timesheets:timesheets,reports:reports,settings:initialSettings(),tasks:[] };
}

function hasContent(entry) {
  return Boolean(entry.project||entry.startTime||entry.endTime||entry.hours||entry.notes);
}

function normalizeDirectory(items,fallback) {
  const source = Array.isArray(items) ? items : fallback;
  return source.map(function(item) {
    if (typeof item === 'string') return directoryItem(item);
    return Object.assign(directoryItem(item && item.name),item||{},{ active:item && item.active === false ? false : true });
  }).filter(function(item) { return item.name; });
}

export function normalizeData(data) {
  const fresh = data || createInitialData();
  fresh.timesheets = fresh.timesheets || {};
  fresh.reports = fresh.reports || {};
  const settings = Object.assign(initialSettings(),fresh.settings||{});
  settings.employees = normalizeDirectory(fresh.settings && fresh.settings.employees,defaultEmployees);
  settings.jobsites = normalizeDirectory(fresh.settings && fresh.settings.jobsites,[]);
  settings.directoriesInitialized = true;
  fresh.settings = settings;
  fresh.tasks = Array.isArray(fresh.tasks) ? fresh.tasks.map(function(task) {
    const normalized = Object.assign({
      id:id(),title:'',project:'',status:'todo',priority:'medium',dueDate:'',
      assignee:'',assignees:[],description:'',coordination:'',archived:false,
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),completedAt:''
    },task||{});
    if (!Array.isArray(normalized.assignees)) normalized.assignees = [];
    if (!normalized.assignees.length && normalized.assignee) normalized.assignees = [normalized.assignee];
    normalized.assignees = normalized.assignees.map(function(name) { return String(name||'').trim(); }).filter(Boolean);
    normalized.assignee = normalized.assignees[0] || '';
    return normalized;
  }) : [];
  Object.keys(fresh.timesheets).forEach(function(key) {
    const sheet = fresh.timesheets[key];
    if (!sheet.days) sheet.days = createTimesheet(key).days;
    sheet.days.forEach(function(day) {
      day.entries = (day.entries||[]).filter(function(entry,index) { return index===0||hasContent(entry); });
      if (!day.entries.length) day.entries = [newEntry()];
    });
  });
  Object.keys(fresh.reports).forEach(function(key) {
    fresh.reports[key] = Object.assign(createReport(key),fresh.reports[key]||{});
    fresh.reports[key].photos = fresh.reports[key].photos || [];
  });
  return fresh;
}

export function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return normalizeData(raw ? JSON.parse(raw) : createInitialData());
  } catch {
    return createInitialData();
  }
}

export function saveData(data) {
  const copy = JSON.parse(JSON.stringify(data));
  Object.values(copy.reports||{}).forEach(function(report) {
    report.photos = (report.photos||[]).map(function(photo) {
      if (photo.stored||photo._mediaStored) return { id:photo.id,caption:photo.caption||'',stored:true };
      return photo;
    });
  });
  localStorage.setItem(STORE_KEY,JSON.stringify(copy));
}

export function ensureWeek(data,key) {
  if (!data.timesheets[key]) data.timesheets[key] = createTimesheet(key);
  return data.timesheets[key];
}

export function ensureReport(data,key) {
  if (!data.reports[key]) data.reports[key] = createReport(key);
  return data.reports[key];
}

export function totalHours(sheet) {
  return sheet.days.reduce(function(total,day) {
    return total+day.entries.reduce(function(sum,entry) { return sum+(Number(entry.hours)||0); },0);
  },0);
}

export function completionForDate(data,date) {
  const dateKey = isoDate(date);
  const weekKey = isoDate(startOfWeek(date));
  const sheet = data.timesheets[weekKey];
  const day = sheet&&sheet.days.find(function(item) { return item.date===dateKey; });
  const hoursComplete = Boolean(day&&day.entries.reduce(function(sum,entry) { return sum+(Number(entry.hours)||0); },0)>0);
  const report = data.reports[dateKey];
  const reportComplete = Boolean(report&&report.project.trim()&&report.completed.trim());
  return { hoursComplete:hoursComplete,reportComplete:reportComplete };
}
