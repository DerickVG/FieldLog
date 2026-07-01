import { PDFDocument, StandardFonts, rgb } from './vendor/pdf-lib.js';

const NAVY = rgb(0.145,0.22,0.30);
const INK = rgb(0.09,0.14,0.18);
const MUTED = rgb(0.36,0.43,0.48);
const LINE = rgb(0.82,0.86,0.89);
const SOFT = rgb(0.94,0.96,0.97);
const WHITE = rgb(1,1,1);
const ACCENT = rgb(0.82,0.54,0.29);

function text(value) {
  return String(value == null ? '' : value)
    .replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-')
    .replace(/[^\x20-\x7E\n]/g,' ');
}

function dateText(value) {
  const parts = String(value||'').split('-').map(Number);
  return parts.length===3 ? parts[1]+'/'+parts[2]+'/'+parts[0] : text(value);
}

function filenamePart(value) {
  return text(value).trim().replace(/\s+/g,'_').replace(/[^A-Za-z0-9_.-]/g,'');
}

function wrap(font,value,size,maxWidth) {
  const paragraphs = text(value).split(/\r?\n/);
  const lines = [];
  paragraphs.forEach(function(paragraph) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines.push(''); return; }
    let line = '';
    words.forEach(function(word) {
      let candidate = line ? line+' '+word : word;
      if (font.widthOfTextAtSize(candidate,size)<=maxWidth) {
        line = candidate;
      } else if (line) {
        lines.push(line);
        line = word;
      } else {
        let piece = '';
        for (const character of word) {
          const next = piece+character;
          if (font.widthOfTextAtSize(next,size)>maxWidth&&piece) { lines.push(piece); piece=character; }
          else piece=next;
        }
        line=piece;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
}

function ellipsis(font,value,size,maxWidth) {
  let result = text(value);
  if (font.widthOfTextAtSize(result,size)<=maxWidth) return result;
  while (result.length&&font.widthOfTextAtSize(result+'...',size)>maxWidth) result=result.slice(0,-1);
  return result+'...';
}

function drawLines(page,font,lines,x,y,size,lineHeight,color,maxLines) {
  const limit = maxLines == null ? lines.length : Math.min(lines.length,maxLines);
  for (let index=0;index<limit;index+=1) page.drawText(lines[index],{x:x,y:y-index*lineHeight,size:size,font:font,color:color||INK});
}

function drawBrand(page,bold,title,right,width,height,margin) {
  const top = height-margin;
  page.drawRectangle({x:margin,y:top-48,width:width-margin*2,height:48,color:NAVY});
  const titleWidth = width-margin*2-(right ? 210 : 36);
  page.drawText(ellipsis(bold,title,18,titleWidth),{x:margin+18,y:top-30,size:18,font:bold,color:WHITE});
  if (right) {
    const rightText = text(right).toUpperCase();
    const rightWidth = bold.widthOfTextAtSize(rightText,8);
    page.drawText(rightText,{x:width-margin-18-rightWidth,y:top-28,size:8,font:bold,color:WHITE});
  }
  return top-58;
}

function entryContent(entry) {
  return Boolean(entry.project||entry.startTime||entry.endTime||entry.hours||entry.notes);
}

function flattenTimesheet(sheet) {
  const rows = [];
  sheet.days.forEach(function(day) {
    const used = (day.entries||[]).filter(entryContent);
    const entries = used.length ? used : [{project:'',startTime:'',endTime:'',hours:'',notes:''}];
    entries.forEach(function(entry,index) {
      rows.push({day:index===0?day.day:'',date:index===0?day.date:'',entry:entry});
    });
  });
  return rows;
}

function projectTotals(sheet) {
  const totals = new Map();
  sheet.days.forEach(function(day) {
    (day.entries||[]).forEach(function(entry) {
      const project = String(entry.project||'').trim();
      if (project) totals.set(project,(totals.get(project)||0)+(Number(entry.hours)||0));
    });
  });
  return Array.from(totals.entries());
}

function drawTimesheetTable(page,fonts,rows,startY) {
  const margin=24;
  const widths=[54,72,110,60,60,56,332];
  const labels=['DAY','DATE','PROJECT','START TIME','END TIME','TOTAL HOURS','WORK DESCRIPTION / NOTES'];
  const headerH=24,rowH=20;
  let x=margin;
  labels.forEach(function(label,index) {
    page.drawRectangle({x:x,y:startY-headerH,width:widths[index],height:headerH,color:NAVY,borderColor:WHITE,borderWidth:.4});
    const lines=wrap(fonts.bold,label,6.5,widths[index]-8);
    drawLines(page,fonts.bold,lines,x+4,startY-10,6.5,7.5,WHITE,2);
    x+=widths[index];
  });
  let y=startY-headerH;
  rows.forEach(function(row,rowIndex) {
    y-=rowH;
    x=margin;
    const values=[row.day,row.date?dateText(row.date):'',row.entry.project,row.entry.startTime,row.entry.endTime,row.entry.hours,row.entry.notes];
    values.forEach(function(value,index) {
      page.drawRectangle({x:x,y:y,width:widths[index],height:rowH,color:rowIndex%2===0?SOFT:WHITE,borderColor:LINE,borderWidth:.6});
      const size=index===6?6.5:7.5;
      const lines=wrap(index===0?fonts.bold:fonts.regular,value,size,widths[index]-8);
      drawLines(page,index===0?fonts.bold:fonts.regular,lines,x+4,y+rowH-9,size,7.5,INK,index===6?2:1);
      x+=widths[index];
    });
  });
  return y;
}

function drawTimesheetSummary(page,fonts,totals,combined,topY) {
  const margin=24;
  const columns=totals.length>5?2:1;
  const rows=Math.max(1,Math.ceil(totals.length/columns));
  const rowH=18;
  const height=38+rows*rowH+26;
  const bottom=topY-height;
  page.drawRectangle({x:margin,y:bottom,width:744,height:height,color:SOFT});
  page.drawText('WEEKLY PROJECT TOTALS',{x:margin+14,y:topY-18,size:8,font:fonts.bold,color:NAVY});
  const colW=columns===2?352:704;
  totals.forEach(function(item,index) {
    const col=columns===2&&index>=rows?1:0;
    const row=columns===2?index%rows:index;
    const x=margin+14+col*(colW+12);
    const y=topY-36-row*rowH;
    page.drawText('Project '+(index+1)+':',{x:x,y:y,size:7,font:fonts.regular,color:MUTED});
    page.drawRectangle({x:x+54,y:y-4,width:colW-105,height:15,color:WHITE});
    page.drawText(ellipsis(fonts.bold,item[0],7,colW-115),{x:x+60,y:y,size:7,font:fonts.bold,color:INK});
    page.drawRectangle({x:x+colW-46,y:y-4,width:46,height:15,color:WHITE});
    page.drawText(item[1].toFixed(2),{x:x+colW-39,y:y,size:7,font:fonts.bold,color:INK});
  });
  page.drawRectangle({x:margin+14,y:bottom+8,width:716,height:21,color:NAVY});
  const combinedText='COMBINED TOTAL HOURS:  '+combined.toFixed(2);
  const combinedWidth=fonts.bold.widthOfTextAtSize(combinedText,9);
  page.drawText(combinedText,{x:margin+14+(716-combinedWidth)/2,y:bottom+15,size:9,font:fonts.bold,color:WHITE});
}

async function documentFonts(pdf) {
  return { regular:await pdf.embedFont(StandardFonts.Helvetica),bold:await pdf.embedFont(StandardFonts.HelveticaBold) };
}

export async function exportTimesheet(sheet,employeeName) {
  const pdf=await PDFDocument.create();
  const fonts=await documentFonts(pdf);
  const allRows=flattenTimesheet(sheet);
  const totals=projectTotals(sheet);
  const combined=totals.reduce(function(sum,item){return sum+item[1];},0);
  const chunks=[];
  for(let index=0;index<allRows.length;index+=14) chunks.push(allRows.slice(index,index+14));
  chunks.forEach(function(rows,index) {
    const page=pdf.addPage([792,612]);
    const start=drawBrand(page,fonts.bold,text(employeeName)+' Timesheet','Week of '+dateText(sheet.weekOf),792,612,24);
    const tableBottom=drawTimesheetTable(page,fonts,rows,start);
    if(index===chunks.length-1&&totals.length<=10) drawTimesheetSummary(page,fonts,totals.length?totals:[['',0]],combined,tableBottom-8);
  });
  if(totals.length>10) {
    for(let index=0;index<totals.length;index+=10) {
      const page=pdf.addPage([792,612]);
      const start=drawBrand(page,fonts.bold,text(employeeName)+' Timesheet','Project totals',792,612,24);
      drawTimesheetSummary(page,fonts,totals.slice(index,index+10),combined,start-4);
    }
  }
  pdf.setTitle(text(employeeName)+' Timesheet');
  pdf.setSubject('FieldLog weekly timesheet');
  const bytes=await pdf.save();
  return {bytes:bytes,filename:filenamePart(employeeName)+'_Timesheet_Week_of_'+filenamePart(dateText(sheet.weekOf))+'.pdf',pageCount:pdf.getPageCount()};
}

function reportPage(pdf,fonts,employeeName,continuation) {
  const page=pdf.addPage([612,792]);
  let y=drawBrand(page,fonts.bold,text(employeeName)+' Daily Progress Report',continuation?'Continued':'',612,792,36);
  return {page:page,y:y};
}

function drawReportSection(state,pdf,fonts,title,value,minHeight,employeeName) {
  let remaining=wrap(fonts.regular,value||'',10,612-72-24);
  if(!remaining.length) remaining=[''];
  let first=true;
  while(remaining.length) {
    const available=state.y-36;
    const maxLines=Math.max(1,Math.floor((available-40)/13));
    if(available<70) state=reportPage(pdf,fonts,employeeName,true);
    const currentAvailable=state.y-36;
    const currentMax=Math.max(1,Math.floor((currentAvailable-40)/13));
    const take=Math.min(remaining.length,currentMax);
    const lines=remaining.splice(0,take);
    let bodyHeight=Math.max(first?minHeight:55,lines.length*13+18);
    let totalHeight=22+bodyHeight;
    if(totalHeight>currentAvailable) {
      bodyHeight=currentAvailable-22;
      totalHeight=currentAvailable;
    }
    state.page.drawRectangle({x:36,y:state.y-22,width:540,height:22,color:NAVY});
    state.page.drawText(text(title),{x:47,y:state.y-14,size:8,font:fonts.bold,color:WHITE});
    state.page.drawRectangle({x:36,y:state.y-totalHeight,width:540,height:bodyHeight,color:WHITE,borderColor:LINE,borderWidth:.8});
    drawLines(state.page,fonts.regular,lines,48,state.y-39,10,13,INK);
    state.y-=totalHeight+10;
    first=false;
    if(remaining.length) state=reportPage(pdf,fonts,employeeName,true);
  }
  return state;
}

async function embedPhoto(pdf,uri) {
  const response=await fetch(uri);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const type=(uri.match(/^data:([^;,]+)/)||[])[1]||'image/jpeg';
  return type.includes('png')?pdf.embedPng(bytes):pdf.embedJpg(bytes);
}

export async function exportDailyReport(report,employeeName) {
  const pdf=await PDFDocument.create();
  const fonts=await documentFonts(pdf);
  let state=reportPage(pdf,fonts,employeeName,false);
  state.page.drawText('DATE',{x:36,y:state.y-9,size:8,font:fonts.bold,color:NAVY});
  state.page.drawText('PROJECT',{x:174,y:state.y-9,size:8,font:fonts.bold,color:NAVY});
  state.page.drawRectangle({x:36,y:state.y-43,width:122,height:27,borderColor:LINE,borderWidth:.8,color:WHITE});
  state.page.drawRectangle({x:174,y:state.y-43,width:402,height:27,borderColor:LINE,borderWidth:.8,color:WHITE});
  state.page.drawText(dateText(report.date),{x:46,y:state.y-34,size:10,font:fonts.regular,color:INK});
  state.page.drawText(ellipsis(fonts.regular,report.project,10,382),{x:184,y:state.y-34,size:10,font:fonts.regular,color:INK});
  state.y-=57;
  state=drawReportSection(state,pdf,fonts,'WORK COMPLETED TODAY',report.completed,165,employeeName);
  state=drawReportSection(state,pdf,fonts,'NEXT-DAY LOOK-AHEAD',report.lookAhead,100,employeeName);
  state=drawReportSection(state,pdf,fonts,'DELAYS, ISSUES, OR MATERIALS NEEDED',report.issues,82,employeeName);
  for(const photo of report.photos||[]) {
    if(!photo.uri) continue;
    const page=pdf.addPage([612,792]);
    let captionSize=11;
    let captionLines=photo.caption?wrap(fonts.regular,photo.caption,captionSize,540):[];
    while(captionLines.length*14>170&&captionSize>8) {
      captionSize-=1;
      captionLines=wrap(fonts.regular,photo.caption,captionSize,540);
    }
    const captionHeight=captionLines.length?captionLines.length*(captionSize+3)+12:0;
    const top=756;
    const bottom=36;
    if(captionLines.length) {
      page.drawRectangle({x:36,y:top-captionHeight,width:540,height:captionHeight,color:SOFT});
      page.drawRectangle({x:36,y:top-captionHeight,width:4,height:captionHeight,color:ACCENT});
      drawLines(page,fonts.regular,captionLines,49,top-captionSize-7,captionSize,captionSize+3,INK);
    }
    const image=await embedPhoto(pdf,photo.uri);
    const maxW=540;
    const maxH=top-bottom-captionHeight-(captionHeight?14:0);
    const scale=Math.min(maxW/image.width,maxH/image.height);
    const width=image.width*scale;
    const height=image.height*scale;
    const imageTop=top-captionHeight-(captionHeight?14:0);
    page.drawImage(image,{x:36+(maxW-width)/2,y:imageTop-height,width:width,height:height});
  }
  pdf.setTitle(text(employeeName)+' Daily Progress Report');
  pdf.setSubject('FieldLog daily progress report');
  const bytes=await pdf.save();
  return {bytes:bytes,filename:filenamePart(employeeName)+'_Daily_Report_'+filenamePart(dateText(report.date))+'_'+filenamePart(report.project)+'.pdf',pageCount:pdf.getPageCount()};
}

export async function exportTaskPlan(tasks,scope) {
  const pdf=await PDFDocument.create();
  const fonts=await documentFonts(pdf);
  const chunks=[];
  for(let index=0;index<tasks.length;index+=16) chunks.push(tasks.slice(index,index+16));
  chunks.forEach(function(chunk,index) {
    const page=pdf.addPage([792,612]);
    let y=drawBrand(page,fonts.bold,'Renaissance Task Tracker',text(scope)+'  '+(index+1)+'/'+chunks.length,792,612,24);
    const widths=[106,250,72,58,74,184];
    const headers=['PROJECT / JOBSITE','TASK / DETAILS','STATUS','PRIORITY','DUE','ASSIGNEES'];
    let x=24;
    headers.forEach(function(header,i) {
      page.drawRectangle({x:x,y:y-24,width:widths[i],height:24,color:NAVY,borderColor:WHITE,borderWidth:.4});
      drawLines(page,fonts.bold,wrap(fonts.bold,header,6.5,widths[i]-8),x+4,y-10,6.5,7.5,WHITE,2);
      x+=widths[i];
    });
    y-=24;
    chunk.forEach(function(task,rowIndex) {
      y-=27;
      x=24;
      const status=task.status==='progress'?'In Progress':task.status==='complete'?'Complete':'To-do';
      const assignees=(task.assignees&&task.assignees.length?task.assignees:[task.assignee]).filter(Boolean).join(', ');
      const values=[task.project,task.title+(task.description?' - '+task.description:''),status,task.priority,task.dueDate?dateText(task.dueDate):'Backlog',assignees||'Unassigned'];
      values.forEach(function(value,i) {
        page.drawRectangle({x:x,y:y,width:widths[i],height:27,color:rowIndex%2===0?SOFT:WHITE,borderColor:LINE,borderWidth:.6});
        drawLines(page,i===1?fonts.bold:fonts.regular,wrap(i===1?fonts.bold:fonts.regular,value,i===1?7:6.5,widths[i]-8),x+4,y+18,i===1?7:6.5,8,INK,i===1?2:2);
        x+=widths[i];
      });
    });
  });
  pdf.setTitle('Renaissance Task Tracker');
  const bytes=await pdf.save();
  return {bytes:bytes,filename:'Renaissance_Task_Tracker_'+filenamePart(scope)+'.pdf',pageCount:pdf.getPageCount()};
}
