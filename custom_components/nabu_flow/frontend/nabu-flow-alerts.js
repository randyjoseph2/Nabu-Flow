/* Alerts Flow strip. Shows the alerts the Nabu Flow server is tracking: cycling ticker,
   swipe, tap/hold actions, snooze, list, camera, and a clear-state clock or weather widget.
   Used inside custom:nabu-top-bar (alerts: true) and as custom:nabu-alerts-card.
   Plain JS on purpose: no template literals, no emoji, bare customElements.define
   (iOS companion WebView rules). Version 1.1.3-beta.

   Card config (all optional):
     type: custom:nabu-alerts-card
     compact: false          smaller padding
     bubble: false           pill-shaped, for sitting beside a title in a wide header
     hide_when_clear: false  hide the card instead of showing the clear widget
     controls: true          show prev/next, snooze and list buttons
     only: [rule_id, ...]    show just these rules on this dashboard (optional)
     skip: [rule_id, ...]    hide these rules on this dashboard (optional)
*/
(function () {
  'use strict';
  if (window.customElements.get('nabu-alert-strip')) { return; }

  var COLORS = { critical: '#E5484D', warning: '#FFC857', info: '#5B8DEF', low: '#9aa4b2' };
  var WX = {
    'clear-night': 'mdi:weather-night', cloudy: 'mdi:weather-cloudy', fog: 'mdi:weather-fog', hail: 'mdi:weather-hail',
    lightning: 'mdi:weather-lightning', 'lightning-rainy': 'mdi:weather-lightning-rainy', partlycloudy: 'mdi:weather-partly-cloudy',
    pouring: 'mdi:weather-pouring', rainy: 'mdi:weather-rainy', snowy: 'mdi:weather-snowy', 'snowy-rainy': 'mdi:weather-snowy-rainy',
    sunny: 'mdi:weather-sunny', windy: 'mdi:weather-windy', 'windy-variant': 'mdi:weather-windy-variant', exceptional: 'mdi:alert-circle-outline'
  };

  var CSS = [
    ':host{display:block;container-type:inline-size;--ac:#5EEAD4}',
    ':host([hidden]){display:none}',
    '*{box-sizing:border-box}',
    '.strip{position:relative;display:flex;align-items:center;gap:6px;min-height:60px;padding:8px 6px 8px 10px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.1);overflow:hidden;color:var(--primary-text-color,#fff)}',
    '.strip.bord{border-left:5px solid var(--ac)}',
    '.strip.compact{min-height:50px;padding:5px 6px 5px 10px}',
    '.strip.critical{animation:nb-glow 2.4s ease-in-out infinite}',
    '@keyframes nb-glow{0%,100%{box-shadow:0 0 0 rgba(229,72,77,0)}50%{box-shadow:0 0 16px rgba(229,72,77,.45)}}',
    '.main{flex:1;min-width:0;display:flex;align-items:center;gap:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:pan-y;user-select:none;-webkit-user-select:none}',
    '.ic{width:36px;height:36px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.08);color:var(--ac)}',
    '.ic ha-icon{--mdc-icon-size:24px}',
    '.tx{flex:1;min-width:0}',
    '.msg{font-size:15px;font-weight:600;line-height:1.25;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}',
    '.sec{margin-top:2px;font-size:12px;color:var(--secondary-text-color,#9aa4b2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.cam{width:56px;height:42px;flex:none;border-radius:10px;object-fit:cover;background:#000}',
    '.side{flex:none;display:flex;align-items:center;gap:2px}',
    '.cnt{min-width:34px;text-align:center;font-size:12px;color:var(--secondary-text-color,#9aa4b2)}',
    'button.cnt{min-width:46px;height:32px;margin:0 2px;border:0;border-radius:999px;background:rgba(255,255,255,.1);color:var(--primary-text-color,#fff);font:inherit;font-size:13px;cursor:pointer}',
    'button.cnt.on{background:rgba(255,255,255,.2)}',
    '.wide{display:none}',
    '@container (min-width:480px){.wide{display:flex}}',
    '.b{width:38px;height:38px;display:flex;align-items:center;justify-content:center;border:0;padding:0;border-radius:12px;background:transparent;color:var(--primary-text-color,#fff);cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '.b ha-icon{--mdc-icon-size:22px}',
    '.b.on{background:rgba(255,255,255,.12)}',
    '.clear .ic{color:#5EEAD4}',
    '.big{font-size:28px;font-weight:700;letter-spacing:.5px;line-height:1.1}',
    '.main{backface-visibility:hidden}',
    '.out-fold,.in-fold,.out-slide,.in-slide,.out-fade,.in-fade{will-change:transform,opacity}',
    '.out-fold{animation:nb-fold-out .22s ease-in forwards}.in-fold{animation:nb-fold-in .26s ease-out}',
    '.out-slide{animation:nb-sl-out .2s ease-in forwards}.in-slide{animation:nb-sl-in .24s ease-out}',
    '.out-fade{animation:nb-fa-out .18s ease-in forwards}.in-fade{animation:nb-fa-in .22s ease-out}',
    '@keyframes nb-fold-out{to{transform:perspective(500px) rotateX(-80deg);opacity:0}}',
    '@keyframes nb-fold-in{from{transform:perspective(500px) rotateX(80deg);opacity:0}}',
    '@keyframes nb-sl-out{to{transform:translateX(-30px);opacity:0}}',
    '@keyframes nb-sl-in{from{transform:translateX(30px);opacity:0}}',
    '@keyframes nb-fa-out{to{opacity:0}}@keyframes nb-fa-in{from{opacity:0}}',
    '.pop{margin-top:8px;padding:10px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(20,22,28,.92);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}',
    '.pop .h{font-size:12px;color:var(--secondary-text-color,#9aa4b2);margin:0 4px 8px}',
    '.chips{display:flex;flex-wrap:wrap;gap:8px}',
    '.chip{min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:var(--primary-text-color,#fff);font:inherit;font-size:14px;cursor:pointer}',
    '.chip.dng{color:#ff9a9d}',
    '.row{display:flex;align-items:center;gap:10px;padding:8px 4px;border-top:1px solid rgba(255,255,255,.08)}',
    '.row:first-of-type{border-top:0}',
    '.row .ic{width:34px;height:34px}.row .ic ha-icon{--mdc-icon-size:20px}',
    '.row .rm{flex:1;min-width:0;font-size:14px}.row .rm span{display:block;font-size:11px;color:var(--secondary-text-color,#9aa4b2)}',
    '.resume{margin-top:8px;display:flex}',
    '.resume .chip{min-height:34px;font-size:13px;background:rgba(255,200,87,.14);border-color:rgba(255,200,87,.4);color:#FFC857}',
    '.camv{margin-top:8px;position:relative;border-radius:16px;overflow:hidden;background:#000}',
    '.camv img{display:block;width:100%;max-height:50vh;object-fit:contain}',
    '.camv .b{position:absolute;top:6px;right:6px;background:rgba(0,0,0,.55)}',
    ':host(.bubble){position:relative}',
    ':host(.bubble) .strip{min-height:50px;padding:3px 4px 3px 8px;border-radius:999px;background:rgba(255,255,255,.12)}',
    ':host(.bubble) .strip.bord{border:1px solid var(--ac)}',
    ':host(.bubble) .ic{width:34px;height:34px}',
    ':host(.bubble) .msg{font-size:14px;-webkit-line-clamp:1}',
    ':host(.bubble) .cam{width:44px;height:34px}',
    ':host(.bubble) .pop,:host(.bubble) .camv,:host(.bubble) .resume{position:absolute;right:0;top:100%;z-index:20}',
    ':host(.bubble) .pop,:host(.bubble) .camv{width:340px;max-width:calc(100vw - 24px)}'
  ].join('');

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function go(path) {
    window.history.pushState(null, '', path);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(d, h24) {
    if (h24) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
    var h = d.getHours() % 12 || 12;
    return h + ':' + pad(d.getMinutes()) + (d.getHours() < 12 ? ' AM' : ' PM');
  }
  function btn(act, icon, extra, label) {
    return '<button class="b' + (extra || '') + '" data-act="' + act + '" aria-label="' + esc(label || act) + '"><ha-icon icon="' + icon + '"></ha-icon></button>';
  }

  class NabuAlertStrip extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      var st = document.createElement('style');
      st.textContent = CSS;
      this._box = document.createElement('div');
      this._box.style.display = 'contents';
      this.shadowRoot.appendChild(st);
      this.shadowRoot.appendChild(this._box);
      this._cfg = {};
      this._off = 0;
      this._manual = 0;
      this._data = null;
      this._idx = 0;
      this._menu = '';
      this._cam = false;
      this._unsub = null;
      this._timer = null;
      this._busy = false;
      this._touch = null;
      this._hold = null;
      var self = this;
      this.shadowRoot.addEventListener('click', function (e) { self._onClick(e); });
      this.shadowRoot.addEventListener('touchstart', function (e) { self._onTouchStart(e); }, { passive: true });
      this.shadowRoot.addEventListener('touchend', function (e) { self._onTouchEnd(e); }, { passive: true });
      this.shadowRoot.addEventListener('touchmove', function () { self._cancelHold(); }, { passive: true });
      this.shadowRoot.addEventListener('mousedown', function (e) { self._startHold(e); });
      this.shadowRoot.addEventListener('mouseup', function () { self._cancelHold(); });
    }

    setConfig(config) {
      this._cfg = config || {};
      if (this._cfg.bubble) { this.classList.add('bubble'); } else { this.classList.remove('bubble'); }
      this._render();
    }
    getCardSize() { return 1; }
    static getStubConfig() { return {}; }

    set hass(h) {
      this._hass = h;
      if (!this._unsub && !this._subscribing) { this._subscribe(); }
      if (this._clearMode()) {
        var d = this._disp(), w = d.clear_weather_entity && h && h.states ? h.states[d.clear_weather_entity] : null;
        var k = w ? w.state + '|' + w.attributes.temperature : '';
        if (k !== this._ck) { this._ck = k; this._render(); }
      }
    }

    connectedCallback() {
      if (this._hass && !this._unsub && !this._subscribing) { this._subscribe(); }
      this._restartTimer();
    }
    disconnectedCallback() {
      var self = this;
      setTimeout(function () {
        if (!self.isConnected) {
          if (self._unsub) { self._unsub(); self._unsub = null; }
          if (self._timer) { clearInterval(self._timer); self._timer = null; }
        }
      }, 1000);
    }

    _subscribe() {
      var self = this;
      this._subscribing = true;
      this._dbg = 'subscribing';
      if (!this._hass.connection || !this._hass.connection.subscribeMessage) { this._dbg = 'no connection'; this._subscribing = false; return; }
      this._hass.connection.subscribeMessage(function (ev) { self._onData(ev); }, { type: 'nabu_flow/alerts_subscribe' }).then(function (unsub) {
        self._unsub = unsub;
        self._subscribing = false;
      }).catch(function (e) { self._subscribing = false; self._dbg = 'subscribe failed: ' + ((e && (e.message || e.code)) || String(e)); });
    }

    // server clock
    _now() { return Date.now() + this._off; }
    _cyc() { return Math.max(3, this._disp().cycle_seconds || 6) * 1000; }
    _slotIdx(n) { return n > 1 ? Math.floor(this._now() / this._cyc()) % n : 0; }

    _onData(data) {
      if (data.ts) { this._off = data.ts * 1000 - Date.now(); }
      var sig = JSON.stringify([data.alerts, data.snoozed, data.display]);
      if (sig === this._sig && this._data) { this._data = data; return; }
      this._sig = sig;
      var keep = this._current() ? this._current().key : '';
      this._data = data;
      this._dbg = 'got data';
      var alerts = this._alerts();
      if (Date.now() < this._manual) {
        var at = -1;
        for (var i = 0; i < alerts.length; i++) { if (alerts[i].key === keep) { at = i; } }
        this._idx = at >= 0 ? at : Math.min(this._idx, Math.max(0, alerts.length - 1));
      } else {
        this._idx = this._slotIdx(alerts.length);
      }
      if (!alerts.length) { this._menu = ''; this._cam = false; }
      try { this._render(); } catch (e) { this._dbg = 'draw failed: ' + (e && e.message); }
      this._restartTimer();
    }

    _alerts() {
      var list = (this._data && this._data.alerts) || [], only = this._cfg.only, skip = this._cfg.skip;
      if (!only && !skip) { return list; }
      return list.filter(function (a) {
        if (only && only.indexOf(a.rule_id) < 0) { return false; }
        return !(skip && skip.indexOf(a.rule_id) >= 0);
      });
    }
    _current() { return this._alerts()[this._idx] || null; }
    _disp() { return (this._data && this._data.display) || {}; }
    _clearMode() { return this._data && !this._alerts().length ? this._disp().clear_mode : ''; }

    _restartTimer() {
      var self = this;
      if (this._timer) { clearInterval(this._timer); clearTimeout(this._timer); this._timer = null; }
      if (!this._data) { return; }
      var n = this._alerts().length;
      if (n > 1) {
        var next = function () {
          var c = self._cyc();
          self._timer = setTimeout(function () {
            var m = self._alerts().length;
            if (m > 1 && !self._menu && !self._cam && !self._touch && Date.now() >= self._manual) { self._go(self._slotIdx(m)); }
            next();
          }, c - (self._now() % c) + 30);
        };
        next();
      } else if (!n && /clock/.test(this._clearMode() || '')) {
        this._timer = setInterval(function () { self._render(); }, 15000);
      }
    }

    _go(to) {
      var n = this._alerts().length;
      if (n < 2 || this._busy) { return; }
      to = (to % n + n) % n;
      if (to === this._idx) { return; }
      var t = this._disp().transition || 'fold';
      var self = this;
      var main = this.shadowRoot.querySelector('.main');
      if (t === 'none' || !main) { this._idx = to; this._render(); return; }
      this._busy = true;
      main.className = 'main out-' + t;
      setTimeout(function () {
        self._idx = to;
        self._render('in-' + t);
        self._busy = false;
      }, 210);
    }

    _iconBox(icon, color) {
      return '<div class="ic"' + (color ? ' style="color:' + esc(color) + '"' : '') + '><ha-icon icon="' + esc(icon) + '"></ha-icon></div>';
    }

    _render(anim) {
      var d = this._disp(), cfg = this._cfg, alerts = this._alerts();
      if (!this._data) { this.hidden = true; return; }
      var h = '';
      var cur = this._current();
      var compact = cfg.compact ? ' compact' : '';
      if (!cur) {
        var body = this._clearBody(d);
        if (!body || cfg.hide_when_clear) { this.hidden = true; this._box.innerHTML = h + this._resume(); return; }
        this.hidden = false;
        this._box.innerHTML = h + '<div class="strip clear' + compact + '">' + body + '</div>' + this._resume();
        return;
      }
      this.hidden = false;
      var color = cur.color || COLORS[cur.priority] || COLORS.info;
      var show = cfg.controls !== false;
      h += '<div class="strip' + (d.severity_border !== false ? ' bord' : '') + ' ' + esc(cur.priority) + compact + '" style="--ac:' + esc(color) + '">';
      h += '<div class="main ' + (anim || '') + '" data-act="tap">' + this._iconBox(cur.icon, color) + '<div class="tx"><div class="msg">' + esc(cur.message) + '</div>';
      h += '<div class="sec">' + esc(cur.secondary || this._since(cur)) + '</div></div>';
      var cam = this._camSrc(cur, false);
      if (cam) { h += '<img class="cam" src="' + esc(cam) + '" alt="">'; }
      h += '</div>';
      if (show) {
        h += '<div class="side">';
        if (alerts.length > 1) {
          h += btn('prev', 'mdi:chevron-left', ' wide', 'Previous') + '<button class="cnt' + (this._menu === 'list' ? ' on' : '') + '" data-act="list" aria-label="All alerts">' + (this._idx + 1) + '/' + alerts.length + '</button>' + btn('next', 'mdi:chevron-right', ' wide', 'Next');
        } else if (d.show_count) {
          h += '<div class="cnt">1/1</div>';
        }
        if (d.can_act && cur.snoozable !== false) { h += btn('snooze', 'mdi:alarm-snooze', this._menu === 'snooze' ? ' on' : '', 'Snooze'); }
        if (alerts.length === 1 && d.can_act && cur.snoozable === false) { h += btn('list', 'mdi:format-list-bulleted', this._menu === 'list' ? ' on' : '', 'Alert details'); }
        h += '</div>';
      }
      h += '</div>';
      if (this._cam) { h += this._camView(cur); }
      if (this._menu === 'snooze') { h += this._snoozeMenu(d); }
      if (this._menu === 'list') { h += this._listMenu(d); }
      h += this._resume();
      this._box.innerHTML = h;
    }

    _since(a) {
      var t = new Date(a.since);
      return isNaN(t.getTime()) ? '' : 'since ' + clock(t, this._disp().clock_24h !== false);
    }

    _clearBody(d) {
      var mode = d.clear_mode || 'message', now = new Date(), h24 = d.clock_24h !== false;
      if (mode === 'hidden') { return ''; }
      if (mode === 'message') { return this._iconBox('mdi:check-circle-outline') + '<div class="tx"><div class="msg">' + esc(d.clear_message || 'All systems clear') + '</div></div>'; }
      var wx = '', st = this._hass && d.clear_weather_entity ? this._hass.states[d.clear_weather_entity] : null;
      if (st) {
        var temp = st.attributes.temperature;
        wx = (temp != null ? Math.round(temp) + (st.attributes.temperature_unit || '') + ' ' : '') + String(st.state).replace(/-/g, ' ');
      }
      var wxIcon = st ? (WX[st.state] || 'mdi:weather-partly-cloudy') : 'mdi:weather-partly-cloudy';
      var date = d.clock_show_date !== false ? now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }) : '';
      if (mode === 'clock' || (mode === 'weather_clock' && !st)) {
        return this._iconBox('mdi:clock-outline') + '<div class="tx"><div class="big">' + esc(clock(now, h24)) + '</div>' + (date ? '<div class="sec">' + esc(date) + '</div>' : '') + '</div>';
      }
      if (mode === 'weather' || !st) {
        return this._iconBox(wxIcon) + '<div class="tx"><div class="msg">' + esc(wx || 'No weather entity set') + '</div></div>';
      }
      return this._iconBox(wxIcon) + '<div class="tx"><div class="big">' + esc(clock(now, h24)) + '</div><div class="sec">' + esc(wx) + (date ? ' - ' + esc(date) : '') + '</div></div>';
    }

    _resume() {
      var s = (this._data && this._data.snoozed) || [];
      if (!s.length || !this._disp().can_act) { return ''; }
      return '<div class="resume"><button class="chip" data-act="resume">' + s.length + ' snoozed - resume</button></div>';
    }

    _snoozeMenu(d) {
      var hrs = d.snooze_hours || [1, 4, 8, 24], h = '<div class="pop"><div class="h">Snooze this alert for</div><div class="chips">';
      for (var i = 0; i < hrs.length; i++) { h += '<button class="chip" data-act="snz" data-v="' + hrs[i] + '">' + hrs[i] + ' h</button>'; }
      return h + '<button class="chip dng" data-act="dismiss">Dismiss</button></div></div>';
    }

    _listMenu(d) {
      var a = this._alerts(), h = '<div class="pop">';
      for (var i = 0; i < a.length; i++) {
        var x = a[i], c = x.color || COLORS[x.priority] || COLORS.info;
        h += '<div class="row">' + this._iconBox(x.icon, c) + '<div class="rm">' + esc(x.message) + '<span>' + esc(x.name) + ' - ' + esc(this._since(x)) + '</span></div>';
        if (d.can_act) {
          if (x.snoozable !== false) { h += '<button class="b" data-act="snz-row" data-k="' + esc(x.key) + '" aria-label="Snooze 1 hour"><ha-icon icon="mdi:alarm-snooze"></ha-icon></button>'; }
          h += '<button class="b" data-act="dis-row" data-k="' + esc(x.key) + '" aria-label="Dismiss"><ha-icon icon="mdi:close"></ha-icon></button>';
        }
        h += '</div>';
      }
      return h + '</div>';
    }

    _camSrc(a, stream) {
      if (!a.camera_entity || !this._hass) { return ''; }
      var st = this._hass.states[a.camera_entity];
      var pic = st && st.attributes.entity_picture;
      if (!pic) { return ''; }
      return stream ? pic.replace('/api/camera_proxy/', '/api/camera_proxy_stream/') : pic;
    }
    _camView(a) {
      var src = this._camSrc(a, true);
      return src ? '<div class="camv"><img src="' + esc(src) + '" alt="">' + btn('cam', 'mdi:close', '', 'Close camera') + '</div>' : '';
    }

    _onClick(e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el) { return; }
      var act = el.getAttribute('data-act'), v = el.getAttribute('data-v'), k = el.getAttribute('data-k');
      if (act === 'tap') {
        if (this._heldFired) { this._heldFired = false; return; }
        this._perform('tap_action');
      } else if (act === 'prev') { this._man(); this._go(this._idx - 1); }
      else if (act === 'next') { this._man(); this._go(this._idx + 1); }
      else if (act === 'snooze') { this._menu = this._menu === 'snooze' ? '' : 'snooze'; this._render(); }
      else if (act === 'list') { this._menu = this._menu === 'list' ? '' : 'list'; this._render(); }
      else if (act === 'cam') { this._cam = false; this._render(); }
      else if (act === 'snz') { this._send('snooze', this._current(), parseFloat(v)); }
      else if (act === 'snz-row') { this._send('snooze', { key: k }, (this._disp().snooze_hours || [1])[0]); }
      else if (act === 'dismiss') { this._send('dismiss', this._current()); }
      else if (act === 'dis-row') { this._send('dismiss', { key: k }); }
      else if (act === 'resume') { this._send('resume', null); }
    }

    _send(action, alert, hours) {
      var msg = { type: 'nabu_flow/alerts_action', action: action };
      if (alert) { msg.key = alert.key; }
      if (hours) { msg.hours = hours; }
      this._menu = action === 'resume' ? this._menu : '';
      this._hass.callWS(msg).catch(function () { return null; });
    }

    _startHold(e) {
      if (!e.target.closest || !e.target.closest('.main')) { return; }
      var self = this;
      this._cancelHold();
      this._heldFired = false;
      this._hold = setTimeout(function () {
        self._hold = null;
        var a = self._current();
        if (a && a.hold_action && a.hold_action.action !== 'default' && a.hold_action.action !== 'none') {
          self._heldFired = true;
          self._perform('hold_action');
        }
      }, 500);
    }
    _cancelHold() { if (this._hold) { clearTimeout(this._hold); this._hold = null; } }

    _onTouchStart(e) {
      this._startHold(e);
      var t = e.touches && e.touches[0];
      this._touch = t ? { x: t.clientX, y: t.clientY } : null;
    }
    _onTouchEnd(e) {
      this._cancelHold();
      var s = this._touch, t = e.changedTouches && e.changedTouches[0];
      var self = this;
      setTimeout(function () { self._touch = null; }, 50);
      if (!s || !t || !e.target.closest || !e.target.closest('.main')) { return; }
      var dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        this._swiped = true;
        setTimeout(function () { self._swiped = false; }, 400);
        this._man();
        this._go(this._idx + (dx < 0 ? 1 : -1));
      }
    }

    _man() { this._manual = Date.now() + this._cyc() * 2; }

    _perform(which) {
      if (this._swiped) { return; }
      var a = this._current();
      if (!a) { return; }
      var act = a[which] || { action: 'default' }, hass = this._hass;
      var kind = act.action;
      if (kind === 'default') {
        if (which === 'tap_action' && a.camera_entity && this._camSrc(a, true)) { this._cam = !this._cam; this._render(); return; }
        if (which === 'tap_action' && a.entity_id) { kind = 'more-info'; act = { entity: a.entity_id }; }
        else { return; }
      }
      if (kind === 'none') { return; }
      if (kind === 'more-info') {
        this.dispatchEvent(new CustomEvent('hass-more-info', { bubbles: true, composed: true, detail: { entityId: act.entity || a.entity_id } }));
      } else if (kind === 'navigate') { go(act.navigation_path);
      } else if (kind === 'url') { window.open(act.url_path, '_blank');
      } else if (kind === 'call-service') {
        if (act.confirm && !window.confirm('Run ' + act.service + '?')) { return; }
        var p = String(act.service).split('.');
        hass.callService(p[0], p[1], act.service_data || {});
      }
    }
  }

  class NabuAlertsCard extends NabuAlertStrip {}

  customElements.define('nabu-alert-strip', NabuAlertStrip);
  customElements.define('nabu-alerts-card', NabuAlertsCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'nabu-alerts-card',
    name: 'Nabu Alerts Flow',
    description: 'Alert ticker for Nabu Flow: cycling alerts, snooze, camera and a clear-state widget'
  });
})();
