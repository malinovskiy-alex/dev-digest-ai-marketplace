/*
 * dc-lite — a minimal, dependency-free renderer for Design Component (.dc.html) files,
 * so the prototype exported from the Design canvas runs as a static site on GitHub Pages.
 *
 * Supports exactly what the files in ../design use:
 *   - <helmet> contents → copied into <head>
 *   - {{dotted.path}} holes in text and attributes (a lone hole keeps its raw value)
 *   - <sc-for list="{{xs}}" as="x">, <sc-if value="{{cond}}">
 *   - onClick / onChange / onKeyDown / onSubmit handlers (native events)
 *   - class Component extends DCLogic { constructor(props) · componentDidMount ·
 *     componentWillUnmount · setState · renderVals }
 *   - data-props defaults → this.props
 * Re-renders are batched and morphed into the live DOM, so focus and caret survive typing.
 *
 * Usage: <script src=".../dc-lite.js" data-dc-src=".../Main.dc.html" data-dc-router defer></script>
 */
(function () {
  'use strict';

  const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;
  const LONE = /^\{\{\s*([^}]+?)\s*\}\}$/;
  const BOOL = new Set(['disabled', 'checked', 'selected', 'hidden', 'readonly', 'required', 'open', 'multiple', 'autofocus']);
  const HTML_NS = 'http://www.w3.org/1999/xhtml';

  class DCLogic {
    constructor(props) { this.props = props || {}; this.state = {}; }
    setState(update) {
      if (typeof update === 'function') update = update(this.state, this.props);
      if (!update) return;
      this.state = Object.assign({}, this.state, update);
      if (this.__host) this.__host.schedule();
    }
  }
  window.DCLogic = DCLogic;

  // ---- holes ---------------------------------------------------------------
  function lookup(scope, expr) {
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
    const parts = expr.split('.');
    let v = scope[parts[0]];
    for (let i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
    return v;
  }
  function interp(str, scope) {
    const lone = LONE.exec(str);
    if (lone) return lookup(scope, lone[1]);
    return str.replace(HOLE, (_, e) => { const v = lookup(scope, e); return v == null || v === false ? '' : String(v); });
  }

  // ---- template build ------------------------------------------------------
  // <sc-for>/<sc-if> are rewritten to <template> before parsing so they survive inside <select>, <table>, <ul>.
  function prepare(source) {
    return source
      .replace(/<sc-(for|if)\b/g, '<template data-sc="$1"')
      .replace(/<\/sc-(for|if)>/g, '</template>');
  }
  function kids(node) {
    return node.localName === 'template' && node.content ? Array.from(node.content.childNodes) : Array.from(node.childNodes);
  }
  function eventType(attr, el) {
    const t = attr.slice(2).toLowerCase();
    if (t === 'change' && (el.localName === 'input' || el.localName === 'textarea') && el.type !== 'checkbox' && el.type !== 'radio') return 'input';
    return t;
  }
  function bind(el, type) {
    el.__bound = el.__bound || new Set();
    if (el.__bound.has(type)) return;
    el.__bound.add(type);
    el.addEventListener(type, (ev) => { const f = el.__on && el.__on[type]; if (typeof f === 'function') f(ev); });
  }
  function setValue(el) {
    if (el.__value === undefined) return;
    const v = el.__value == null ? '' : String(el.__value);
    if (el.value !== v) el.value = v;
  }

  function build(nodes, scope, out) {
    for (const n of nodes) {
      if (n.nodeType === 3) { out.push(document.createTextNode(String(interp(n.data, scope) ?? ''))); continue; }
      if (n.nodeType !== 1) continue;
      const sc = n.localName === 'template' && n.getAttribute('data-sc');
      if (sc === 'for') {
        const list = interp(n.getAttribute('list') || '', scope);
        const as = n.getAttribute('as') || 'item';
        if (Array.isArray(list)) list.forEach((item, i) => {
          const child = Object.create(scope); child[as] = item; child.$index = i;
          build(kids(n), child, out);
        });
        continue;
      }
      if (sc === 'if') { if (interp(n.getAttribute('value') || '', scope)) build(kids(n), scope, out); continue; }
      if (n.localName === 'helmet' || n.localName === 'script') continue;

      const el = n.namespaceURI === HTML_NS ? document.createElement(n.localName) : document.createElementNS(n.namespaceURI, n.localName);
      for (const a of Array.from(n.attributes)) {
        const name = a.name;
        if (name.startsWith('hint-')) continue;
        if (/^on[a-z]+$/i.test(name)) {
          const fn = interp(a.value, scope);
          const type = eventType(name, n);
          (el.__on = el.__on || {})[type] = fn;
          bind(el, type);
          continue;
        }
        const v = interp(a.value, scope);
        if (name === 'value' && /^(input|textarea|select)$/.test(n.localName)) { el.__value = v; continue; }
        if (BOOL.has(name)) { if (v && v !== 'false') el.setAttribute(name, ''); continue; }
        if (v == null) continue;
        if (v === false && !name.startsWith('aria-')) continue;
        el.setAttribute(name, String(v));
      }
      const children = [];
      build(kids(n), scope, children);
      children.forEach((c) => el.appendChild(c));
      if (n.localName === 'input' || n.localName === 'textarea') { if (el.__value !== undefined) el.setAttribute('value', el.__value ?? ''); }
      setValue(el);
      out.push(el);
    }
    return out;
  }

  // ---- morph ---------------------------------------------------------------
  function morphEl(live, next) {
    for (const a of Array.from(live.attributes)) if (!next.hasAttribute(a.name)) live.removeAttribute(a.name);
    for (const a of Array.from(next.attributes)) if (live.getAttribute(a.name) !== a.value) live.setAttribute(a.name, a.value);
    live.__on = next.__on;
    if (next.__on) Object.keys(next.__on).forEach((t) => bind(live, t));
    morphKids(live, Array.from(next.childNodes));
    live.__value = next.__value;
    setValue(live);
    if (live.localName === 'input' && (live.type === 'checkbox' || live.type === 'radio')) live.checked = next.hasAttribute('checked');
  }
  function same(a, b) {
    return a.nodeType === b.nodeType && (a.nodeType !== 1 || (a.localName === b.localName && a.namespaceURI === b.namespaceURI));
  }
  function morphKids(live, next) {
    for (let i = 0; i < next.length; i++) {
      const l = live.childNodes[i], n = next[i];
      if (!l) { live.appendChild(n); continue; }
      if (!same(l, n)) { live.replaceChild(n, l); continue; }
      if (l.nodeType === 3) { if (l.data !== n.data) l.data = n.data; continue; }
      morphEl(l, n);
    }
    while (live.childNodes.length > next.length) live.removeChild(live.lastChild);
  }

  // ---- router (optional) -----------------------------------------------------
  // Maps the prototype's internal state.route to real URLs under DD.BASE, so deep links and Back work.
  function makeRouter(dd) {
    const base = dd.BASE;
    const parse = () => {
      let p = decodeURIComponent(location.pathname);
      if (!p.startsWith(base)) return { n: 'home' };
      const seg = p.slice(base.length).split('/').filter(Boolean);
      if (seg[0] === 'index.html') seg.shift();
      const q = new URLSearchParams(location.search);
      if (!seg.length) return { n: 'home' };
      if (seg[0] === 'plugins') {
        if (seg.length === 1) return { n: 'plugins' };
        if (!dd.PM[seg[1]]) return { n: 'nf' };
        if (seg.length === 2) return { n: 'plugin', p: seg[1] };
        if (seg.length === 4 && dd.ARTS.some((a) => a.plugin === seg[1] && a.type === seg[2] && a.name === seg[3])) return { n: 'artifact', p: seg[1], t: seg[2], a: seg[3] };
        return { n: 'nf' };
      }
      if (seg.length === 1) {
        const simple = { stack: 'stack', start: 'start', course: 'course', new: 'newp' };
        if (simple[seg[0]]) return { n: simple[seg[0]] };
        if (seg[0] === 'changelog') return q.get('plugin') ? { n: 'changelog', plugin: q.get('plugin') } : { n: 'changelog' };
      }
      return { n: 'nf' };
    };
    let last = null;
    return {
      parse,
      sync(route) {
        const key = JSON.stringify(route || {});
        if (key === last) return;
        const first = last === null;
        last = key;
        if (!route || route.n === 'nf') return; // keep the URL the user typed
        const url = dd.url(route);
        if (url !== location.pathname + location.search) history[first ? 'replaceState' : 'pushState'](null, '', url + location.hash);
      },
    };
  }

  // ---- mount -----------------------------------------------------------------
  async function mount(src, root, useRouter) {
    const res = await fetch(src, { cache: 'no-cache' });
    if (!res.ok) throw new Error('Cannot load ' + src + ': ' + res.status);
    const doc = new DOMParser().parseFromString(prepare(await res.text()), 'text/html');

    const xdc = doc.querySelector('x-dc');
    const helmet = xdc && xdc.querySelector('helmet');
    if (helmet) Array.from(helmet.children).forEach((c) => document.head.appendChild(document.importNode(c, true)));

    const scriptEl = doc.querySelector('script[data-dc-script]');
    const defaults = {};
    try {
      const decl = JSON.parse(scriptEl.getAttribute('data-props') || '{}');
      Object.keys(decl).forEach((k) => { if (k[0] !== '$' && decl[k] && 'default' in decl[k]) defaults[k] = decl[k].default; });
    } catch (e) { /* no props */ }
    const factory = new Function('DCLogic', scriptEl.textContent + '\n;return { Component: Component, DD: typeof DD !== "undefined" ? DD : null };');
    const { Component, DD } = factory(DCLogic);

    const template = Array.from(xdc.childNodes).filter((n) => !(n.nodeType === 1 && n.localName === 'helmet'));
    const comp = new Component(defaults);
    const router = useRouter && DD && DD.BASE && DD.url ? makeRouter(DD) : null;
    if (router) comp.state = Object.assign({}, comp.state, { route: router.parse() });

    let queued = false;
    const render = () => {
      queued = false;
      const vals = comp.renderVals();
      morphKids(root, build(template, vals, []));
      if (router) router.sync(comp.state.route);
    };
    comp.__host = { schedule() { if (!queued) { queued = true; queueMicrotask(render); } } };
    render();
    if (router) window.addEventListener('popstate', () => comp.setState({ route: router.parse(), menu: false, dialog: null }));
    if (typeof comp.componentDidMount === 'function') comp.componentDidMount();
    window.addEventListener('pagehide', () => { if (typeof comp.componentWillUnmount === 'function') comp.componentWillUnmount(); });
    return comp;
  }

  const me = document.currentScript;
  const start = () => {
    const root = document.getElementById('dc-root');
    mount(me.getAttribute('data-dc-src'), root, me.hasAttribute('data-dc-router')).catch((err) => {
      console.error(err);
      root.innerHTML = '<p style="font:14px system-ui;padding:24px">The page failed to load. <a href="https://github.com/malinovskiy-alex/dev-digest-ai-marketplace">Open the repository</a>.</p>';
    });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
