export const TASK_STATUSES = [
  { value:'todo', label:'To-do', color:'grey' },
  { value:'progress', label:'In Progress', color:'blue' },
  { value:'complete', label:'Complete', color:'green' }
];

export const TASK_PRIORITIES = [
  { value:'low', label:'Low' },
  { value:'medium', label:'Medium' },
  { value:'high', label:'High' },
  { value:'urgent', label:'Urgent' }
];

export function createTask(values) {
  const now = new Date().toISOString();
  return Object.assign({
    id:Date.now().toString(36) + Math.random().toString(36).slice(2),
    title:'',
    project:'',
    status:'todo',
    priority:'medium',
    dueDate:'',
    assignee:'',
    description:'',
    coordination:'',
    archived:false,
    createdAt:now,
    updatedAt:now,
    completedAt:''
  }, values || {});
}

export function normalizeTask(task) {
  return Object.assign(createTask(), task || {}, {
    status:['todo','progress','complete'].includes(task && task.status) ? task.status : 'todo',
    priority:['low','medium','high','urgent'].includes(task && task.priority) ? task.priority : 'medium',
    archived:Boolean(task && task.archived)
  });
}

export function statusLabel(value) {
  const item = TASK_STATUSES.find(function(status) { return status.value === value; });
  return item ? item.label : 'To-do';
}

export function priorityLabel(value) {
  const item = TASK_PRIORITIES.find(function(priority) { return priority.value === value; });
  return item ? item.label : 'Medium';
}

export function isOverdue(task, today) {
  return Boolean(!task.archived && task.status !== 'complete' && task.dueDate && task.dueDate < today);
}

export function isDueSoon(task, today) {
  if (!task.dueDate || task.status === 'complete' || task.archived) return false;
  const due = new Date(task.dueDate + 'T12:00:00');
  const current = new Date(today + 'T12:00:00');
  const difference = Math.round((due-current)/86400000);
  return difference >= 0 && difference <= 3;
}

export function taskCounts(tasks, today) {
  const active = tasks.filter(function(task) { return !task.archived; });
  return {
    total:active.length,
    todo:active.filter(function(task) { return task.status === 'todo'; }).length,
    progress:active.filter(function(task) { return task.status === 'progress'; }).length,
    complete:active.filter(function(task) { return task.status === 'complete'; }).length,
    overdue:active.filter(function(task) { return isOverdue(task,today); }).length,
    backlog:active.filter(function(task) { return task.status !== 'complete' && !task.dueDate; }).length
  };
}

export function projectSummaries(tasks) {
  const groups = new Map();
  tasks.filter(function(task) { return !task.archived && task.project.trim(); }).forEach(function(task) {
    const name = task.project.trim();
    if (!groups.has(name)) groups.set(name,{ project:name,total:0,complete:0,open:0 });
    const group = groups.get(name);
    group.total += 1;
    if (task.status === 'complete') group.complete += 1;
    else group.open += 1;
  });
  return Array.from(groups.values()).map(function(group) {
    group.percent = group.total ? Math.round(group.complete/group.total*100) : 0;
    return group;
  }).sort(function(a,b) { return b.open-a.open || a.project.localeCompare(b.project); });
}

export function sortTasks(tasks, today) {
  const priorityOrder = { urgent:0, high:1, medium:2, low:3 };
  return tasks.slice().sort(function(a,b) {
    const overdueDifference = Number(isOverdue(b,today))-Number(isOverdue(a,today));
    if (overdueDifference) return overdueDifference;
    const completeDifference = Number(a.status === 'complete')-Number(b.status === 'complete');
    if (completeDifference) return completeDifference;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return priorityOrder[a.priority]-priorityOrder[b.priority] || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
}
