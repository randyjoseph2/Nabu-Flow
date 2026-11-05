/* Nabu top bar: a header card with a logo, title, Assist button and pill tabs
   that act as the pages of a dashboard. Plain JS on purpose: no template
   literals, no emoji, bare customElements.define (iOS companion WebView rules).
   Version 1.1.3-beta. The logo is the Assist button.
   Card config:
     type: custom:nabu-top-bar
     title: NewUI 4.0
     subtitle: Home Assistant        (optional)
     assist: true                    (optional, default true; the logo opens Assist)
     menu: true                      (optional, default true; false hides the sidebar button)
     alerts: true                    (optional; shows the Alerts Flow strip under the title)
     alerts:                         (or an object)
       layout: strip | bubble | auto   strip = full width under the title (default),
                                       bubble = pill beside the logo and title,
                                       auto = bubble when the bar is 700px or wider
       hide_when_clear, controls, only, skip
     alerts_compact: true            (optional; smaller strip)
     pages:
       - label: Home
         path: /newui-4-0/home-2-0
         badge: sensor.chore_quest_open   (optional; a count bubble on the pill, hidden at 0)
       - label: Cameras
         path: /newui-4-0/cameras
*/
(function () {
  'use strict';
  if (window.customElements.get('nabu-top-bar')) { return; }

  var CSS = [
    ':host{display:block;--nb-accent:#F7CB6B;--nb-ink:#14151A}',
    '.wrap{padding:6px 4px 4px;box-sizing:border-box}',
    '.top{display:flex;align-items:center;gap:12px}',
    '.ib{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;border:0;background:transparent;color:var(--primary-text-color,#fff);border-radius:14px;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}',
    '.ib ha-icon{--mdc-icon-size:26px}',
    '.logo{width:52px;height:52px;flex:none}',
    '.txt{flex:0 1 auto;min-width:0}',
    '.ttl{font-size:26px;line-height:1.1;font-weight:700;color:var(--primary-text-color,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sub{margin-top:3px;font-size:14px;color:var(--secondary-text-color,#9aa0ad);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.alerts{padding:0 4px}',
    '.alerts:empty{display:none}',
    '.bub{flex:1 1 0;min-width:0;position:relative;margin:0 0 0 28px}',
    '.bub:empty{display:none}',
    '.dbg{font-size:11px;color:#ff9a9d;text-align:right;line-height:1.2}',
    '.bub nabu-alert-strip{margin-top:0}',
    '.logob{flex:none;display:block;border:0;background:none;padding:0;margin:0;cursor:pointer;border-radius:14px;-webkit-tap-highlight-color:transparent}',
    '.logob:active{opacity:.7}',
    'nabu-alert-strip{display:block;margin-top:12px}',
    'nabu-alert-strip[hidden]{display:none}',
    '.pills{position:relative;display:flex;gap:10px;overflow-x:auto;margin-top:14px;padding:2px 14px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scroll-padding:0 14px;overscroll-behavior-x:contain}',
    '.pills::-webkit-scrollbar{display:none}',
    '.pill{flex:none;scroll-snap-align:center;display:flex;align-items:center;gap:6px;padding:11px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);color:var(--secondary-text-color,#9aa0ad);font-size:17px;font-weight:500;font-family:inherit;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}',
    '.pill ha-icon{--mdc-icon-size:18px}',
    '.bdg{display:none;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;margin-left:2px;border-radius:10px;background:#ff5a4f;color:#fff;font-size:12px;font-weight:800;line-height:1}',
    '.bdg.show{display:inline-flex}',
    '.pill.on .bdg{background:var(--nb-ink);color:var(--nb-accent)}',
    '.pill.on{background:var(--nb-accent);border-color:var(--nb-accent);color:var(--nb-ink);font-weight:700}',
    '.wrap.xm{position:relative;padding-top:13px}',
    '.wrap.xm .top,.wrap.xm .alerts,.wrap.xm .pills{position:relative;z-index:1}',
    '.snow{position:absolute;left:0;right:0;top:0;bottom:0;overflow:hidden;pointer-events:none;border-radius:inherit}',
    '.fl{position:absolute;top:-8px;background:#fff;border-radius:50%;opacity:.6;animation:nb-fall linear infinite;will-change:transform}',
    '@keyframes nb-fall{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(var(--dx),230px,0)}}',
    '.lights{position:absolute;left:8px;right:8px;top:0;display:flex;justify-content:space-between;pointer-events:none;border-top:1px solid rgba(255,255,255,.16);border-radius:50%/6px;z-index:2}',
    '.lb{width:6px;height:9px;margin-top:-1px;border-radius:50% 50% 50% 50%/35% 35% 65% 65%;animation:nb-tw 2.6s ease-in-out infinite}',
    '.lb:nth-child(4n+1){background:#ff5a4f;box-shadow:0 0 7px #ff5a4f}',
    '.lb:nth-child(4n+2){background:#4ade80;box-shadow:0 0 7px #4ade80;animation-delay:.6s}',
    '.lb:nth-child(4n+3){background:#F7CB6B;box-shadow:0 0 7px #F7CB6B;animation-delay:1.2s}',
    '.lb:nth-child(4n){background:#60a5fa;box-shadow:0 0 7px #60a5fa;animation-delay:1.8s}',
    '@keyframes nb-tw{0%,100%{opacity:1}50%{opacity:.35}}',
    '.tw{animation:nb-tw 1.8s ease-in-out infinite;transform-box:fill-box;transform-origin:center}',
    '.tw2{animation-delay:.7s}.tw3{animation-delay:1.3s}',
    '.xm-c{display:inline-flex;align-items:center;gap:6px;margin-top:5px;padding:3px 10px 3px 7px;border-radius:999px;border:1px solid var(--nb-accent);background:rgba(255,255,255,.05);color:var(--nb-accent);font-size:13px;font-weight:700;line-height:1.3;white-space:nowrap;max-width:100%}',
    '.xm-c svg{width:14px;height:14px;flex:none}',
    '.xm-c .xl{font-weight:500;opacity:.8}'
  ].join('');

  // Santa hat and sparkles, drawn on top of the logo while Christmas mode is on.
  var HAT = '<g transform="rotate(-8 60 24)"><path d="M26 30 C24 8 58 -6 88 6 C104 12 112 24 112 34 C98 22 84 22 70 22 C56 22 40 24 26 30 Z" fill="#E5484D"/><path d="M28 28 C28 14 48 4 70 4 C60 10 44 16 28 28 Z" fill="#F26C70" opacity=".6"/><rect x="18" y="22" width="84" height="15" rx="7.5" fill="#fff"/><circle cx="112" cy="34" r="8" fill="#fff"/></g>' +
    '<path class="tw" d="M8 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#F7CB6B"/><path class="tw tw2" d="M112 62 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="#fff"/><path class="tw tw3" d="M10 102 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6z" fill="#fff"/>';
  var TREE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1 L12.5 7 H10.5 L14 12 H2 L5.5 7 H3.5 Z" fill="#4ade80"/><rect x="7" y="12" width="2" height="3" fill="#b8793e"/><circle cx="8" cy="1.6" r="1.4" fill="#F7CB6B"/></svg>';
  var LOGO = '<svg class="logo" viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" rx="26" fill="#F4E9D8"/><line x1="60" y1="24" x2="60" y2="14" stroke="#C99A3B" stroke-width="3"/><circle cx="60" cy="12" r="4" fill="#E9B44C"/><rect x="26" y="26" width="68" height="62" rx="18" fill="#1F3441"/><rect x="18" y="46" width="8" height="20" rx="4" fill="#1F3441"/><rect x="94" y="46" width="8" height="20" rx="4" fill="#1F3441"/><circle cx="46" cy="52" r="10" fill="#F4E9D8"/><circle cx="74" cy="52" r="10" fill="#F4E9D8"/><circle cx="46" cy="52" r="5" fill="#E9B44C"/><circle cx="74" cy="52" r="5" fill="#E9B44C"/><path d="M48 70 Q60 80 72 70" stroke="#F4E9D8" stroke-width="4" fill="none" stroke-linecap="round"/></svg>';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function norm(p) {
    var s = String(p || '').split('?')[0].split('#')[0];
    return s.replace(/\/+$/, '');
  }

  function go(path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  class NabuTopBar extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._cfg = { pages: [] };
      this._active = '';
      this._onLoc = this._refreshActive.bind(this);
      this._strip = null;
      this._raf = 0;
      this._pinned = false;
      this._onScroll = function () {
        if (this._raf) { return; }
        var self = this;
        this._raf = window.requestAnimationFrame(function () { self._raf = 0; self._pin(); });
      }.bind(this);
      this.shadowRoot.addEventListener('click', this._onClick.bind(this));
    }

    setConfig(config) {
      this._cfg = config || {};
      if (!this._cfg.pages) { this._cfg.pages = []; }
      this._active = this._findActive();
      this._render();
    }

    getCardSize() { return 2; }

    static getStubConfig() {
      return { title: 'NewUI 4.0', pages: [{ label: 'Home', path: '/lovelace/0' }] };
    }

    set hass(h) {
      this._hass = h;
      if (this._strip) { this._strip.hass = h; }
      this._refreshActive();
      this._refreshBadges();
      if (this.shadowRoot.firstChild) { this._xmCheck(); }
    }

    connectedCallback() {
      var self = this;
      if (window.ResizeObserver && !this._ro) {
        this._lastW = 0;
        this._ro = new window.ResizeObserver(function () {
          var w = self.offsetWidth >= 700;
          if (w !== self._lastW) { self._lastW = w; self._placeStrip(); }
        });
        this._ro.observe(this);
      }
      window.addEventListener('location-changed', this._onLoc);
      window.addEventListener('popstate', this._onLoc);
      window.addEventListener('scroll', this._onScroll, true);
      window.addEventListener('resize', this._onScroll);
      this._refreshActive();
      if (!this._xmTimer && this._cfg.christmas !== false && this.shadowRoot.firstChild) { this._render(); }
    }

    disconnectedCallback() {
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._diagTimer) { clearInterval(this._diagTimer); this._diagTimer = null; }
      window.removeEventListener('location-changed', this._onLoc);
      window.removeEventListener('popstate', this._onLoc);
      window.removeEventListener('scroll', this._onScroll, true);
      window.removeEventListener('resize', this._onScroll);
      this._unpin();
      if (this._xmTimer) { clearInterval(this._xmTimer); this._xmTimer = null; }
    }

    // Keep the bar on screen while the page scrolls (sticky: false turns this off).
    _scroller() {
      var n = this;
      for (var i = 0; i < 40 && n; i++) {
        n = n.parentElement || (n.getRootNode && n.getRootNode().host) || null;
        if (n && n.nodeType === 1) {
          var oy = window.getComputedStyle(n).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) { return n; }
        }
      }
      return null;
    }

    _pin() {
      var wrap = this.shadowRoot && this.shadowRoot.querySelector('.wrap');
      if (!wrap || this._cfg.sticky === false) { return; }
      var sc = this._scroller();
      var st = sc ? sc.scrollTop : (window.pageYOffset || 0);
      var r = this.getBoundingClientRect();
      if (st <= 2) { this._unpin(); return; }
      var top = this._pinTop;
      if (!this._pinned || top == null) { top = r.top + st; this._pinTop = top; }
      if (!this._pinned) {
        this.style.height = wrap.offsetHeight + 'px';
        this._pinned = true;
        if (window.ResizeObserver) {
          var self = this;
          this._wro = new window.ResizeObserver(function () { self.style.height = wrap.offsetHeight + 'px'; });
          this._wro.observe(wrap);
        }
      }
      var ws = wrap.style;
      ws.position = 'fixed';
      ws.top = Math.max(0, top) + 'px';
      ws.left = r.left + 'px';
      ws.width = r.width + 'px';
      ws.zIndex = '7';
      ws.background = this._cfg.sticky_bg || 'rgba(16,17,24,.92)';
      ws.borderRadius = '0 0 18px 18px';
      ws.boxShadow = '0 6px 18px rgba(0,0,0,.35)';
    }

    _unpin() {
      if (this._wro) { this._wro.disconnect(); this._wro = null; }
      if (!this._pinned) { return; }
      this._pinned = false;
      this._pinTop = null;
      this.style.height = '';
      var wrap = this.shadowRoot && this.shadowRoot.querySelector('.wrap');
      if (wrap) { wrap.removeAttribute('style'); }
    }

    // ---------- Christmas mode ----------
    // Themed while input_boolean.christmas_mode is on (christmas: false disables, christmas.entity overrides).
    // Counts down to Christmas, then to New Year, and ends itself a few days into January.
    _xmCfg() { var c = this._cfg.christmas; return c === false ? null : (c && typeof c === 'object' ? c : {}); }

    _xmState() {
      var c = this._xmCfg();
      if (!c) { return null; }
      var ent = c.entity || 'input_boolean.christmas_mode';
      var st = this._hass && this._hass.states ? this._hass.states[ent] : null;
      if (!c.preview && !(st && st.state === 'on')) { return null; }
      var n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate();
      var end = c.end_days != null ? c.end_days : 3;
      if (m === 0) { return d <= end ? { msg: 'Happy New Year!' } : null; }
      if (m === 11 && d === 25) { return { msg: 'Merry Christmas!' }; }
      if (m === 11 && d > 25) { return { to: new Date(y + 1, 0, 1).getTime(), label: 'to New Year' }; }
      return { to: new Date(y, 11, 25).getTime(), label: 'to Christmas' };
    }

    _xmText(x) {
      if (x.msg) { return x.msg; }
      var t = Math.max(0, Math.floor((x.to - Date.now()) / 1000));
      var dd = Math.floor(t / 86400), hh = Math.floor(t % 86400 / 3600), mm = Math.floor(t % 3600 / 60), ss = t % 60;
      function z(v) { return (v < 10 ? '0' : '') + v; }
      return (dd > 0 ? dd + 'd ' : '') + z(hh) + ':' + z(mm) + ':' + z(ss);
    }

    _xmCheck() {
      var x = this._xmState();
      var key = x ? (x.msg || x.label) : '';
      if (key !== this._xmKey) { this._render(); return; }
      var el = x && !x.msg ? this.shadowRoot.querySelector('.xt') : null;
      if (el) { el.textContent = this._xmText(x); }
    }

    _xmHtml() {
      var h = '<div class="lights">';
      for (var i = 0; i < 16; i++) { h += '<span class="lb"></span>'; }
      h += '</div>';
      if (this._xmCfg().snow !== false) {
        h += '<div class="snow">';
        for (var k = 0; k < 14; k++) {
          var r = (k * 37 % 100), sz = 2 + (k % 3);
          h += '<span class="fl" style="left:' + r + '%;width:' + sz + 'px;height:' + sz + 'px;--dx:' + ((k % 2 ? 1 : -1) * (10 + k * 2)) + 'px;animation-duration:' + (7 + (k * 5 % 6)) + 's;animation-delay:-' + (k * 3 % 9) + 's"></span>';
        }
        h += '</div>';
      }
      return h;
    }

    _findActive() {
      var here = norm(window.location.pathname);
      var pages = this._cfg.pages || [];
      var best = '';
      for (var i = 0; i < pages.length; i++) {
        var p = norm(pages[i].path);
        if (p && (here === p || here.indexOf(p + '/') === 0) && p.length > best.length) { best = p; }
      }
      return best;
    }

    _refreshActive() {
      var a = this._findActive();
      if (a !== this._active) {
        this._active = a;
        this._render();
      }
    }

    _onClick(ev) {
      var el = ev.target.closest('[data-act]');
      if (!el) { return; }
      var act = el.getAttribute('data-act');
      if (act === 'menu') {
        this.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true, composed: true }));
      } else if (act === 'assist') {
        this._openAssist();
      } else if (act === 'page') {
        var path = el.getAttribute('data-path');
        if (path && norm(path) !== norm(window.location.pathname)) { go(path); }
      }
    }

    _openAssist() {
      var key = { key: 'a', code: 'KeyA', bubbles: true, composed: true };
      window.dispatchEvent(new KeyboardEvent('keydown', key));
      var url = new URL(window.location.href);
      url.searchParams.set('conversation', '1');
      go(url.pathname + url.search);
    }

    _render() {
      var cfg = this._cfg;
      var xm = this._xmState();
      this._xmKey = xm ? (xm.msg || xm.label) : '';
      if (this._xmTimer) { clearInterval(this._xmTimer); this._xmTimer = null; }
      var self = this;
      if (this._xmCfg() && this._cfg.christmas !== false) { this._xmTimer = setInterval(function () { self._xmCheck(); }, 1000); }
      var h = '<style>' + CSS + '</style><div class="wrap' + (xm ? ' xm' : '') + '">' + (xm ? this._xmHtml() : '') + '<div class="top">';
      if (cfg.menu !== false) {
        h += '<button class="ib" data-act="menu" aria-label="Menu"><ha-icon icon="mdi:menu"></ha-icon></button>';
      }
      var logo = xm ? LOGO.replace('class="logo"', 'class="logo" style="overflow:visible"').replace('</svg>', HAT + '</svg>') : LOGO;
      // The Nabu logo is the Assist button (set assist: false to make it a plain logo).
      h += cfg.assist !== false ? '<button class="logob" data-act="assist" aria-label="Talk to Nabu">' + logo + '</button>' : logo;
      h += '<div class="txt"><div class="ttl">' + esc(cfg.title || 'Nabu') + '</div>';
      if (cfg.subtitle) { h += '<div class="sub">' + esc(cfg.subtitle) + '</div>'; }
      if (xm) { h += '<div class="xm-c">' + TREE + '<span class="xt">' + esc(this._xmText(xm)) + '</span>' + (xm.label ? '<span class="xl">' + xm.label + '</span>' : '') + '</div>'; }
      h += '</div>';
      if (cfg.alerts) { h += '<div class="bub"></div>'; }
      h += '</div>';
      if (cfg.alerts) { h += '<div class="alerts"></div>'; }
      h += '<div class="pills">';
      var pages = cfg.pages;
      for (var i = 0; i < pages.length; i++) {
        var pg = pages[i];
        var on = this._active && norm(pg.path) === this._active;
        h += '<button class="pill' + (on ? ' on' : '') + '" data-act="page" data-path="' + esc(pg.path) + '">';
        if (pg.icon) { h += '<ha-icon icon="' + esc(pg.icon) + '"></ha-icon>'; }
        h += esc(pg.label || pg.path);
        if (pg.badge) { h += '<span class="bdg" data-ent="' + esc(pg.badge) + '"></span>'; }
        h += '</button>';
      }
      h += '</div></div>';
      this.shadowRoot.innerHTML = h;
      this._mountStrip();
      this._centerActive();
      this._refreshBadges();
      if (this._pinned) { if (this._wro) { this._wro.disconnect(); this._wro = null; } this._pinned = false; this._pin(); }
    }

    _refreshBadges() {
      if (!this._hass || !this.shadowRoot) { return; }
      var list = this.shadowRoot.querySelectorAll('.bdg');
      for (var i = 0; i < list.length; i++) {
        var st = this._hass.states[list[i].getAttribute('data-ent')];
        var n = st ? parseFloat(st.state) : 0;
        if (n > 0) {
          list[i].textContent = n > 99 ? '99+' : String(Math.round(n));
          list[i].classList.add('show');
        } else {
          list[i].classList.remove('show');
        }
      }
    }

    _mountStrip() {
      if (!this._cfg.alerts) { return; }
      if (!this._diagTimer) {
        var me = this;
        this._diagTimer = setInterval(function () { me._diag(); }, 5000);
      }
      if (!this._strip) {
        if (!window.customElements.get('nabu-alert-strip')) {
          // The alerts file can finish loading after this card; mount as soon as it does.
          if (!this._waiting) {
            var self = this;
            this._waiting = true;
            window.customElements.whenDefined('nabu-alert-strip').then(function () { self._waiting = false; self._mountStrip(); });
          }
          return;
        }
        this._strip = document.createElement('nabu-alert-strip');
        if (this._hass) { this._strip.hass = this._hass; }
      }
      this._placeStrip();
    }

    // Some displays skip the alerts file. Load it ourselves once and keep any error to show.
    _fallbackLoad() {
      if (this._tried) { return; }
      this._tried = true;
      var self = this;
      var onErr = function (e) { self._loadErr = String((e && (e.message || e.type)) || 'error').slice(0, 90); };
      window.addEventListener('error', onErr);
      var s = document.createElement('script');
      s.src = '/nabu_flow_static/nabu-flow-alerts.js?v=1.1.3-beta&fb=1';
      s.onerror = function () { self._loadErr = self._loadErr || 'file would not download'; };
      s.onload = function () {
        window.removeEventListener('error', onErr);
        if (!window.customElements.get('nabu-alert-strip')) { self._loadErr = self._loadErr || 'ran but did not register'; }
      };
      document.head.appendChild(s);
    }

    // If the alerts strip can not show, say why on screen instead of failing silently.
    _diag() {
      var self = this;
      if (!this._cfg.alerts) { return; }
      var slot = this.shadowRoot.querySelector('.bub') || this.shadowRoot.querySelector('.alerts');
      if (!slot) { return; }
      var old = slot.querySelector('.dbg');
      if (old) { old.parentNode.removeChild(old); }
      var why = '';
      if (!window.customElements.get('nabu-alert-strip')) { why = 'alerts file did not load' + (this._loadErr ? ' (' + this._loadErr + ')' : ''); this._fallbackLoad(); }
      else if (!this._strip) { why = 'strip not created'; }
      else if (this._strip.hidden) { why = this._strip._dbg || 'no data yet'; }
      if (why) {
        var d = document.createElement('div');
        d.className = 'dbg';
        d.textContent = 'alerts: ' + why;
        slot.appendChild(d);
      }
    }

    // The strip is one element that moves between the full-width slot and the bubble slot.
    _placeStrip() {
      if (!this._strip) { return; }
      var opt = typeof this._cfg.alerts === 'object' ? this._cfg.alerts : {};
      var layout = opt.layout || 'strip';
      var bubble = layout === 'bubble' || (layout === 'auto' && this.offsetWidth >= 700);
      var slot = this.shadowRoot.querySelector(bubble ? '.bub' : '.alerts');
      if (!slot) { return; }
      if (this._strip.parentNode !== slot) { slot.appendChild(this._strip); }
      this._strip.setConfig({ compact: !!this._cfg.alerts_compact && !bubble, bubble: bubble, hide_when_clear: !!opt.hide_when_clear, controls: opt.controls, only: opt.only, skip: opt.skip });
    }

    _centerActive() {
      var self = this;
      var place = function () {
        var box = self.shadowRoot.querySelector('.pills');
        var on = self.shadowRoot.querySelector('.pill.on');
        if (!box || !on || !box.clientWidth) { return false; }
        var left = on.offsetLeft - (box.clientWidth - on.offsetWidth) / 2;
        box.scrollLeft = Math.max(0, left);
        return true;
      };
      if (!place()) {
        window.requestAnimationFrame(function () {
          if (!place()) { setTimeout(place, 120); }
        });
      }
    }
  }

  customElements.define('nabu-top-bar', NabuTopBar);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'nabu-top-bar',
    name: 'Nabu top bar',
    description: 'Header with title, Assist button and pill tabs for dashboard pages'
  });
})();
