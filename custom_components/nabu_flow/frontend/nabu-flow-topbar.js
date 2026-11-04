/* Nabu top bar: a header card with a logo, title, Assist button and pill tabs
   that act as the pages of a dashboard. Plain JS on purpose: no template
   literals, no emoji, bare customElements.define (iOS companion WebView rules).
   Version 1.1.1-beta. The logo is the Assist button.
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
    '.pill.on{background:var(--nb-accent);border-color:var(--nb-accent);color:var(--nb-ink);font-weight:700}'
  ].join('');

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
      this._refreshActive();
    }

    disconnectedCallback() {
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      if (this._diagTimer) { clearInterval(this._diagTimer); this._diagTimer = null; }
      window.removeEventListener('location-changed', this._onLoc);
      window.removeEventListener('popstate', this._onLoc);
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
      var h = '<style>' + CSS + '</style><div class="wrap"><div class="top">';
      if (cfg.menu !== false) {
        h += '<button class="ib" data-act="menu" aria-label="Menu"><ha-icon icon="mdi:menu"></ha-icon></button>';
      }
      // The Nabu logo is the Assist button (set assist: false to make it a plain logo).
      h += cfg.assist !== false ? '<button class="logob" data-act="assist" aria-label="Talk to Nabu">' + LOGO + '</button>' : LOGO;
      h += '<div class="txt"><div class="ttl">' + esc(cfg.title || 'Nabu') + '</div>';
      if (cfg.subtitle) { h += '<div class="sub">' + esc(cfg.subtitle) + '</div>'; }
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
      s.src = '/nabu_flow_static/nabu-flow-alerts.js?v=1.1.1-beta&fb=1';
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
