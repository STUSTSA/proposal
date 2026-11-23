
// 迷你元件執行器：把 .dc.html 的樣板（{{}}、sc-for、sc-if、onClick/onChange）在一般網頁裡跑起來
(function () {
  var SVGNS = 'http://www.w3.org/2000/svg';
  var HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  var WHOLE = /^\{\{\s*([^}]+?)\s*\}\}$/;

  function lookup(scope, path) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var parts = path.split('.'), v = scope;
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(str, scope) {
    return str.replace(HOLE, function (_, p) { var v = lookup(scope, p); return v == null ? '' : String(v); });
  }

  window.DCLogic = function DCLogic(props) { this.props = props || {}; this.state = {}; };
  DCLogic.prototype.setState = function (o) {
    Object.assign(this.state, typeof o === 'function' ? o(this.state, this.props) : o);
    if (this.__schedule) this.__schedule();
  };
  DCLogic.prototype.forceUpdate = function () { if (this.__schedule) this.__schedule(); };

  window.mountDC = function (Component, tplEl, mountEl, props) {
    var comp = new Component(props || {});
    var handlers = {}, hid = 0, pending = false;

    function build(node, scope, out) {
      for (var c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) { out.appendChild(document.createTextNode(interp(c.nodeValue, scope))); continue; }
        if (c.nodeType !== 1) continue;
        var tag = c.localName;
        if (tag === 'sc-for') {
          var list = lookup(scope, (c.getAttribute('list') || '').replace(/^\{\{|\}\}$/g, '')) || [];
          var as = c.getAttribute('as') || 'item';
          for (var i = 0; i < list.length; i++) { var s = Object.create(scope); s[as] = list[i]; s.$index = i; build(c, s, out); }
          continue;
        }
        if (tag === 'sc-if') {
          if (lookup(scope, (c.getAttribute('value') || '').replace(/^\{\{|\}\}$/g, ''))) build(c, scope, out);
          continue;
        }
        var el = c.namespaceURI === SVGNS ? document.createElementNS(SVGNS, c.localName) : document.createElement(tag);
        var valueProp, hasValue = false;
        for (var a = 0; a < c.attributes.length; a++) {
          var name = c.attributes[a].name, raw = c.attributes[a].value;
          if (name.indexOf('hint-') === 0) continue;
          var m = raw.match(WHOLE);
          if (name.indexOf('on') === 0 && name.length > 2) {
            var fn = m ? lookup(scope, m[1]) : null;
            if (typeof fn === 'function') { var id = 'h' + (hid++); handlers[id] = fn; el.setAttribute('data-on-' + name.slice(2), id); }
            continue;
          }
          var val = m ? lookup(scope, m[1]) : interp(raw, scope);
          if (name === 'value' && (tag === 'input' || tag === 'textarea' || tag === 'select')) { valueProp = val; hasValue = true; continue; }
          if (val === false || val == null) continue;
          if (val === true) { el.setAttribute(name, ''); continue; }
          el.setAttribute(name, String(val));
        }
        build(c, scope, el);
        if (hasValue) {
          var sv = valueProp == null ? '' : String(valueProp);
          if (tag === 'select') {
            Array.prototype.forEach.call(el.querySelectorAll('option'), function (o) { if (o.value === sv) o.setAttribute('selected', ''); });
            el.value = sv;
          } else if (tag === 'textarea') { el.textContent = sv; el.value = sv; }
          else if (el.getAttribute('type') !== 'file') { el.setAttribute('value', sv); el.value = sv; }
        }
        out.appendChild(el);
      }
    }

    function render() {
      pending = false;
      handlers = {}; hid = 0;
      var vals = comp.renderVals();
      var next = document.createElement('div');
      next.id = mountEl.id;
      build(tplEl.content, vals, next);
      morphdom(mountEl, next, {
        onBeforeElUpdated: function (from, to) {
          if (from.isEqualNode(to)) return false;
          if (from.tagName === 'INPUT' && from.type === 'file') {
            // 檔案欄位不能重設，只同步屬性（事件代號會隨每次重繪改變）
            Array.prototype.slice.call(from.attributes).forEach(function (a) { if (!to.hasAttribute(a.name)) from.removeAttribute(a.name); });
            Array.prototype.slice.call(to.attributes).forEach(function (a) { if (from.getAttribute(a.name) !== a.value) from.setAttribute(a.name, a.value); });
            return false;
          }
          return true;
        }
      });
    }
    comp.__schedule = function () { if (!pending) { pending = true; Promise.resolve().then(render); } };

    function dispatch(type, attr) {
      return function (e) {
        for (var n = e.target; n && n !== document; n = n.parentNode) {
          if (n.getAttribute && n.hasAttribute('data-on-' + attr)) {
            var isChangeOnly = n.tagName === 'SELECT' || (n.tagName === 'INPUT' && (n.type === 'file' || n.type === 'checkbox' || n.type === 'radio'));
            if (attr === 'change' && type === 'input' && isChangeOnly) return;
            if (attr === 'change' && type === 'change' && !isChangeOnly) return;
            if (n.disabled) return;
            var fn = handlers[n.getAttribute('data-on-' + attr)];
            if (fn) fn(e);
            return;
          }
        }
      };
    }
    document.addEventListener('click', dispatch('click', 'click'));
    document.addEventListener('input', dispatch('input', 'change'));
    document.addEventListener('change', dispatch('change', 'change'));

    render();
    if (comp.componentDidMount) comp.componentDidMount();
    return comp;
  };
})();

