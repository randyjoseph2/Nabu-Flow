/* Nabu Flow dashboard card. Plain JS on purpose: no template literals, no emoji,
   bare customElements.define (iOS companion WebView rules). Version 0.3.5.
   Card config:
     type: custom:nabu-flow-card
     title: Nabu            (optional)
     limit: 6               (optional, 1-30)
     quiet_entity: input_boolean.nabu_quiet_mode   (optional)
     test_button: true      (optional, admins only)
*/
(function () {
  'use strict';

  var SEV = {
    info: { c: '#5B8DEF', t: 'Info' },
    heads_up: { c: '#F4B942', t: 'Heads up' },
    critical: { c: '#E5484D', t: 'Critical' }
  };

  var CSS = [
    ':host{display:block}',
    'ha-card{padding:14px;overflow:hidden;box-sizing:border-box}',
    '.hd{display:flex;align-items:center;gap:10px;margin-bottom:10px}',
    '.logo{width:34px;height:34px;flex:none}',
    '.ttl{flex:1;min-width:0;font-size:17px;font-weight:600;color:var(--primary-text-color)}',
    '.sub{font-size:12px;color:var(--secondary-text-color);font-weight:400}',
    '.q{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid var(--divider-color);background:transparent;color:var(--secondary-text-color);font-size:12px;cursor:pointer;font-family:inherit}',
    '.q.on{background:rgba(91,141,239,.18);border-color:#5B8DEF;color:var(--primary-text-color)}',
    '.dot{width:8px;height:8px;border-radius:50%;background:var(--disabled-text-color);flex:none}',
    '.q.on .dot{background:#5B8DEF}',
    '.list{display:flex;flex-direction:column;gap:6px}',
    '.row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:var(--secondary-background-color)}',
    '.bar{width:4px;align-self:stretch;border-radius:2px;flex:none}',
    '.mid{flex:1;min-width:0}',
    '.rt{font-size:14px;color:var(--primary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rs{font-size:12px;color:var(--secondary-text-color);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.tm{font-size:12px;color:var(--secondary-text-color);flex:none}',
    '.bad{color:#E5484D}',
    '.empty{padding:18px 6px;text-align:center;color:var(--secondary-text-color);font-size:13px}',
    '.ft{display:flex;gap:8px;margin-top:10px}',
    '.btn{flex:1;padding:9px;border-radius:12px;border:1px solid var(--divider-color);background:transparent;color:var(--primary-text-color);font-size:13px;cursor:pointer;font-family:inherit}'
  ].join('');

  var FACE = '<svg class="logo" viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" rx="40" fill="#F4E9D8"/><path d="M40 92 L100 40 L160 92 V160 H40 Z" fill="#E8A87C"/><rect x="62" y="96" width="76" height="44" rx="12" fill="#2B2D42"/><circle cx="82" cy="118" r="8" fill="#8FE3CF"/><circle cx="118" cy="118" r="8" fill="#8FE3CF"/></svg>';

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function when(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) { return ''; }
    var now = new Date();
    var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (d.toDateString() === now.toDateString()) { return hm; }
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }

  class NabuFlowCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._cfg = {};
      this._items = null;
      this._quietEntity = '';
      this._timer = null;
      this._busy = false;
      this._hass = null;
      this._sig = '';
      this.shadowRoot.addEventListener('click', this._onClick.bind(this));
    }

    setConfig(config) {
      this._cfg = config || {};
      this._quietEntity = this._cfg.quiet_entity || '';
      this._render();
    }

    getCardSize() { return 4; }

    static getStubConfig() { return { title: 'Nabu', limit: 6 }; }

    set hass(h) {
      var first = !this._hass;
      this._hass = h;
      if (first) { this._load(); }
      var sig = this._quietState() + '|' + (h.user && h.user.is_admin ? 'a' : 'u');
      if (sig !== this._sig) { this._sig = sig; this._render(); }
    }

    connectedCallback() {
      var self = this;
      if (this._timer) { return; }
      this._timer = setInterval(function () { self._load(); }, 20000);
      if (this._hass) { this._load(); }
    }

    disconnectedCallback() {
      if (this._timer) { clearInterval(this._timer); this._timer = null; }
    }

    _quietState() {
      var id = this._quietEntity;
      if (!id || !this._hass || !this._hass.states[id]) { return 'none'; }
      return this._hass.states[id].state;
    }

    _load() {
      var self = this;
      if (!this._hass || this._busy) { return; }
      this._busy = true;
      var limit = parseInt(this._cfg.limit, 10);
      if (!(limit >= 1 && limit <= 30)) { limit = 6; }
      this._hass.callWS({ type: 'nabu_flow/recent', limit: limit }).then(function (res) {
        self._busy = false;
        self._items = res.items || [];
        if (!self._quietEntity) { self._quietEntity = res.quiet_entity || ''; }
        self._render();
      }, function () {
        self._busy = false;
        if (self._items === null) { self._items = []; }
        self._render();
      });
    }

    _onClick(ev) {
      var el = ev.target.closest('[data-act]');
      if (!el || !this._hass) { return; }
      var act = el.getAttribute('data-act');
      var self = this;
      if (act === 'quiet' && this._quietEntity) {
        this._hass.callService('input_boolean', 'toggle', { entity_id: this._quietEntity });
      } else if (act === 'refresh') {
        this._load();
      } else if (act === 'test') {
        this._hass.callService('nabu_flow', 'notify', {
          title: 'Test from the Nabu card',
          message: 'Card test post',
          severity: 'info',
          phone: 'none'
        }).then(function () { setTimeout(function () { self._load(); }, 1500); });
      }
    }

    _render() {
      var cfg = this._cfg;
      var quiet = this._quietState();
      var admin = !!(this._hass && this._hass.user && this._hass.user.is_admin);
      var h = '<style>' + CSS + '</style><ha-card>';
      h += '<div class="hd">' + FACE + '<div class="ttl">' + esc(cfg.title || 'Nabu') + '<div class="sub">Notifications</div></div>';
      if (quiet !== 'none') {
        var on = quiet === 'on';
        h += '<button class="q' + (on ? ' on' : '') + '" data-act="quiet"><span class="dot"></span>' + (on ? 'Quiet on' : 'Quiet off') + '</button>';
      }
      h += '</div>';
      var items = this._items;
      if (items === null) {
        h += '<div class="empty">Loading</div>';
      } else if (!items.length) {
        h += '<div class="empty">Nothing sent yet</div>';
      } else {
        h += '<div class="list">';
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var sev = SEV[it.severity] || SEV.info;
          var sub = (it.channel || 'phone only').replace(/_/g, ' ');
          var cls = '';
          if (it.suppressed) { sub += ' - held (' + esc(it.suppressed) + ')'; }
          else if (!it.ok) { sub += ' - failed'; cls = ' bad'; }
          h += '<div class="row"><div class="bar" style="background:' + sev.c + '"></div><div class="mid"><div class="rt">' + esc(it.title || it.route || 'Notification') + '</div><div class="rs' + cls + '">' + esc(sub) + '</div></div><div class="tm">' + esc(when(it.ts)) + '</div></div>';
        }
        h += '</div>';
      }
      h += '<div class="ft"><button class="btn" data-act="refresh">Refresh</button>';
      if (admin && cfg.test_button) { h += '<button class="btn" data-act="test">Send test</button>'; }
      h += '</div></ha-card>';
      this.shadowRoot.innerHTML = h;
    }
  }

  customElements.define('nabu-flow-card', NabuFlowCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'nabu-flow-card',
    name: 'Nabu Flow',
    description: 'Recent notifications and a quiet-mode switch'
  });
})();
