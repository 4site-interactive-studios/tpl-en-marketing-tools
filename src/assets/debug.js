/**
 * TPL email template debug overlay (dev/preview only — never ships in a send).
 *
 * Parses the <!-- START: Name --> / <!-- END: Name --> comments that MJML
 * passes through into the compiled HTML and provides:
 *   - Outline blocks:   one labeled outline per block (labels click-to-copy)
 *   - Group by structure: blocks sharing a structure group (the build-injected
 *                       data-tpl-structure-groups manifest — identical after
 *                       masking Replacement-managed values) share one color,
 *                       labeled by the group's anchor block; ADJACENT same-group
 *                       blocks merge (name-family fallback without a manifest)
 *   - Stack side-by-side: grouped runs laid out horizontally with scroll-snap
 *                       into the email column; row height tracks the current
 *                       cell (fully reversible DOM move)
 *   - Highlight all excluded: red X + tint over every excluded block — both
 *                       data-fully-exclude (converter-redundant variants) and
 *                       data-import-exclude (category chrome); flags carried
 *                       into compiled HTML by the build's annotate → restore
 *                       pipeline (raw-.mjml fetch as legacy fallback)
 *   - Hide all excluded: hides those same blocks entirely — what remains is
 *                       what actually imports
 *
 * Loaded lazily by the floating 🐞 toggle; exposes window.__tplDebug.
 * See NAMING.md for the block-name grammar this tool depends on.
 */
(function () {
  if (window.__tplDebug) return; // already loaded

  var SKIP = /^(Main Content|Debug Toolbar)/;
  var CELL_W = 600, CELL_GAP = 16; // stacked cell = email width; gap between cells
  var HATCH = 'repeating-linear-gradient(45deg,#ececec 0 10px,#f8f8f8 10px 20px)';
  var PALETTE = [
    '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#0a9396',
    '#f032e6', '#9a6324', '#469990', '#800000', '#808000', '#000075'
  ];

  var state = {
    on: false, grouped: false, stacked: false, labels: true, stripes: false, groupedEver: false,
    markExcluded: false, hideExcluded: false, fullyExcluded: null, exclusionsFailed: false,
    blocks: null,     // parsed once per enable; el references stay valid across moves
    layer: null, panel: null,
    stacks: [],       // [{placeholder, container, cells:[{els}]}] for reversal
    colorMap: {}, colorNext: 0
  };

  function color(key) {
    if (!(key in state.colorMap)) state.colorMap[key] = PALETTE[state.colorNext++ % PALETTE.length];
    return state.colorMap[key];
  }

  /* Structure groups: { blockName: anchorName } injected into <head> by the
     build's annotate pass. Blocks sharing an anchor are one structure — the
     same block rendered with different Replacement values. The name-family
     fallback only applies to pages built without the manifest. */
  var sgMap = null;
  (function () {
    var el = document.querySelector('script[data-tpl-structure-groups]');
    if (el) { try { sgMap = JSON.parse(el.textContent); } catch (e) {} }
  })();

  function familyKey(name) {
    return name.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim();
  }

  function groupKey(name) {
    return (sgMap && sgMap[name]) || familyKey(name);
  }

  function variantLabel(name, key, i) {
    if (key.indexOf(familyKey(name)) === 0) {
      var parens = name.match(/\([^)]*\)/g);
      if (parens) return parens.join(' ');
      var v = name.indexOf(key) === 0 ? name.slice(key.length).trim() : '';
      if (v) return v;
    } else if (name !== key) {
      return name;
    }
    return '#' + (i + 1);
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

  /* ---- fully-excluded blocks ----
     Preferred source: the [data-fully-exclude] attribute the build's
     annotate → compile → restore pipeline carries into the compiled HTML
     (with .fully-excluded accepted for builds that skip the restore pass).
     Fallback (pre-annotation builds): fetch the page's raw .mjml source and
     parse the data-fully-exclude flags out of it. */
  var EXCLUDED_SEL = '[data-fully-exclude], .fully-excluded';
  function domExclusions() {
    if (!document.querySelector(EXCLUDED_SEL)) return null;
    var set = {};
    (state.blocks || []).forEach(function (b) {
      var hit = b.els.some(function (el) {
        return (el.matches && el.matches(EXCLUDED_SEL)) ||
               (el.querySelector && el.querySelector(EXCLUDED_SEL));
      });
      if (hit) set[b.name] = true;
    });
    return set;
  }

  function loadExclusions() {
    var fromDom = domExclusions();
    if (fromDom) {
      state.fullyExcluded = fromDom;
      return;
    }
    var src = location.pathname.replace(/\.html$/, '.mjml');
    fetch(src)
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(function (text) {
        var set = {}, stack = [], m;
        var marker = /<!--\s*(START|END):\s*(.+?)\s*-->/g;
        while ((m = marker.exec(text))) {
          if (m[1] === 'START') {
            stack.push({ name: m[2], start: marker.lastIndex });
          } else {
            for (var i = stack.length - 1; i >= 0; i--) {
              if (stack[i].name === m[2]) {
                var open = stack.splice(i, 1)[0];
                if (stack.length <= 1 && text.slice(open.start, m.index).indexOf('data-fully-exclude') !== -1) {
                  set[open.name] = true;
                }
                break;
              }
            }
          }
        }
        state.fullyExcluded = set;
        syncPanel();
        render();
      })
      .catch(function (e) {
        state.exclusionsFailed = true;
        console.warn('[tpl-debug] cannot load ' + src + ' for exclusion info (' + e.message + ') — "Mark fully excluded" unavailable');
        syncPanel();
      });
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

  function isImportExcluded(b) {
    return b.els.some(function (el) {
      return (el.closest && el.closest('[data-import-exclude]')) ||
             (el.querySelector && el.querySelector('[data-import-exclude]'));
    });
  }

  function isExcluded(b) {
    return !!(state.fullyExcluded && state.fullyExcluded[b.name]) || isImportExcluded(b);
  }

  function visibleBlocks() {
    if (!state.hideExcluded) return state.blocks;
    return state.blocks.filter(function (b) { return !isExcluded(b); });
  }

  /* hide/unhide without corrupting markup: NEVER touch a content element's
     style attribute (any el.style write re-serializes it: hex -> rgb(),
     shorthand collapse, stray style=""). Hiding is a data attribute matched
     by an injected stylesheet; unhiding removes the attribute — a perfect
     round-trip by construction. */
  function ensureHideCss() {
    if (document.getElementById('tpl-debug-css')) return;
    var st = document.createElement('style');
    st.id = 'tpl-debug-css';
    st.textContent = '[data-tpl-debug-hidden]{display:none !important;}';
    document.head.appendChild(st);
  }

  function setDisplay(el, hide) {
    if (hide) {
      ensureHideCss();
      el.setAttribute('data-tpl-debug-hidden', '');
    } else {
      el.removeAttribute('data-tpl-debug-hidden');
    }
  }

  function applyVisibility() {
    state.blocks.forEach(function (b) {
      var hide = state.hideExcluded && isExcluded(b);
      b.els.forEach(function (el) { setDisplay(el, hide); });
    });
    document.querySelectorAll('[data-import-exclude]').forEach(function (el) {
      setDisplay(el, state.hideExcluded);
    });
  }

  /* ---- grouping: gather ALL same-structure blocks into one run (page-wide,
     first-occurrence order) — members need not be adjacent ---- */
  function computeRuns(blocks) {
    var map = {}, runs = [];
    blocks.forEach(function (b) {
      var k = groupKey(b.name);
      if (!map[k]) { map[k] = { key: k, members: [] }; runs.push(map[k]); }
      map[k].members.push(b);
    });
    runs.forEach(function (r) {
      r.label = r.key + (r.members.length > 1 ? ' \u00d7' + r.members.length : '');
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

  /* ---- horizontal stacking (reversible DOM move; gathers a structure
     group's members from anywhere on the page into one strip) ---- */
  function emailLeft() {
    // left edge of the email column, measured from an email-width element still
    // in normal flow (full-width wrappers like the category chrome don't count)
    for (var i = 0; i < state.blocks.length; i++) {
      var els = state.blocks[i].els;
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (!el.closest || el.closest('[data-tpl-debug-stack]')) continue;
        var r = el.getBoundingClientRect();
        if (r.width && Math.abs(r.width - CELL_W) < 40) {
          return Math.max(0, Math.round(r.left + window.pageXOffset));
        }
      }
    }
    return Math.max(0, Math.round((document.documentElement.clientWidth - CELL_W) / 2));
  }

  function restyleStacks() {
    var left = emailLeft();
    state.stacks.forEach(function (s) {
      var c = s.container;
      c.style.paddingLeft = left + 'px';
      c.style.scrollPaddingLeft = left + 'px';
      // enough right padding that the LAST cell can also snap onto the email column
      var pr = Math.max(CELL_GAP, c.getBoundingClientRect().width - left - CELL_W);
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
      // every element gets its own return anchor — members may come from
      // anywhere on the page, and a block's elements can be interleaved with
      // comment nodes (MSO conditionals) that must keep their exact position
      run.members.forEach(function (m) {
        m._phs = m.els.map(function (el) {
          var ph = document.createComment('tpl-debug-cell-anchor');
          el.parentNode.insertBefore(ph, el);
          return ph;
        });
      });

      var container = document.createElement('div');
      container.setAttribute('data-tpl-debug-stack', '');
      container.style.cssText = 'display:flex;align-items:flex-start;gap:' + CELL_GAP + 'px;overflow-x:auto;' +
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
        cells.push({ els: m.els, phs: m._phs });
        delete m._phs;
      });
      placeholder.parentNode.insertBefore(container, placeholder);
      container.style.overflowY = 'hidden';
      container.style.transition = 'height 200ms ease';
      var entry = { placeholder: placeholder, container: container, cells: cells, current: 0 };
      var st;
      container.addEventListener('scroll', function () {
        clearTimeout(st);
        st = setTimeout(function () {
          entry.current = Math.max(0, Math.min(cells.length - 1, Math.round(container.scrollLeft / (CELL_W + CELL_GAP))));
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
        cell.els.forEach(function (el, i) {
          cell.phs[i].parentNode.insertBefore(el, cell.phs[i]);
          cell.phs[i].remove();
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
        var c = color(run.key);
        if (stacked) {
          var stackEntry = state.stacks[stackCursor++];
          var r = docRect([stackEntry.container]);
          if (!r) return;
          layer.appendChild(box(r, c, 2, 'dashed'));
          if (state.labels) {
            var gc = chip(run.label, c, r.top, r.left + (parseFloat(stackEntry.container.style.paddingLeft) || 0), false);
            gc.style.transform = 'translateY(-100%)'; // tab above the strip, clear of the first cell's bar
            gc.style.borderRadius = '6px 6px 0 0';
            layer.appendChild(gc);
          }
        } else if (run.members.length > 1) {
          // scattered group: one box per member, group chip on the first,
          // variant chips on every member
          run.members.forEach(function (m, i) {
            var mr = docRect(m.els);
            if (!mr) return;
            layer.appendChild(box(mr, c, 2, i ? 'dotted' : 'dashed'));
            if (state.labels) {
              if (i === 0) layer.appendChild(chip(run.label, c, mr.top, mr.left, false));
              var v = variantLabel(m.name, run.key, i);
              layer.appendChild(chip(v, c, mr.top, mr.left + mr.width, true, run.label + ' - ' + v));
            }
          });
        } else {
          var sr = docRect(run.els);
          if (!sr) return;
          layer.appendChild(box(sr, c, 2, 'dashed'));
          if (state.labels) layer.appendChild(chip(run.label, c, sr.top, sr.left, false));
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

    if (state.markExcluded) {
      visibleBlocks().forEach(function (b) {
        if (!isExcluded(b)) return;
        var cell = b.els[0] && b.els[0].closest ? b.els[0].closest('[data-tpl-debug-cell]') : null;
        if (cell) {
          // stacked: live inside the cell so it scrolls with the strip
          cell.appendChild(xmark(cell.getBoundingClientRect().height,
            'top:0;left:0;right:0;bottom:0;z-index:4;'));
        } else {
          var r = docRect(b.els);
          if (!r) return;
          layer.appendChild(xmark(r.height,
            'top:' + r.top + 'px;left:' + r.left + 'px;width:' + r.width + 'px;height:' + r.height + 'px;'));
        }
      });
    }

    layer.style.height = document.documentElement.scrollHeight + 'px';
    document.body.appendChild(layer);
    state.layer = layer;
    syncPanel();
    syncButton();
  }

  function xmark(h, posCss) {
    var tint = document.createElement('div');
    tint.setAttribute('data-tpl-debug-xmark', '');
    tint.style.cssText = 'position:absolute;box-sizing:border-box;background:rgba(230,25,75,.16);' +
      'border:2px solid rgba(230,25,75,.85);display:flex;align-items:center;justify-content:center;' +
      'pointer-events:none;' + posCss;
    var x = document.createElement('div');
    x.textContent = '\u2715';
    var fs = Math.max(22, Math.min(110, Math.floor(h * 0.75)));
    x.style.cssText = 'color:rgba(230,25,75,.8);font:700 ' + fs + 'px/1 Menlo,Consolas,monospace;';
    tint.appendChild(x);
    return tint;
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
    // in-cell excluded tints live outside the layer — sweep them too
    document.querySelectorAll('[data-tpl-debug-xmark]').forEach(function (el) { el.remove(); });
  }

  /* ---- floating control panel ---- */
  function buildPanel() {
    if (state.panel) return;
    var p = document.createElement('div');
    p.setAttribute('data-tpl-debug-panel', '');
    p.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#111;color:#fff;' +
      'font:12px/1.7 Menlo,Consolas,monospace;padding:10px 12px;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.4);' +
      'min-width:200px;';
    function sec(t, hook) {
      return '<div ' + hook + ' style="color:#8a8a8a;font-size:9px;letter-spacing:1.5px;margin:8px 0 2px;">' + t + '</div>';
    }
    p.innerHTML =
      '<div style="font-weight:bold;letter-spacing:1px;">🐞 Email Debug</div>' +
      sec('BLOCKS', 'data-dbg-sec-blocks') +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-sections checked> Outline blocks</label>' +
      '<label style="display:block;cursor:pointer;padding-left:18px;" data-dbg-labels-label><input type="checkbox" data-dbg-labels checked> Show block labels</label>' +
      sec('STRUCTURE', 'data-dbg-sec-structure') +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-group> Group by structure</label>' +
      '<label style="display:none;cursor:pointer;padding-left:18px;" data-dbg-stack-label><input type="checkbox" data-dbg-stack> Stack side-by-side</label>' +
      '<label style="display:none;cursor:pointer;padding-left:18px;color:#777;" data-dbg-stripes-label><input type="checkbox" data-dbg-stripes disabled> Striped background</label>' +
      sec('EXCLUDED', 'data-dbg-sec-excluded') +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-xmark> Highlight all excluded</label>' +
      '<label style="display:block;cursor:pointer;"><input type="checkbox" data-dbg-hideexcl> Hide all excluded</label>' +

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
    p.querySelector('[data-dbg-stack]').addEventListener('change', function (e) {
      api.setStacking(e.target.checked);
    });
    p.querySelector('[data-dbg-xmark]').addEventListener('change', function (e) {
      api.setMarkExcluded(e.target.checked);
    });
    p.querySelector('[data-dbg-hideexcl]').addEventListener('change', function (e) {
      api.setHideExcluded(e.target.checked);
    });
    p.querySelector('[data-dbg-off]').addEventListener('click', function () { api.disable(); });
    state.panel = p;
  }

  function syncPanel() {
    if (!state.panel) return;
    state.panel.querySelector('[data-dbg-sections]').checked = state.on;
    state.panel.querySelector('[data-dbg-group]').checked = state.grouped;
    state.panel.querySelector('[data-dbg-labels]').checked = state.labels;
    state.panel.querySelector('[data-dbg-labels-label]').style.display = state.on ? 'block' : 'none';
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
    state.panel.querySelector('[data-dbg-xmark]').checked = state.markExcluded;
    state.panel.querySelector('[data-dbg-hideexcl]').checked = state.hideExcluded;
    var blocksTitle = 'BLOCKS', structureTitle = 'STRUCTURE', excludedTitle = 'EXCLUDED';
    if (state.blocks) {
      var total = state.blocks.length;
      var excluded = state.blocks.filter(isExcluded).length;
      var uniq = 0, seenKeys = {};
      state.blocks.forEach(function (b) {
        var k = groupKey(b.name);
        if (!seenKeys[k]) { seenKeys[k] = 1; uniq++; }
      });
      blocksTitle += ' (' + total + ' Total)';
      structureTitle += ' (' + uniq + ' Unique)';
      excludedTitle += ' (' + excluded + ' Blocks)';
    }
    state.panel.querySelector('[data-dbg-sec-blocks]').textContent = blocksTitle;
    state.panel.querySelector('[data-dbg-sec-structure]').textContent = structureTitle;
    state.panel.querySelector('[data-dbg-sec-excluded]').textContent = excludedTitle;
  }

  function syncButton() {
    var btn = document.getElementById('tpl-debug-btn');
    if (!btn) return;
    btn.style.display = state.panel ? 'none' : 'block';
    var on = state.on || state.panel;
    btn.style.background = on ? '#0E7C3F' : '#111111';
    btn.title = on ? 'Debug ON — click to disable' : 'Toggle debug mode';
  }

  /* ---- re-render on layout shifts (resize, late image loads) ----
     page-lifetime listeners: intentionally never detached on disable() ---- */
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
      if (state.fullyExcluded === null && !state.exclusionsFailed) loadExclusions();
      buildPanel();
      render();
    },
    disable: function () {
      if (state.stacked) { removeStack(); state.stacked = false; }
      if (state.hideExcluded) {
        state.hideExcluded = false;
        applyVisibility();
      }
      state.markExcluded = false;
      state.on = false;
      clearLayer();
      var css = document.getElementById('tpl-debug-css');
      if (css) css.remove();
      if (state.panel) { state.panel.remove(); state.panel = null; }
      syncButton();
    },
    toggle: function () { (state.on || state.panel) ? api.disable() : api.enable(); },
    setGrouping: function (v) {
      state.grouped = !!v;
      if (state.grouped && !state.groupedEver) {
        state.groupedEver = true;
        state.stacked = true;
        state.stripes = true;
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
    setMarkExcluded: function (v) {
      state.markExcluded = !!v;
      render();
    },
    setHideExcluded: function (v) {
      state.hideExcluded = !!v;
      var wasStacked = state.stacked;
      if (wasStacked) { removeStack(); state.stacked = false; }
      applyVisibility();
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
