/**
 * TPL email template debug overlay (dev/preview only — never ships in a send).
 *
 * Parses the <!-- START: Name --> / <!-- END: Name --> comments that MJML
 * passes through into the compiled HTML and provides:
 *   - Sections mode:  one labeled outline per block
 *   - Group mode:     names differing only by a parenthetical qualifier
 *                     (e.g. "Footer (dark)" / "Footer (light green)") share a
 *                     name/color; ADJACENT same-group blocks merge into one
 *                     outline, and each member keeps a distinct variant chip.
 *   - Stack mode:     grouped adjacent runs are physically laid out
 *                     side-by-side in a scrollable row for visual comparison
 *                     (fully reversible DOM move).
 *
 * Loaded lazily by the "Debug" button block; exposes window.__tplDebug.
 */
(function () {
  if (window.__tplDebug) return; // already loaded

  var SKIP = /^(Main Content|Debug Toolbar)/;
  var HATCH = 'repeating-linear-gradient(45deg,#ececec 0 10px,#f8f8f8 10px 20px)';
  var PALETTE = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#0a9396',
    '#f032e6', '#9a6324', '#469990', '#800000', '#808000', '#000075'
  ];

  var state = {
    on: false, grouped: false, stacked: false, labels: true, stripes: false, groupedEver: false, hideDupes: false,
    blocks: null,     // parsed once per enable; el references stay valid across moves
    layer: null, panel: null,
    stacks: [],       // [{placeholder, container, cells:[{els}]}] for reversal
    colorMap: {}, colorNext: 0
  };

  function color(key) {
    if (!(key in state.colorMap)) state.colorMap[key] = PALETTE[state.colorNext++ % PALETTE.length];
    return state.colorMap[key];
  }

  function groupKey(name) {
    return name.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  }

  function variantLabel(name, key, i) {
    var parens = name.match(/\([^)]*\)/g);
    if (parens) return parens.join(' ');
    var v = name.indexOf(key) === 0 ? name.slice(key.length).trim() : name.trim();
    return v && v !== name ? v : (v === name && v ? v : '#' + (i + 1));
  }

  function copyName(text, feedbackEl) {
    window.__tplDebugLastCopy = text; // also inspectable from the console
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
    if (feedbackEl) {
      var orig = feedbackEl.textContent;
      feedbackEl.textContent = 'copied!';
      setTimeout(function () { feedbackEl.textContent = orig; }, 900);
    }
  }

  /* ---- parse START/END comment pairs into block ranges (cached) ---- */
  function parseBlocks() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT, null);
    var stack = [], blocks = [], node;
    while ((node = walker.nextNode())) {
      var m = node.nodeValue.trim().match(/^(START|END):\s*(.+?)\s*$/);
      if (!m) continue;
      if (m[1] === 'START') {
        stack.push({ name: m[2], start: node });
      } else {
        var matched = false;
        for (var i = stack.length - 1; i >= 0; i--) {
          if (stack[i].name === m[2]) {
            var open = stack.splice(i, 1)[0];
            if (!SKIP.test(open.name)) {
              var els = elementsBetween(open.start, node);
              if (els.length) blocks.push({ name: open.name, els: els });
            }
            matched = true;
            break;
          }
        }
        if (!matched) console.warn('[tpl-debug] END without matching START (name mismatch?): "' + m[2] + '"');
      }
    }
    stack.forEach(function (open) {
      if (!SKIP.test(open.name)) console.warn('[tpl-debug] START never closed: "' + open.name + '"');
    });
    return blocks;
  }

  function elementsBetween(a, b) {
    var els = [], n = a.nextSibling;
    while (n && n !== b) {
      if (n.nodeType === 1) els.push(n);
      n = n.nextSibling;
    }
    return els;
  }

  function visibleBlocks() {
    if (!state.hideDupes) return state.blocks;
    var seen = {}, out = [];
    state.blocks.forEach(function (b) {
      if (seen[b.name]) return;
      seen[b.name] = true;
      out.push(b);
    });
    return out;
  }

  function applyDupVisibility() {
    var seen = {};
    state.blocks.forEach(function (b) {
      var dup = state.hideDupes && seen[b.name];
      seen[b.name] = true;
      b.els.forEach(function (el) { el.style.display = dup ? 'none' : ''; });
    });
  }

  /* ---- grouping: merge ADJACENT same-key blocks into runs ---- */
  function computeRuns(blocks) {
    var counts = {};
    blocks.forEach(function (b) { var k = groupKey(b.name); counts[k] = (counts[k] || 0) + 1; });
    var runs = [], seen = {};
    blocks.forEach(function (b) {
      var k = groupKey(b.name);
      var prev = runs[runs.length - 1];
      if (prev && prev.key === k) {
        prev.members.push(b);
      } else {
        runs.push({ key: k, members: [b], total: counts[k], idx: (seen[k] = (seen[k] || 0) + 1) });
      }
    });
    runs.forEach(function (r) {
      r.label = r.key;
      if (r.members.length > 1) r.label += ' ×' + r.members.length;
      else if (r.total > 1) r.label += ' · ' + r.idx + '/' + r.total;
      r.els = r.members.reduce(function (a, m) { return a.concat(m.els); }, []);
    });
    return runs;
  }

  function docRect(els) {
    var top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      top = Math.min(top, r.top + window.pageYOffset);
      bottom = Math.max(bottom, r.bottom + window.pageYOffset);
      left = Math.min(left, r.left + window.pageXOffset);
      right = Math.max(right, r.right + window.pageXOffset);
    });
    if (top === Infinity) return null;
    return { top: top, left: left, width: right - left, height: bottom - top };
  }

  /* ---- horizontal stacking (reversible DOM move, adjacent runs only) ---- */
  function emailLeft() {
    // left edge of the email column, measured from a block still in normal flow
    for (var i = 0; i < state.blocks.length; i++) {
      var el = state.blocks[i].els[0];
      if (el && !el.closest('[data-tpl-debug-stack]')) {
        var r = el.getBoundingClientRect();
        if (r.width) return Math.max(0, Math.round(r.left + window.pageXOffset));
      }
    }
    return 0;
  }

  function restyleStacks() {
    var left = emailLeft();
    state.stacks.forEach(function (s) {
      var c = s.container;
      c.style.paddingLeft = left + 'px';
      c.style.scrollPaddingLeft = left + 'px';
      // enough right padding that the LAST cell can also snap onto the email column
      var pr = Math.max(16, c.getBoundingClientRect().width - left - 600);
      c.style.paddingRight = pr + 'px';
    });
  }

  function applyStack() {
    if (state.stacks.length) return;
    var runs = computeRuns(visibleBlocks());
    runs.forEach(function (run) {
      if (run.members.length < 2) return;
      var firstEl = run.members[0].els[0];
      var placeholder = document.createComment('tpl-debug-stack-anchor');
      firstEl.parentNode.insertBefore(placeholder, firstEl);

      var container = document.createElement('div');
      container.setAttribute('data-tpl-debug-stack', '');
      container.style.cssText = 'display:flex;align-items:flex-start;gap:16px;overflow-x:auto;' +
        'scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:0 16px 0 0;';
      container.style.background = state.stripes ? HATCH : 'none';
      var c = color(run.key);
      var cells = [];
      run.members.forEach(function (m, i) {
        var cell = document.createElement('div');
        cell.setAttribute('data-tpl-debug-cell', '');
        cell.dataset.tplOutline = '1px dotted ' + c;
        cell.style.cssText = 'flex:0 0 600px;width:600px;position:relative;outline-offset:-1px;scroll-snap-align:start;';
        cell.style.outline = state.on ? cell.dataset.tplOutline : 'none';
        var bar = document.createElement('div');
        bar.setAttribute('data-tpl-debug-bar', '');
        var vName = variantLabel(m.name, run.key, i);
        var payload = run.label + ' - ' + vName;
        bar.textContent = vName;
        bar.title = 'Click to copy: ' + payload;
        bar.style.cssText = 'position:absolute;top:0;left:0;z-index:5;background:' + c + ';color:#fff;' +
          'font:11px/1.8 Menlo,Consolas,monospace;padding:1px 8px;cursor:pointer;';
        if (!(state.on && state.labels)) bar.style.display = 'none';
        bar.addEventListener('click', function () { copyName(payload, bar); });
        cell.appendChild(bar);
        m.els.forEach(function (el) { cell.appendChild(el); });
        container.appendChild(cell);
        cells.push({ els: m.els });
      });
      placeholder.parentNode.insertBefore(container, placeholder);
      container.style.overflowY = 'hidden';
      container.style.transition = 'height 200ms ease';
      var entry = { placeholder: placeholder, container: container, cells: cells, current: 0 };
      var st;
      container.addEventListener('scroll', function () {
        clearTimeout(st);
        st = setTimeout(function () {
          entry.current = Math.max(0, Math.min(cells.length - 1, Math.round(container.scrollLeft / 616)));
          setStackHeight(entry);
          queueRender();
        }, 90);
      });
      state.stacks.push(entry);
    });
    restyleStacks();
    state.stacks.forEach(setStackHeight);
  }

  function setStackHeight(entry) {
    var cell = entry.container.children[entry.current || 0];
    if (!cell) return;
    entry.container.style.height = cell.getBoundingClientRect().height + 'px';
  }

  function removeStack() {
    state.stacks.forEach(function (s) {
      s.cells.forEach(function (cell) {
        cell.els.forEach(function (el) {
          s.placeholder.parentNode.insertBefore(el, s.placeholder);
        });
      });
      s.container.remove();
      s.placeholder.remove();
    });
    state.stacks = [];
  }

  function syncStackChrome() {
    document.querySelectorAll('[data-tpl-debug-cell]').forEach(function (cell) {
      cell.style.outline = state.on ? cell.dataset.tplOutline : 'none';
    });
    document.querySelectorAll('[data-tpl-debug-bar]').forEach(function (b) {
      b.style.display = (state.on && state.labels) ? '' : 'none';
    });
  }

  /* ---- rendering ---- */
  function render() {
    clearLayer();
    syncStackChrome();
    state.stacks.forEach(setStackHeight);
    if (!state.on) { syncPanel(); syncButton(); return; }

    var layer = document.createElement('div');
    layer.setAttribute('data-tpl-debug-layer', '');
    layer.style.cssText = 'position:absolute;top:0;left:0;width:100%;overflow:hidden;pointer-events:none;z-index:2147483000;';

    if (state.grouped) {
      var stackCursor = 0;
      computeRuns(visibleBlocks()).forEach(function (run) {
        var stacked = state.stacked && run.members.length > 1;
        var stackEntry = stacked ? state.stacks[stackCursor++] : null;
        var r = stacked ? docRect([stackEntry.container]) : docRect(run.els);
        if (!r) return;
        var c = color(run.key);
        layer.appendChild(box(r, c, 2, 'dashed'));
        if (state.labels) {
          var chipX = r.left;
          if (stacked) chipX = r.left + (parseFloat(stackEntry.container.style.paddingLeft) || 0);
          var gc = chip(run.label, c, r.top, chipX, false);
          if (stacked) { // sit just above the row like a tab, clear of the first cell's bar
            gc.style.transform = 'translateY(-100%)';
            gc.style.borderRadius = '6px 6px 0 0';
          }
          layer.appendChild(gc);
        }
        // distinct member identification inside multi-member groups
        // (stacked runs label their cells in-flow instead, so they scroll with the container)
        if (!stacked && run.members.length > 1) {
          run.members.forEach(function (m, i) {
            var mr = docRect(m.els);
            if (!mr) return;
            layer.appendChild(box(mr, c, 1, 'dotted'));
            if (state.labels) {
              var v = variantLabel(m.name, run.key, i);
              layer.appendChild(chip(v, c, mr.top, mr.left + mr.width, true, run.label + ' - ' + v));
            }
          });
        }
      });
    } else {
      visibleBlocks().forEach(function (b) {
        var r = docRect(b.els);
        if (!r) return;
        var c = color(groupKey(b.name));
        layer.appendChild(box(r, c, 2, 'dashed'));
        if (state.labels) layer.appendChild(chip(b.name, c, r.top, r.left, false));
      });
    }

    layer.style.height = document.documentElement.scrollHeight + 'px';
    document.body.appendChild(layer);
    state.layer = layer;
    syncPanel();
    syncButton();
  }

  function box(r, c, w, style) {
    var d = document.createElement('div');
    d.setAttribute('data-tpl-debug-box', '');
    d.style.cssText = 'position:absolute;box-sizing:border-box;border:' + w + 'px ' + style + ' ' + c +
      ';top:' + r.top + 'px;left:' + r.left + 'px;width:' + r.width + 'px;height:' + r.height + 'px;';
    return d;
  }

  function chip(text, c, top, x, rightAlign, copyPayload) {
    var payload = copyPayload || text;
    var t = document.createElement('div');
    t.setAttribute('data-tpl-debug-chip', '');
    t.textContent = text;
    t.title = 'Click to copy: ' + payload;
    t.style.cssText = 'position:absolute;top:' + top + 'px;white-space:nowrap;' +
      'font:11px/1.6 Menlo,Consolas,monospace;padding:1px 7px;opacity:.94;' +
      'pointer-events:auto;cursor:pointer;' +
      (rightAlign
        ? 'left:' + x + 'px;transform:translateX(-100%);background:#fff;color:' + c + ';border:1px solid ' + c + ';border-radius:0 0 0 6px;'
        : 'left:' + x + 'px;background:' + c + ';color:#fff;border-radius:0 0 6px 0;');
    t.addEventListener('click', function () { copyName(payload, t); });
    return t;
  }

  function clearLayer() {
    if (state.layer) { state.layer.remove(); state.layer = null; }
  }

  /* ---- floating control panel ---- */
  function buildPanel() {
    if (state.panel) return;
    var p = document.createElement('div');
    p.setAttribute('data-tpl-debug-panel', '');
    p.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#111;color:#fff;' +
      'font:12px/1.7 Menlo,Consolas,monospace;padding:10px 12px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.4);' +
      'min-width:200px;';
    p.innerHTML =
      '<div style="font-weight:bold;letter-spacing:1px;margin-bottom:6px;">🐞 TPL DEBUG</div>' +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-sections checked> Outline blocks</label>' +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-labels checked> Show block labels</label>' +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-group> Group similar blocks</label>' +
      '<label style="display:none;cursor:pointer;padding-left:18px;" data-dbg-stack-label><input type="checkbox" data-dbg-stack> Stack side-by-side</label>' +
      '<label style="display:none;cursor:pointer;padding-left:18px;color:#777;" data-dbg-stripes-label><input type="checkbox" data-dbg-stripes disabled> Striped background</label>' +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-dupes> Hide duplicates</label>' +
      '<div data-dbg-count style="color:#8dc63f;margin-top:6px;"></div>' +
      '<button data-dbg-off style="margin-top:8px;width:100%;background:#700310;color:#fff;border:0;border-radius:4px;' +
      'padding:4px 0;font:inherit;cursor:pointer;">Turn off</button>';
    document.body.appendChild(p);
    p.querySelector('[data-dbg-sections]').addEventListener('change', function (e) {
      state.on = e.target.checked; render();
    });
    p.querySelector('[data-dbg-labels]').addEventListener('change', function (e) {
      api.setLabels(e.target.checked);
    });
    p.querySelector('[data-dbg-group]').addEventListener('change', function (e) {
      api.setGrouping(e.target.checked);
    });
    p.querySelector('[data-dbg-stripes]').addEventListener('change', function (e) {
      api.setStripes(e.target.checked);
    });
    p.querySelector('[data-dbg-dupes]').addEventListener('change', function (e) {
      api.setHideDuplicates(e.target.checked);
    });
    p.querySelector('[data-dbg-stack]').addEventListener('change', function (e) {
      api.setStacking(e.target.checked);
    });
    p.querySelector('[data-dbg-off]').addEventListener('click', function () { api.disable(); });
    state.panel = p;
  }

  function syncPanel() {
    if (!state.panel) return;
    state.panel.querySelector('[data-dbg-sections]').checked = state.on;
    state.panel.querySelector('[data-dbg-group]').checked = state.grouped;
    state.panel.querySelector('[data-dbg-labels]').checked = state.labels;
    state.panel.querySelector('[data-dbg-dupes]').checked = state.hideDupes;
    var stackChk = state.panel.querySelector('[data-dbg-stack]');
    stackChk.checked = state.stacked;
    stackChk.disabled = !state.grouped;
    state.panel.querySelector('[data-dbg-stack-label]').style.display = state.grouped ? 'block' : 'none';
    var stripesChk = state.panel.querySelector('[data-dbg-stripes]');
    stripesChk.checked = state.stripes;
    stripesChk.disabled = !state.stacked;
    var stripesLabel = state.panel.querySelector('[data-dbg-stripes-label]');
    stripesLabel.style.display = state.grouped ? 'block' : 'none';
    stripesLabel.style.color = state.stacked ? '#fff' : '#777';
    var n = state.layer ? state.layer.querySelectorAll('[data-tpl-debug-box]').length : 0;
    state.panel.querySelector('[data-dbg-count]').textContent = n ? n + ' outline' + (n === 1 ? '' : 's') + ' drawn' : '';
  }

  function syncButton() {
    var btn = document.getElementById('tpl-debug-btn');
    if (!btn) return;
    btn.style.display = state.panel ? 'none' : 'block';
    var on = state.on || state.panel;
    btn.style.background = on ? '#0E7C3F' : '#111111';
    btn.title = on ? 'Debug ON — click to disable' : 'Toggle debug mode';
  }

  /* ---- re-render on layout shifts (resize, late image loads) ---- */
  var t;
  function queueRender() {
    clearTimeout(t);
    t = setTimeout(function () {
      if (state.stacks.length) restyleStacks();
      if (state.on) render();
    }, 150);
  }
  window.addEventListener('resize', queueRender);
  window.addEventListener('load', queueRender);
  Array.prototype.forEach.call(document.images, function (img) {
    if (!img.complete) img.addEventListener('load', queueRender, { once: true });
  });

  /* ---- public API ---- */
  var api = {
    enable: function () {
      state.on = true;
      state.colorMap = {}; state.colorNext = 0;
      if (!state.blocks) state.blocks = parseBlocks();
      buildPanel();
      render();
    },
    disable: function () {
      if (state.stacked) { removeStack(); state.stacked = false; }
      if (state.hideDupes) { state.hideDupes = false; applyDupVisibility(); }
      state.on = false;
      clearLayer();
      if (state.panel) { state.panel.remove(); state.panel = null; }
      syncButton();
    },
    toggle: function () { (state.on || state.panel) ? api.disable() : api.enable(); },
    setGrouping: function (v) {
      state.grouped = !!v;
      if (state.grouped && !state.groupedEver) {
        state.groupedEver = true;
        state.stacked = true;
        applyStack();
      }
      if (!state.grouped && state.stacked) { removeStack(); state.stacked = false; }
      render();
    },
    setLabels: function (v) {
      state.labels = !!v;
      render();
    },
    setStripes: function (v) {
      state.stripes = !!v;
      state.stacks.forEach(function (s) { s.container.style.background = state.stripes ? HATCH : 'none'; });
      syncPanel();
    },
    setHideDuplicates: function (v) {
      state.hideDupes = !!v;
      var wasStacked = state.stacked;
      if (wasStacked) { removeStack(); state.stacked = false; }
      applyDupVisibility();
      if (wasStacked) { state.stacked = true; applyStack(); }
      render();
    },
    setStacking: function (v) {
      v = !!v;
      if (v === state.stacked) return;
      if (v && !state.grouped) return; // stacking requires grouping
      state.stacked = v;
      if (v) applyStack(); else removeStack();
      render();
    }
  };
  window.__tplDebug = api;
})();
