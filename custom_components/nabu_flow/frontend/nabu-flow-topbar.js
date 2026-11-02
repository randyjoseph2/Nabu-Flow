/* Nabu top bar: a header card with a logo, title, Assist button and pill tabs
   that act as the pages of a dashboard. Plain JS on purpose: no template
   literals, no emoji, bare customElements.define (iOS companion WebView rules).
   Version 0.3.5.
   Card config:
     type: custom:nabu-top-bar
     title: NewUI 4.0
     subtitle: Home Assistant        (optional)
     assist: true                    (optional, default true)
     menu: true                      (optional, default true; false hides the sidebar button)
     pages:
       - label: Home
         path: /newui-4-0/home-2-0
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
    '.ib.assist{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12)}',
    '.logo{width:52px;height:52px;flex:none}',
    '.txt{flex:1;min-width:0}',
    '.ttl{font-size:26px;line-height:1.1;font-weight:700;color:var(--primary-text-color,#fff);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.sub{margin-top:3px;font-size:14px;color:var(--secondary-text-color,#9aa0ad);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.pills{position:relative;display:flex;gap:10px;overflow-x:auto;margin-top:14px;padding:2px 14px 6px;scrollbar-width:none;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scroll-padding:0 14px;overscroll-behavior-x:contain}',
    '.pills::-webkit-scrollbar{display:none}',
    '.pill{flex:none;scroll-snap-align:center;display:flex;align-items:center;gap:6px;padding:11px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.03);color:var(--secondary-text-color,#9aa0ad);font-size:17px;font-weight:500;font-family:inherit;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}',
    '.pill ha-icon{--mdc-icon-size:18px}',
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
      this._refreshActive();
    }

    connectedCallback() {
      window.addEventListener('location-changed', this._onLoc);
      window.addEventListener('popstate', this._onLoc);
      this._refreshActive();
    }

    disconnectedCallback() {
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
      h += LOGO;
      h += '<div class="txt"><div class="ttl">' + esc(cfg.title || 'Nabu') + '</div>';
      if (cfg.subtitle) { h += '<div class="sub">' + esc(cfg.subtitle) + '</div>'; }
      h += '</div>';
      if (cfg.assist !== false) {
        h += '<button class="ib assist" data-act="assist" aria-label="Talk to Nabu"><ha-icon icon="mdi:microphone-message"></ha-icon></button>';
      }
      h += '</div><div class="pills">';
      var pages = cfg.pages;
      for (var i = 0; i < pages.length; i++) {
        var pg = pages[i];
        var on = this._active && norm(pg.path) === this._active;
        h += '<button class="pill' + (on ? ' on' : '') + '" data-act="page" data-path="' + esc(pg.path) + '">';
        if (pg.icon) { h += '<ha-icon icon="' + esc(pg.icon) + '"></ha-icon>'; }
        h += esc(pg.label || pg.path) + '</button>';
      }
      h += '</div></div>';
      this.shadowRoot.innerHTML = h;
      this._centerActive();
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
