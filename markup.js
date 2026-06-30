function button(label, attrs) {
  return '<button type="button" ' + attrs + '>' + label + '</button>';
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function openPhotoEditor(input) {
  const source = typeof input === 'string' ? input : input.source;
  const startingActions = typeof input === 'string' ? [] : (input.actions || []);

  return new Promise(function(resolve, reject) {
    const modal = document.createElement('div');
    modal.className = 'markup-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Edit jobsite photo');
    modal.innerHTML =
      '<div class="markup-header"><div><strong>Mark up photo</strong><span>Pinch to zoom · Select an item to move or resize it</span></div>' +
      '<div class="markup-header-actions"><span class="markup-zoom">100%</span><button type="button" class="markup-close" data-editor-action="cancel" aria-label="Cancel editing">×</button></div></div>' +
      '<div class="markup-tools" aria-label="Markup tools">' +
      button('Select / Move', 'class="markup-tool active" data-editor-tool="select"') +
      button('Draw', 'class="markup-tool" data-editor-tool="draw"') +
      button('Arrow', 'class="markup-tool" data-editor-tool="arrow"') +
      button('Circle', 'class="markup-tool" data-editor-tool="circle"') +
      button('Box', 'class="markup-tool" data-editor-tool="box"') +
      button('Text', 'class="markup-tool" data-editor-tool="text"') +
      button('Undo', 'class="markup-tool undo" data-editor-action="undo" disabled') +
      button('Delete selected', 'class="markup-tool delete" data-editor-action="delete" disabled') +
      button('Fit photo', 'class="markup-tool" data-editor-action="fit"') +
      '</div>' +
      '<div class="markup-text-entry" hidden><div class="markup-text-row"><input type="text" maxlength="80" placeholder="Type text for the photo"><button type="button" data-editor-action="apply-text" hidden>Update</button></div><label class="markup-text-size">Text size <input type="range" min="50" max="250" step="10" value="100" aria-label="Text size"><output>100%</output></label><span>Type text, choose its size, then tap where it should appear.</span></div>' +
      '<div class="markup-stage"><div class="markup-canvas-wrap"><canvas aria-label="Photo markup canvas"></canvas></div><div class="markup-gesture-hint">Two fingers: zoom and move photo</div></div>' +
      '<div class="markup-actions"><button type="button" class="button secondary" data-editor-action="cancel">Cancel</button><button type="button" class="button" data-editor-action="save">Save marked-up photo</button></div>';
    document.body.appendChild(modal);

    const stage = modal.querySelector('.markup-stage');
    const wrap = modal.querySelector('.markup-canvas-wrap');
    const canvas = modal.querySelector('canvas');
    const context = canvas.getContext('2d');
    const undoButton = modal.querySelector('[data-editor-action="undo"]');
    const deleteButton = modal.querySelector('[data-editor-action="delete"]');
    const zoomLabel = modal.querySelector('.markup-zoom');
    const textEntry = modal.querySelector('.markup-text-entry');
    const textInput = textEntry.querySelector('input[type="text"]');
    const textSize = textEntry.querySelector('input[type="range"]');
    const textSizeOutput = textEntry.querySelector('output');
    const applyTextButton = textEntry.querySelector('[data-editor-action="apply-text"]');
    const textHint = textEntry.querySelector(':scope > span');
    const image = new Image();

    let tool = 'select';
    let actions = copy(startingActions);
    let selectedIndex = -1;
    let active = null;
    let editGesture = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let pinch = null;
    let blockedByPinch = false;
    const pointers = new Map();

    function baseFontSize() {
      return Math.max(30, canvas.width / 24);
    }

    function textMetrics(action) {
      const scale = action.scale || 1;
      const fontSize = baseFontSize() * scale;
      const padding = Math.max(10, canvas.width / 150) * scale;
      const lines = String(action.text || '').split('\n');
      context.save();
      context.font = '700 ' + fontSize + 'px Arial, sans-serif';
      const width = Math.max.apply(null, lines.map(function(line) { return context.measureText(line || ' ').width; }));
      context.restore();
      return { fontSize:fontSize, padding:padding, lines:lines, width:width, height:lines.length * fontSize * 1.2 };
    }

    function actionBounds(action) {
      let points = [];
      if (action.tool === 'draw') points = action.points || [];
      if (action.tool === 'arrow' || action.tool === 'box' || action.tool === 'circle') points = [action.start, action.end];
      if (action.tool === 'text') {
        const metrics = textMetrics(action);
        return {
          left:action.at.x - metrics.padding,
          top:action.at.y - metrics.fontSize - metrics.padding,
          right:action.at.x + metrics.width + metrics.padding,
          bottom:action.at.y - metrics.fontSize - metrics.padding + metrics.height + metrics.padding * 2
        };
      }
      if (!points.length) return { left:0, top:0, right:0, bottom:0 };
      const xs = points.map(function(point) { return point.x; });
      const ys = points.map(function(point) { return point.y; });
      return { left:Math.min.apply(null,xs), top:Math.min.apply(null,ys), right:Math.max.apply(null,xs), bottom:Math.max.apply(null,ys) };
    }

    function handles(bounds) {
      return {
        nw:{ x:bounds.left, y:bounds.top },
        ne:{ x:bounds.right, y:bounds.top },
        se:{ x:bounds.right, y:bounds.bottom },
        sw:{ x:bounds.left, y:bounds.bottom }
      };
    }

    function lineStyle() {
      context.strokeStyle = '#e53935';
      context.fillStyle = '#e53935';
      context.lineWidth = Math.max(5, canvas.width / 250);
      context.lineCap = 'round';
      context.lineJoin = 'round';
    }

    function drawAction(action) {
      lineStyle();
      if (action.tool === 'draw') {
        if (!action.points || action.points.length < 2) return;
        context.beginPath();
        context.moveTo(action.points[0].x, action.points[0].y);
        for (let i = 1; i < action.points.length; i += 1) context.lineTo(action.points[i].x, action.points[i].y);
        context.stroke();
      }
      if (action.tool === 'box') {
        context.strokeRect(action.start.x, action.start.y, action.end.x - action.start.x, action.end.y - action.start.y);
      }
      if (action.tool === 'circle') {
        const cx = (action.start.x + action.end.x) / 2;
        const cy = (action.start.y + action.end.y) / 2;
        const rx = Math.abs(action.end.x - action.start.x) / 2;
        const ry = Math.abs(action.end.y - action.start.y) / 2;
        context.beginPath();
        context.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        context.stroke();
      }
      if (action.tool === 'arrow') {
        const angle = Math.atan2(action.end.y - action.start.y, action.end.x - action.start.x);
        const head = Math.max(24, canvas.width / 30);
        context.beginPath();
        context.moveTo(action.start.x, action.start.y);
        context.lineTo(action.end.x, action.end.y);
        context.stroke();
        context.beginPath();
        context.moveTo(action.end.x, action.end.y);
        context.lineTo(action.end.x - head * Math.cos(angle - Math.PI / 6), action.end.y - head * Math.sin(angle - Math.PI / 6));
        context.lineTo(action.end.x - head * Math.cos(angle + Math.PI / 6), action.end.y - head * Math.sin(angle + Math.PI / 6));
        context.closePath();
        context.fill();
      }
      if (action.tool === 'text') {
        const metrics = textMetrics(action);
        context.font = '700 ' + metrics.fontSize + 'px Arial, sans-serif';
        context.fillStyle = 'rgba(255,255,255,.88)';
        context.fillRect(action.at.x - metrics.padding, action.at.y - metrics.fontSize - metrics.padding, metrics.width + metrics.padding * 2, metrics.height + metrics.padding * 2);
        context.strokeStyle = '#e53935';
        context.lineWidth = Math.max(3, canvas.width / 400);
        context.strokeRect(action.at.x - metrics.padding, action.at.y - metrics.fontSize - metrics.padding, metrics.width + metrics.padding * 2, metrics.height + metrics.padding * 2);
        context.fillStyle = '#152331';
        metrics.lines.forEach(function(line,index) { context.fillText(line, action.at.x, action.at.y + index * metrics.fontSize * 1.2); });
      }
    }

    function drawSelection() {
      if (selectedIndex < 0 || !actions[selectedIndex]) return;
      const bounds = actionBounds(actions[selectedIndex]);
      const handleSize = Math.max(18, canvas.width / 55) / zoom;
      context.save();
      context.strokeStyle = '#1f73e0';
      context.fillStyle = '#ffffff';
      context.lineWidth = Math.max(3, canvas.width / 450) / zoom;
      context.setLineDash([handleSize * .55, handleSize * .35]);
      context.strokeRect(bounds.left, bounds.top, Math.max(1,bounds.right-bounds.left), Math.max(1,bounds.bottom-bounds.top));
      context.setLineDash([]);
      Object.values(handles(bounds)).forEach(function(handle) {
        context.beginPath();
        context.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
      context.restore();
    }

    function redraw(showSelection) {
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      actions.forEach(drawAction);
      if (active) drawAction(active);
      if (showSelection !== false) drawSelection();
      undoButton.disabled = actions.length === 0;
      deleteButton.disabled = selectedIndex < 0;
    }

    function setView() {
      wrap.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoom + ')';
      zoomLabel.textContent = Math.round(zoom * 100) + '%';
    }

    function fitDisplay() {
      const rect = stage.getBoundingClientRect();
      const availableWidth = Math.max(1,rect.width - 20);
      const availableHeight = Math.max(1,rect.height - 20);
      const displayScale = Math.min(1,availableWidth / canvas.width,availableHeight / canvas.height);
      const width = Math.max(1,canvas.width * displayScale);
      const height = Math.max(1,canvas.height * displayScale);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      wrap.style.width = width + 'px';
      wrap.style.height = height + 'px';
      zoom = 1;
      panX = 0;
      panY = 0;
      setView();
    }

    function imagePoint(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x:clamp((event.clientX - rect.left) * canvas.width / rect.width,0,canvas.width),
        y:clamp((event.clientY - rect.top) * canvas.height / rect.height,0,canvas.height)
      };
    }

    function hitHandle(point) {
      if (selectedIndex < 0 || !actions[selectedIndex]) return null;
      const size = Math.max(28,canvas.width / 35) / zoom;
      const allHandles = handles(actionBounds(actions[selectedIndex]));
      for (const name of ['nw','ne','se','sw']) {
        const item = allHandles[name];
        if (Math.hypot(point.x-item.x,point.y-item.y) <= size) return name;
      }
      return null;
    }

    function hitAction(point) {
      const tolerance = Math.max(24,canvas.width / 45) / zoom;
      for (let index = actions.length - 1; index >= 0; index -= 1) {
        const bounds = actionBounds(actions[index]);
        if (point.x >= bounds.left-tolerance && point.x <= bounds.right+tolerance && point.y >= bounds.top-tolerance && point.y <= bounds.bottom+tolerance) return index;
      }
      return -1;
    }

    function translateAction(action,dx,dy) {
      if (action.start) { action.start.x += dx; action.start.y += dy; }
      if (action.end) { action.end.x += dx; action.end.y += dy; }
      if (action.at) { action.at.x += dx; action.at.y += dy; }
      if (action.points) action.points.forEach(function(point) { point.x += dx; point.y += dy; });
    }

    function mapPoint(point,oldBounds,newBounds) {
      const oldWidth = Math.max(1,oldBounds.right-oldBounds.left);
      const oldHeight = Math.max(1,oldBounds.bottom-oldBounds.top);
      return {
        x:newBounds.left + (point.x-oldBounds.left) * (newBounds.right-newBounds.left) / oldWidth,
        y:newBounds.top + (point.y-oldBounds.top) * (newBounds.bottom-newBounds.top) / oldHeight
      };
    }

    function resizeAction(original,oldBounds,handle,point) {
      const minimum = Math.max(30,canvas.width/30);
      const next = copy(oldBounds);
      if (handle.indexOf('n') >= 0) next.top = Math.min(point.y,next.bottom-minimum);
      if (handle.indexOf('s') >= 0) next.bottom = Math.max(point.y,next.top+minimum);
      if (handle.indexOf('w') >= 0) next.left = Math.min(point.x,next.right-minimum);
      if (handle.indexOf('e') >= 0) next.right = Math.max(point.x,next.left+minimum);
      const updated = copy(original);
      if (updated.start) updated.start = mapPoint(original.start,oldBounds,next);
      if (updated.end) updated.end = mapPoint(original.end,oldBounds,next);
      if (updated.at) updated.at = mapPoint(original.at,oldBounds,next);
      if (updated.points) updated.points = original.points.map(function(item) { return mapPoint(item,oldBounds,next); });
      if (updated.tool === 'text') {
        const widthScale = (next.right-next.left) / Math.max(1,oldBounds.right-oldBounds.left);
        const heightScale = (next.bottom-next.top) / Math.max(1,oldBounds.bottom-oldBounds.top);
        updated.scale = (original.scale || 1) * Math.max(.3,(widthScale+heightScale)/2);
      }
      return updated;
    }

    function syncTextPanel() {
      const selected = selectedIndex >= 0 ? actions[selectedIndex] : null;
      const editingText = tool === 'select' && selected && selected.tool === 'text';
      textEntry.hidden = tool !== 'text' && !editingText;
      applyTextButton.hidden = !editingText;
      textHint.hidden = editingText;
      if (editingText) {
        textInput.value = selected.text || '';
        textSize.value = Math.round((selected.scale || 1) * 100);
      }
      if (tool === 'text') {
        applyTextButton.hidden = true;
        textHint.hidden = false;
      }
      textSizeOutput.textContent = textSize.value + '%';
    }

    function selectTool(nextTool) {
      tool = nextTool;
      modal.querySelectorAll('[data-editor-tool]').forEach(function(item) { item.classList.toggle('active',item.dataset.editorTool===tool); });
      const wasDefaultView = zoom === 1 && panX === 0 && panY === 0;
      syncTextPanel();
      if (tool === 'text') textInput.focus({ preventScroll:true });
      redraw();
      if (wasDefaultView) requestAnimationFrame(fitDisplay);
    }

    function beginPinch() {
      const values = Array.from(pointers.values());
      if (values.length < 2) return;
      active = null;
      editGesture = null;
      blockedByPinch = true;
      const first = values[0];
      const second = values[1];
      const midpoint = { x:(first.x+second.x)/2, y:(first.y+second.y)/2 };
      const stageRect = stage.getBoundingClientRect();
      const center = { x:stageRect.left+stageRect.width/2, y:stageRect.top+stageRect.height/2 };
      pinch = {
        distance:Math.max(1,Math.hypot(second.x-first.x,second.y-first.y)),
        zoom:zoom,
        anchorX:(midpoint.x-center.x-panX)/zoom,
        anchorY:(midpoint.y-center.y-panY)/zoom,
        center:center
      };
    }

    function updatePinch() {
      const values = Array.from(pointers.values());
      if (!pinch || values.length < 2) return;
      const first = values[0];
      const second = values[1];
      const midpoint = { x:(first.x+second.x)/2, y:(first.y+second.y)/2 };
      const distance = Math.max(1,Math.hypot(second.x-first.x,second.y-first.y));
      zoom = clamp(pinch.zoom * distance / pinch.distance,.5,5);
      panX = midpoint.x - pinch.center.x - zoom * pinch.anchorX;
      panY = midpoint.y - pinch.center.y - zoom * pinch.anchorY;
      setView();
    }

    function finish(value) {
      window.removeEventListener('resize',fitDisplay);
      modal.remove();
      resolve(value);
    }

    modal.querySelectorAll('[data-editor-tool]').forEach(function(item) {
      item.addEventListener('click',function() { selectTool(item.dataset.editorTool); });
    });

    modal.querySelectorAll('[data-editor-action="cancel"]').forEach(function(item) {
      item.addEventListener('click',function() { finish(null); });
    });

    undoButton.addEventListener('click',function() {
      actions.pop();
      if (selectedIndex >= actions.length) selectedIndex = actions.length-1;
      syncTextPanel();
      redraw();
    });

    deleteButton.addEventListener('click',function() {
      if (selectedIndex < 0) return;
      actions.splice(selectedIndex,1);
      selectedIndex = -1;
      syncTextPanel();
      redraw();
    });

    modal.querySelector('[data-editor-action="fit"]').addEventListener('click',fitDisplay);

    applyTextButton.addEventListener('click',function() {
      if (selectedIndex < 0 || actions[selectedIndex].tool !== 'text' || !textInput.value.trim()) return;
      actions[selectedIndex].text = textInput.value.trim();
      actions[selectedIndex].scale = Number(textSize.value) / 100;
      redraw();
    });

    textSize.addEventListener('input',function() {
      textSizeOutput.textContent = textSize.value + '%';
      if (tool === 'select' && selectedIndex >= 0 && actions[selectedIndex].tool === 'text') {
        actions[selectedIndex].scale = Number(textSize.value) / 100;
        redraw();
      }
    });

    modal.querySelector('[data-editor-action="save"]').addEventListener('click',function() {
      selectedIndex = -1;
      redraw(false);
      const rendered = actions.length ? canvas.toDataURL('image/jpeg',.9) : source;
      finish({ uri:rendered, actions:copy(actions) });
    });

    canvas.addEventListener('pointerdown',function(event) {
      event.preventDefault();
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      canvas.setPointerCapture(event.pointerId);
      if (pointers.size >= 2) {
        beginPinch();
        return;
      }
      if (blockedByPinch) return;
      const start = imagePoint(event);
      if (tool === 'select') {
        const handle = hitHandle(start);
        if (handle && selectedIndex >= 0) {
          editGesture = { mode:'resize', handle:handle, original:copy(actions[selectedIndex]), bounds:actionBounds(actions[selectedIndex]) };
        } else {
          selectedIndex = hitAction(start);
          if (selectedIndex >= 0) editGesture = { mode:'move', start:start, original:copy(actions[selectedIndex]) };
          else editGesture = { mode:'pan', clientX:event.clientX, clientY:event.clientY, panX:panX, panY:panY };
        }
        syncTextPanel();
        redraw();
        return;
      }
      if (tool === 'text') {
        const text = textInput.value.trim();
        if (!text) {
          textInput.focus();
          return;
        }
        actions.push({ tool:'text', at:start, text:text, scale:Number(textSize.value) / 100 });
        selectedIndex = actions.length-1;
        textInput.value = '';
        selectTool('select');
        return;
      }
      active = tool === 'draw' ? { tool:'draw', points:[start] } : { tool:tool, start:start, end:start };
      redraw();
    });

    canvas.addEventListener('pointermove',function(event) {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
      if (pointers.size >= 2 || pinch) {
        if (!pinch && pointers.size >= 2) beginPinch();
        updatePinch();
        return;
      }
      if (blockedByPinch) return;
      const next = imagePoint(event);
      if (tool === 'select' && editGesture) {
        if (editGesture.mode === 'pan') {
          panX = editGesture.panX + event.clientX - editGesture.clientX;
          panY = editGesture.panY + event.clientY - editGesture.clientY;
          setView();
          return;
        }
        if (selectedIndex >= 0 && editGesture.mode === 'move') {
          actions[selectedIndex] = copy(editGesture.original);
          translateAction(actions[selectedIndex],next.x-editGesture.start.x,next.y-editGesture.start.y);
        } else if (selectedIndex >= 0) {
          actions[selectedIndex] = resizeAction(editGesture.original,editGesture.bounds,editGesture.handle,next);
        }
        redraw();
        return;
      }
      if (!active) return;
      if (active.tool === 'draw') active.points.push(next);
      else active.end = next;
      redraw();
    });

    function endPointer(event) {
      if (!pointers.has(event.pointerId)) return;
      event.preventDefault();
      const wasBlocked = blockedByPinch;
      pointers.delete(event.pointerId);
      if (wasBlocked) {
        if (pointers.size === 0) {
          blockedByPinch = false;
          pinch = null;
        }
        return;
      }
      if (tool === 'select') {
        editGesture = null;
        redraw();
        return;
      }
      if (!active) return;
      if (active.tool !== 'draw') active.end = imagePoint(event);
      if (active.tool !== 'draw' || active.points.length > 1) {
        actions.push(active);
        selectedIndex = actions.length-1;
      }
      active = null;
      selectTool('select');
    }

    canvas.addEventListener('pointerup',endPointer);
    canvas.addEventListener('pointercancel',endPointer);

    image.onload = function() {
      const imageScale = Math.min(1,1800/image.naturalWidth,1800/image.naturalHeight);
      canvas.width = Math.max(1,Math.round(image.naturalWidth*imageScale));
      canvas.height = Math.max(1,Math.round(image.naturalHeight*imageScale));
      redraw();
      requestAnimationFrame(fitDisplay);
    };
    image.onerror = function() {
      modal.remove();
      reject(new Error('The photo could not be opened for editing.'));
    };
    window.addEventListener('resize',fitDisplay);
    image.src = source;
  });
}
