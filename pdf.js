function esc(value) {
  return String(value || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function dateText(value) {
  const p = String(value || '').split('-');
  return p.length === 3 ? p[1] + '/' + p[2] + '/' + p[0] : value;
}

function openPrint(title, extraCss, body) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Allow pop-ups for FieldLog, then try exporting again.');
    return;
  }
  const base = [
    '*{box-sizing:border-box}',
    'body{font-family:Arial,Helvetica,sans-serif;color:#18232e;margin:0}',
    '.brand{background:#25384d;color:#fff;border-radius:12px;padding:16px 20px}',
    '.brand h1{margin:0;font-size:20px;letter-spacing:2px;font-weight:600}',
    '.label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase}',
    '.print-return{position:fixed;z-index:20;right:16px;top:16px;border:0;border-radius:999px;background:#25384d;color:#fff;padding:12px 18px;font:700 14px Arial;box-shadow:0 5px 18px rgba(0,0,0,.2)}',
    '@media print{.print-return{display:none!important}}'
  ].join('');
  win.document.open();
  win.document.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' + esc(title) + '</title><style>' + base + extraCss + '</style></head><body><button id="return-fieldlog" class="print-return" type="button">Return to FieldLog</button>' + body + '</body></html>');
  win.document.close();

  let returned = false;
  function returnToFieldLog() {
    if (returned) return;
    returned = true;
    try { win.close(); } catch {}
    try { window.focus(); } catch {}
  }
  win.document.getElementById('return-fieldlog').addEventListener('click', returnToFieldLog);
  win.addEventListener('afterprint', returnToFieldLog, { once:true });
  setTimeout(function() { win.focus(); win.print(); }, 500);
}
export function exportTimesheet(sheet, employeeName) {
  const totals = new Map();
  sheet.days.forEach(function(day) {
    day.entries.forEach(function(entry) {
      const project = entry.project.trim();
      if (project) totals.set(project, (totals.get(project) || 0) + (Number(entry.hours) || 0));
    });
  });
  const totalRows = Array.from(totals.entries());
  const combined = totalRows.reduce(function(sum, item) { return sum + item[1]; }, 0);
  const rows = sheet.days.map(function(day, dayIndex) {
    return day.entries.map(function(entry, index) {
      return '<tr class="' + (dayIndex % 2 === 0 ? 'shade' : '') + '">' +
        (index === 0 ? '<td rowspan="' + day.entries.length + '" class="day">' + esc(day.day) + '</td><td rowspan="' + day.entries.length + '" class="date">' + dateText(day.date) + '</td>' : '') +
        '<td>' + esc(entry.project) + '</td><td class="center">' + esc(entry.startTime) + '</td><td class="center">' + esc(entry.endTime) + '</td><td class="center">' + esc(entry.hours) + '</td><td>' + esc(entry.notes) + '</td></tr>';
    }).join('');
  }).join('');
  const items = totalRows.length ? totalRows : [['',0]];
  const summary = items.map(function(item, index) {
    return '<div class="summary-row"><span>Project ' + (index + 1) + ':</span><b>' + esc(item[0]) + '</b><strong>' + (item[0] ? item[1].toFixed(2) : '') + '</strong></div>';
  }).join('');
  const css = [
    '@page{size:letter landscape;margin:.3in}',
    'body{font-size:9px}.brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}',
    '.brand span{font-size:9px;letter-spacing:1.2px}table{width:100%;border-collapse:collapse;table-layout:fixed}',
    'th{background:#25384d;color:#fff;padding:8px 4px;font-size:7px;letter-spacing:.8px;text-align:left}',
    'td{border:1px solid #d5dde4;height:24px;padding:4px;vertical-align:middle}.shade{background:#f1f4f6}',
    '.day,.date{width:7%}.project{width:19%}.time{width:7%}.hours{width:8%}.notes{width:45%}.center{text-align:center}',
    '.summary{margin-top:9px;background:#f1f4f6;border-radius:10px;padding:10px 14px;position:relative}',
    '.summary-title{letter-spacing:1.5px;margin-bottom:5px}.summary-row{display:grid;grid-template-columns:80px 300px 80px;gap:10px;min-height:20px;align-items:center}',
    '.summary-row b,.summary-row strong{background:#fff;padding:5px 8px;min-height:20px}.combined{position:absolute;right:16px;bottom:12px;font-weight:700;letter-spacing:1px}'
  ].join('');
  const body = '<div class="brand"><h1>' + esc(employeeName) + ' Timesheet</h1><span>WEEK OF ' + dateText(sheet.weekOf) + '</span></div>' +
    '<table><thead><tr><th class="day">Day</th><th class="date">Date</th><th class="project">Project</th><th class="time">Start Time</th><th class="time">End Time</th><th class="hours">Total Hours</th><th class="notes">Work Description / Notes</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="summary"><div class="summary-title">WEEKLY PROJECT TOTALS</div>' + summary + '<div class="combined">COMBINED TOTAL HOURS: &nbsp; ' + combined.toFixed(2) + '</div></div>';
  openPrint(employeeName + ' Timesheet', css, body);
}

export function exportDailyReport(report, employeeName) {
  const photos = report.photos.map(function(photo, index) {
    return '<section class="photo-page"><div class="photo-head"><span>JOBSITE PHOTO ' + (index + 1) + '</span><span>' + esc(report.project) + '</span></div>' +
      '<div class="photo-caption-print"><b>CAPTION</b><div>' + esc(photo.caption || 'Jobsite progress photo') + '</div></div>' +
      '<img src="' + photo.uri + '" alt="Jobsite photo ' + (index + 1) + '"></section>';
  }).join('');
  const css = [
    '@page{size:letter portrait;margin:0}',
    '.report-page{height:11in;padding:.45in;position:relative;overflow:hidden;page-break-after:always;break-after:page}.report-page:last-child{page-break-after:auto}.brand{margin-bottom:14px}',
    '.meta{display:grid;grid-template-columns:1fr 2.7fr;gap:16px;margin-bottom:14px}.field-label{display:block;margin-bottom:7px;font-size:10px;font-weight:700;letter-spacing:1.6px}',
    '.field{border:1px solid #d6dee5;min-height:36px;padding:10px;font-size:12px}.section{margin-top:12px}',
    '.section-title{background:#25384d;color:#fff;border-radius:8px 8px 0 0;padding:9px 13px;font-size:10px;font-weight:700;letter-spacing:1.6px}',
    '.section-body{border:1px solid #d6dee5;height:2.15in;padding:13px;white-space:pre-wrap;overflow:hidden;font-size:12px;line-height:1.48}.compact .section-title{background:#fff;color:#18232e;padding-left:0}.compact .section-body{height:1.05in}',
    '.look-ahead .section-body{height:1.25in}',
    '.photo-page{height:11in;padding:.45in;page-break-before:always;break-before:page;break-inside:avoid;overflow:hidden;display:flex;flex-direction:column}',
    '.photo-head{flex:none;background:#25384d;color:#fff;border-radius:10px;padding:14px 18px;display:flex;justify-content:space-between;font-size:10px;letter-spacing:1.3px}',
    '.photo-caption-print{flex:none;border-left:4px solid #d18a4a;margin:14px 0 12px;padding:9px 14px;font-size:11px;line-height:1.45;background:#f5f7f8}',
    '.photo-caption-print b{display:block;font-size:9px;letter-spacing:1.4px;margin-bottom:4px;color:#536474}',
    '.photo-page img{display:block;width:100%;height:100%;min-height:0;object-fit:contain;background:#f1f4f6}'
  ].join('');
  const body = '<section class="report-page"><div class="brand"><h1>' + esc(employeeName) + ' Daily Progress Report</h1></div>' +
    '<div class="meta"><div><span class="field-label">DATE</span><div class="field">' + dateText(report.date) + '</div></div><div><span class="field-label">PROJECT</span><div class="field">' + esc(report.project) + '</div></div></div>' +
    '<div class="section"><div class="section-title">WORK COMPLETED TODAY</div><div class="section-body">' + esc(report.completed) + '</div></div>' +
    '<div class="section look-ahead"><div class="section-title">NEXT-DAY LOOK-AHEAD</div><div class="section-body">' + esc(report.lookAhead) + '</div></div>' +
    '<div class="section compact"><div class="section-title">DELAYS, ISSUES, OR MATERIALS NEEDED</div><div class="section-body">' + esc(report.issues) + '</div></div></section>' + photos;
  openPrint(employeeName + ' Daily Progress Report', css, body);
}

export function exportTaskPlan(tasks, scope) {
  const today = new Date();
  const todayKey = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');
  const rows = tasks.map(function(task) {
    const overdue = task.status !== 'complete' && task.dueDate && task.dueDate < todayKey;
    const status = task.status === 'progress' ? 'In Progress' : task.status === 'complete' ? 'Complete' : 'To-do';
    const details = [task.description,task.coordination ? 'Coordination: ' + task.coordination : ''].filter(Boolean).join(' · ');
    return '<tr><td><b>' + esc(task.project) + '</b></td><td><strong>' + esc(task.title) + '</strong><small>' + esc(details) + '</small></td><td><span class="status ' + task.status + '">' + status + '</span></td><td class="priority ' + task.priority + '">' + esc(task.priority) + '</td><td class="' + (overdue ? 'overdue' : '') + '">' + (task.dueDate ? dateText(task.dueDate) : 'Backlog') + '</td><td>' + esc(task.assignee || 'Unassigned') + '</td></tr>';
  }).join('');
  const open = tasks.filter(function(task) { return task.status !== 'complete'; }).length;
  const complete = tasks.length-open;
  const css = [
    '@page{size:letter landscape;margin:0}',
    'body{font-size:9px}.task-print-page{height:8.5in;padding:.35in;overflow:hidden}',
    '.brand{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.brand span{font-size:9px;letter-spacing:1.2px}',
    '.summary{display:flex;gap:8px;margin-bottom:10px}.summary div{background:#eef2f4;border-radius:8px;padding:8px 12px;font-weight:700}.summary b{color:#25384d;font-size:14px;margin-right:5px}',
    'table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#25384d;color:#fff;text-align:left;padding:8px 7px;font-size:7px;letter-spacing:.9px}',
    'td{border:1px solid #d7dfe5;padding:7px;vertical-align:top;line-height:1.35}tr:nth-child(even){background:#f6f8f9}td:nth-child(1){width:15%}td:nth-child(2){width:39%}td:nth-child(3){width:11%}td:nth-child(4){width:9%}td:nth-child(5){width:11%}td:nth-child(6){width:15%}',
    'td strong{display:block;font-size:10px;margin-bottom:3px}td small{display:block;color:#647482;font-size:7px}.status{display:inline-block;border-radius:999px;padding:4px 7px;font-weight:700}.status.todo{background:#e7ebee;color:#52616d}.status.progress{background:#dbeafb;color:#2767a8}.status.complete{background:#deefe5;color:#2d7451}',
    '.priority{text-transform:uppercase;font-size:7px;font-weight:800}.priority.urgent{color:#a43632}.priority.high{color:#bd662c}.overdue{color:#b43834;font-weight:800}'
  ].join('');
  const body = '<section class="task-print-page"><div class="brand"><h1>Renaissance Task Tracker</h1><span>' + esc(scope) + ' · ' + dateText(todayKey) + '</span></div><div class="summary"><div><b>' + tasks.length + '</b> TASKS SHOWN</div><div><b>' + open + '</b> OPEN</div><div><b>' + complete + '</b> COMPLETE</div></div><table><thead><tr><th>PROJECT / JOBSITE</th><th>TASK / DETAILS</th><th>STATUS</th><th>PRIORITY</th><th>DUE</th><th>ASSIGNED TO</th></tr></thead><tbody>' + rows + '</tbody></table></section>';
  openPrint('Renaissance Task Tracker',css,body);
}
