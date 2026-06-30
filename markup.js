function button(label, attrs) {
  return '<button type="button" ' + attrs + '>' + label + '</button>';
}

export function openPhotoEditor(source) {
  return new Promise(function(resolve, reject) {
    const modal = document.createElement('div');
    modal.className = 'markup-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Edit jobsite photo');
    modal.innerHTML =
      '<div class="markup-header"><div><strong>Mark up photo</strong><span>Draw or add a shape, arrow, or text</span></div>' +
      '<button type="button" class="markup-close" data-editor-action="cancel" aria-label="Cancel editing">×</button></div>' +
      '<div class="markup-tools" aria-label="Markup tools">' +
      button('Draw', 'class="markup-tool active" data-editor-tool="draw"') +
      button('Arrow', 'class="markup-tool" data-editor-tool="arrow"') +
      button('Circle', 'class="markup-tool" data-editor-tool="circle"') +
      button('Box', 'class="markup-tool" data-editor-tool="box"') +
      button('Text', 'class="markup-tool" data-editor-tool="text"') +
      button('Undo', 'class="markup-tool undo" data-editor-action="undo" disabled') +
      '</div>' +
      '<div class="markup-text-entry" hidden><input type="text" maxlength="80" placeholder="Type text for the photo"><span>Then tap where the text box should appear.</span></div>' +
      '<div class="markup-stage"><canvas aria-label="Photo markup canvas"></canvas></div>' +
      '<div class="markup-actions"><button type="button" class="button secondary" data-editor-action="cancel">Cancel</button><button type="button" class="button" data-editor-action="save">Save marked-up photo</button></div>';
    document.body.appendChild(modal);

    const canvas = modal.querySelector('canvas');
    const context = canvas.getContext('2d');
    const undoButton = modal.querySelector('[data-editor-action="undo"]');
    const textEntry = modal.querySelector('.markup-text-entry');
    const textInput = textEntry.querySelector('input');
    const image = new Image();
    let tool = 'draw';
    let actions = [];
    let active = null;
    let pointerId = null;

    function point(event) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * canvas.width / rect.width,
        y: (event.clientY - rect.top) * canvas.height / rect.height
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
        if (action.points.length < 2) return;
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
        const fontSize = Math.max(30, canvas.width / 24);
        const padding = Math.max(10, canvas.width / 150);
        const lines = String(action.text).split('\n');
        context.font = '700 ' + fontSize + 'px Arial, sans-serif';
        const width = Math.max.apply(null, lines.map(function(line) { return context.measureText(line || ' ').width; }));
        const height = lines.length * fontSize * 1.2;
        context.fillStyle = 'rgba(255,255,255,.88)';
        context.fillRect(action.at.x - padding, action.at.y - fontSize - padding, width + padding * 2, height + padding * 2);
        context.strokeStyle = '#e53935';
        context.lineWidth = Math.max(3, canvas.width / 400);
        context.strokeRect(action.at.x - padding, action.at.y - fontSize - padding, width + padding * 2, height + padding * 2);
        context.fillStyle = '#152331';
        lines.forEach(function(line, index) { context.fillText(line, action.at.x, action.at.y + index * fontSize * 1.2); });
      }
    }

    function redraw() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      actions.forEach(drawAction);
      if (active) drawAction(active);
      undoButton.disabled = actions.length === 0;
    }

    function finish(value) {
      modal.remove();
      resolve(value);
    }

    modal.querySelectorAll('[data-editor-tool]').forEach(function(item) {
      item.addEventListener('click', function() {
        tool = item.dataset.editorTool;
        modal.querySelectorAll('[data-editor-tool]').forEach(function(toolButton) { toolButton.classList.toggle('active', toolButton === item); });
        textEntry.hidden = tool !== 'text';
        if (tool === 'text') textInput.focus();
      });
    });

    modal.querySelectorAll('[data-editor-action="cancel"]').forEach(function(item) {
      item.addEventListener('click', function() { finish(null); });
    });

    undoButton.addEventListener('click', function() {
      actions.pop();
      redraw();
    });

    modal.querySelector('[data-editor-action="save"]').addEventListener('click', function() {
      redraw();
      finish(canvas.toDataURL('image/jpeg', 0.9));
    });

    canvas.addEventListener('pointerdown', function(event) {
      event.preventDefault();
      const start = point(event);
      if (tool === 'text') {
        const text = textInput.value.trim();
        if (!text) {
          textInput.focus();
          return;
        }
        actions.push({ tool: 'text', at: start, text: text });
        textInput.value = '';
        redraw();
        return;
      }
      pointerId = event.pointerId;
      canvas.setPointerCapture(pointerId);
      active = tool === 'draw' ? { tool: 'draw', points: [start] } : { tool: tool, start: start, end: start };
      redraw();
    });

    canvas.addEventListener('pointermove', function(event) {
      if (!active || event.pointerId !== pointerId) return;
      event.preventDefault();
      const next = point(event);
      if (active.tool === 'draw') active.points.push(next);
      else active.end = next;
      redraw();
    });

    function endPointer(event) {
      if (!active || event.pointerId !== pointerId) return;
      event.preventDefault();
      if (active.tool !== 'draw') active.end = point(event);
      if (active.tool !== 'draw' || active.points.length > 1) actions.push(active);
      active = null;
      pointerId = null;
      redraw();
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    image.onload = function() {
      const scale = Math.min(1, 1800 / image.naturalWidth, 1800 / image.naturalHeight);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      redraw();
    };
    image.onerror = function() {
      modal.remove();
      reject(new Error('The photo could not be opened for editing.'));
    };
    image.src = source;
  });
}
