/* Nabu Flow panel. Plain JS on purpose: no template literals, no emoji, bare
   customElements.define (iOS companion WebView rules). Version 0.3.6.
   Bump the ?v= below together with VERSION in const.py to bust caches. */
import './nabu-flow-kit.js?v=0.3.6';

(function () {
  'use strict';

  var K = window.NabuFlowKit;
  var TABS = K.TABS;
  var SEVS = K.SEVS;
  var PHONES = K.PHONES;
  var PRES = K.PRES;
  var KIND_CLS = K.KIND_CLS;
  var CSS = K.CSS;
  var FACE = K.FACE;
  var esc = K.esc;
  var slug = K.slug;
  var opts = K.opts;
  var withCur = K.withCur;
  var fld = K.fld;
  var inp = K.inp;
  var sel = K.sel;
  var chk = K.chk;
  var chip = K.chip;
  var label = K.label;
  var readForm = K.readForm;

  class NabuFlowPanel extends HTMLElement {
    constructor() {
      super();
      this._root = this.attachShadow({ mode: 'open' });
      this._tab = 'routes';
      this._data = null;
      this._audit = null;
      this._hist = null;
      this._edit = null;
      this._err = '';
      this._narrow = false;
      this._hass = null;
      var self = this;
      this._root.addEventListener('click', function (e) { self._onClick(e); });
    }

    set hass(h) {
      var first = !this._hass;
      this._hass = h;
      if (first) { this._load(); }
    }
    set narrow(v) {
      this._narrow = v;
      var m = this._root.querySelector('ha-menu-button');
      if (m) { m.narrow = v; }
    }
    set panel(v) { this._panel = v; }
    set route(v) { this._route = v; }

    // ---------- data ----------
    _ws(type, extra) { return this._hass.callWS(Object.assign({ type: type }, extra || {})); }
    _load() {
      var self = this;
      this._ws('nabu_flow/get').then(function (d) {
        self._data = d;
        self._err = '';
        self._render();
        self._loadAudit();
      }).catch(function (e) {
        self._err = (e && e.message) ? e.message : 'Could not load Nabu Flow. Is the integration set up and are you an admin?';
        self._render();
      });
    }
    _loadAudit() {
      var self = this;
      return this._ws('nabu_flow/audit').then(function (a) {
        self._audit = a;
        if (self._edit === null && (self._tab === 'routes' || self._tab === 'audit')) { self._render(); }
      }).catch(function () { return null; });
    }
    _loadHist() {
      var self = this;
      return this._ws('nabu_flow/history').then(function (h) {
        self._hist = h.items;
        if (self._tab === 'history') { self._render(); }
      }).catch(function () { return null; });
    }
    _save(section, data, okMsg) {
      var self = this;
      return this._ws('nabu_flow/update', { section: section, data: data }).then(function (d) {
        self._data = d;
        self._render();
        self._say(okMsg);
      }).catch(function (e) { self._say('Save failed: ' + ((e && e.message) || e)); });
    }
    _say(msg) {
      var old = this._root.querySelector('.toast');
      if (old) { old.remove(); }
      var t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      this._root.appendChild(t);
      setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, 4000);
    }
    _chanName(k) { var c = this._data.channels[k]; return c ? c.name : k; }
    _whoLabel(who) {
      var d = this._data;
      if (!who || who.indexOf('all') >= 0) { return 'Everyone'; }
      return who.map(function (k) { return d.people[k] ? d.people[k].name : k; }).join(', ');
    }
    _used(id) {
      if (!this._audit) { return null; }
      return this._audit.automations.filter(function (a) {
        return a.calls.some(function (c) { return c.kind === 'nabu' && c.route === id; });
      }).length;
    }
    _statusLine(e) {
      if (e.suppressed) { return chip('Skipped: ' + (e.suppressed === 'cooldown' ? 'cooldown' : 'route disabled'), 'warn'); }
      var h = '';
      if (e.discord === null) { h += chip('Discord off'); } else { h += chip(e.discord ? 'Discord sent' : 'Discord failed', e.discord ? 'ok' : 'bad'); }
      (e.pushes || []).forEach(function (p) { h += chip(p.person + ' ' + p.level, p.ok ? 'ok' : 'bad'); });
      if (e.announce !== null && e.announce !== undefined) { h += chip(e.announce ? 'Spoken' : 'Announce failed', e.announce ? 'ok' : 'bad'); }
      return h;
    }

    // ---------- render ----------
    _render() {
      var self = this;
      var body;
      if (this._err) { body = '<div class="card bad">' + esc(this._err) + '</div>'; }
      else if (!this._data) { body = '<div class="card muted">Loading...</div>'; }
      else {
        body = ({ routes: '_vRoutes', audit: '_vAudit', people: '_vPeople', channels: '_vChannels', history: '_vHistory', settings: '_vSettings' })[this._tab];
        body = this[body]();
      }
      var tabs = TABS.map(function (t) {
        return '<button class="tab' + (t[0] === self._tab ? ' on' : '') + '" data-act="tab" data-v="' + t[0] + '">' + t[1] + '</button>';
      }).join('');
      this._root.innerHTML = '<style>' + CSS + '</style><div class="wrap"><div class="top"><ha-menu-button></ha-menu-button>' + FACE +
        '<div><div class="ttl">Nabu Flow</div><div class="muted small">Notification routing for Home Assistant</div></div></div>' +
        '<div class="tabs">' + tabs + '</div>' + body + '</div>';
      var m = this._root.querySelector('ha-menu-button');
      if (m) { m.hass = this._hass; m.narrow = this._narrow; }
    }

    _vRoutes() {
      var d = this._data, self = this;
      var ids = Object.keys(d.routes).sort(function (a, b) { return d.routes[a].name.localeCompare(d.routes[b].name); });
      var h = '<div class="bar"><button class="btn pri" data-act="route-new">New route</button></div>';
      if (this._edit !== null) { h += this._vRouteForm(); }
      if (!ids.length) {
        h += '<div class="card muted">No routes yet. A route is a named notification, like "Front door open", that decides where it goes. Automations call it by name, so you change the path here instead of in every automation.</div>';
      }
      h += '<div class="grid">' + ids.map(function (id) {
        var r = d.routes[id], used = self._used(id);
        var c = '<div class="card"><div class="row"><span class="name">' + esc(r.name) + '</span><span class="dot sev-' + esc(r.severity) + '"></span></div>';
        c += '<div class="muted small">' + esc(id) + (r.enabled ? '' : ' (disabled)') + '</div><div>';
        c += chip(self._chanName(r.channel)) + chip(self._whoLabel(r.who));
        c += chip(r.discord ? 'Discord on' : 'Discord off', r.discord ? 'ok' : '');
        c += chip('Phone: ' + label(PHONES, r.phone));
        if (r.phone !== 'none') { c += chip('Presence: ' + label(PRES, r.presence)); }
        if (r.announce) { c += chip('Announce', 'ok'); }
        if (r.cooldown) { c += chip('Cooldown ' + r.cooldown + 's'); }
        c += '</div><div class="muted small" style="margin:8px 0">' + (used === null ? 'Checking automations...' : 'Used by ' + used + ' automation' + (used === 1 ? '' : 's')) + '</div>';
        c += '<div class="bar" style="margin:0"><button class="btn sm" data-act="route-edit" data-v="' + esc(id) + '">Edit</button><button class="btn sm" data-act="route-test" data-v="' + esc(id) + '">Test</button><button class="btn sm dng" data-act="route-del" data-v="' + esc(id) + '">Delete</button></div></div>';
        return c;
      }).join('') + '</div>';
      return h;
    }

    _vRouteForm() {
      var d = this._data, isNew = this._edit === '';
      var r = isNew ? { name: '', channel: d.settings.default_channel, who: ['all'], severity: 'info', discord: true, phone: 'auto', presence: 'aware', announce: false, cooldown: 0, enabled: true } : d.routes[this._edit];
      var chans = withCur(Object.keys(d.channels).map(function (k) { return [k, d.channels[k].name]; }), r.channel);
      var all = r.who.indexOf('all') >= 0;
      var who = '<div class="whos"><label class="chk"><input type="checkbox" data-who="all"' + (all ? ' checked' : '') + '> Everyone</label>';
      Object.keys(d.people).forEach(function (k) {
        who += '<label class="chk"><input type="checkbox" data-who="' + esc(k) + '"' + (!all && r.who.indexOf(k) >= 0 ? ' checked' : '') + '> ' + esc(d.people[k].name) + '</label>';
      });
      who += '</div>';
      var h = '<div class="card" id="rform"><div class="name">' + (isNew ? 'New route' : 'Edit ' + esc(r.name)) + '</div>';
      h += '<div class="rowf">' + fld('Name', inp('name', r.name, 'Front door open')) + fld('Channel', sel('channel', chans, r.channel)) + fld('Severity', sel('severity', SEVS, r.severity)) + '</div>';
      h += '<label>Who gets it</label>' + who;
      h += '<div class="rowf">' + fld('Phone push', sel('phone', PHONES, r.phone)) + fld('Presence', sel('presence', PRES, r.presence)) + fld('Cooldown (seconds)', inp('cooldown', r.cooldown, '0', 'number', ' min="0"')) + '</div>';
      h += '<div class="whos">' + chk('discord', 'Post to Discord', r.discord) + chk('announce', 'Announce in kitchen', r.announce) + chk('enabled', 'Route enabled', r.enabled) + '</div>';
      h += '<div class="bar"><button class="btn pri" data-act="route-save">Save route</button><button class="btn" data-act="route-cancel">Cancel</button></div>';
      h += '<div class="muted small">Call it from an automation with: action nabu_flow.notify, route ' + esc(isNew ? '(name)' : this._edit) + ', plus a title and message.</div></div>';
      return h;
    }

    _vAudit() {
      var a = this._audit;
      if (!a) { return '<div class="card muted">Scanning automations...</div>'; }
      var s = a.summary;
      var h = '<div class="bar"><button class="btn" data-act="audit-refresh">Rescan</button></div>';
      h += '<div class="card"><div class="name">' + s.total + ' automations send notifications</div>' + chip(s.routed + ' fully routed through Nabu', 'ok') + chip(s.not_routed + ' not routed', s.not_routed ? 'warn' : '') + '</div>';
      if (a.note) { h += '<div class="card warn">' + esc(a.note) + '</div>'; }
      if (a.skipped_blueprints) { h += '<div class="card muted small">' + a.skipped_blueprints + ' blueprint-based automations were not scanned.</div>'; }
      h += '<div class="grid">' + a.automations.map(function (m) {
        var c = '<div class="card"><div class="row"><span class="name">' + esc(m.alias) + '</span>';
        if (m.id) { c += '<a href="/config/automation/edit/' + encodeURIComponent(m.id) + '" target="_top">Open</a>'; }
        c += '</div><div>';
        m.calls.forEach(function (k) {
          var t = (a.labels[k.kind] || k.kind) + (k.route ? ': ' + k.route : '');
          if (k.kind === 'phone_direct' || k.kind === 'other_notify' || k.kind === 'discord_direct') { t += ' (' + k.service + ')'; }
          c += chip(t, KIND_CLS[k.kind]);
        });
        return c + '</div></div>';
      }).join('') + '</div>';
      return h;
    }

    _personRow(key, p) {
      var d = this._data;
      var persons = withCur([['', 'None']].concat(d.discovery.persons.map(function (x) { return [x.entity_id, x.name + ' (' + x.entity_id + ')']; })), p.person_entity);
      var phones = withCur([['', 'None']].concat(d.discovery.notify_services.map(function (x) { return [x, x]; })), p.phone_service);
      return '<div class="card prow"><div class="rowf">' + fld('Key', inp('key', key, 'randy', 'text', key ? ' readonly' : '')) + fld('Name', inp('name', p.name, 'Randy')) +
        fld('Presence entity', sel('person_entity', persons, p.person_entity)) + fld('Phone notify service', sel('phone_service', phones, p.phone_service)) +
        fld('Discord user ID', inp('discord_id', p.discord_id, 'optional, for @mentions', 'text', ' inputmode="numeric"')) +
        '<div><button class="btn sm dng" data-act="row-del">Remove</button></div></div></div>';
    }
    _vPeople() {
      var d = this._data, self = this;
      var h = '<div class="muted small" style="margin-bottom:10px">People are who a route can send to. The key is what you use in automations (who: randy).</div><div id="rows">';
      Object.keys(d.people).forEach(function (k) { h += self._personRow(k, d.people[k]); });
      return h + '</div><div class="bar"><button class="btn" data-act="row-add" data-v="people">Add person</button><button class="btn pri" data-act="people-save">Save people</button></div>';
    }

    _chanRow(key, c) {
      return '<div class="card crow"><div class="rowf">' + fld('Key', inp('key', key, 'doors', 'text', key ? ' readonly' : '')) + fld('Name', inp('name', c.name, 'Doors and locks')) +
        fld('Discord channel ID', inp('discord_id', c.discord_id, 'right-click channel, Copy Channel ID', 'text', ' inputmode="numeric"')) +
        '<div><button class="btn sm dng" data-act="row-del">Remove</button></div></div></div>';
    }
    _vChannels() {
      var d = this._data, self = this;
      var keys = Object.keys(d.channels).map(function (k) { return [k, d.channels[k].name]; });
      var h = '<div class="muted small" style="margin-bottom:10px">Turn on Developer Mode in Discord, then long-press a channel and choose Copy Channel ID.</div><div id="rows">';
      Object.keys(d.channels).forEach(function (k) { h += self._chanRow(k, d.channels[k]); });
      h += '</div><div class="card" id="sform"><div class="rowf">' + fld('Default channel', sel('default_channel', withCur(keys, d.settings.default_channel), d.settings.default_channel)) +
        fld('Quiet-mode digest channel', sel('digest_channel', withCur(keys, d.settings.digest_channel), d.settings.digest_channel)) +
        fld('Critical log channel', sel('critical_log_channel', withCur(keys, d.settings.critical_log_channel), d.settings.critical_log_channel)) + '</div></div>';
      return h + '<div class="bar"><button class="btn" data-act="row-add" data-v="channels">Add channel</button><button class="btn pri" data-act="chan-save">Save channels</button></div>';
    }

    _vHistory() {
      var self = this;
      if (!this._hist) { this._loadHist(); return '<div class="card muted">Loading...</div>'; }
      var h = '<div class="bar"><button class="btn" data-act="hist-refresh">Refresh</button><button class="btn dng" data-act="hist-clear">Clear</button></div>';
      if (!this._hist.length) { return h + '<div class="card muted">Nothing sent yet.</div>'; }
      return h + this._hist.map(function (e) {
        var when = new Date(e.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
        return '<div class="card"><div class="row"><span class="name">' + esc(e.title || '(no title)') + '</span><span class="dot sev-' + esc(e.severity) + '"></span></div>' +
          (e.message ? '<div>' + esc(e.message) + '</div>' : '') +
          '<div class="muted small">' + esc(when) + ' - ' + esc(e.route || 'no route') + ' - ' + esc(e.source) + (e.channel ? ' - ' + esc(self._chanName(e.channel)) : '') + '</div><div>' + self._statusLine(e) + '</div>' +
          (e.warnings && e.warnings.length ? '<div class="warn small">' + esc(e.warnings.join('; ')) + '</div>' : '') +
          (e.errors && e.errors.length ? '<div class="bad small">' + esc(e.errors.join('; ')) + '</div>' : '') + '</div>';
      }).join('');
    }

    _vSettings() {
      var d = this._data, s = d.settings;
      var svcs = d.discovery.notify_services.map(function (x) { return [x, x]; });
      var chans = Object.keys(d.channels).map(function (k) { return [k, d.channels[k].name]; });
      var whoList = [['all', 'Everyone']].concat(Object.keys(d.people).map(function (k) { return [k, d.people[k].name]; }));
      var h = '<div class="card" id="setform"><div class="name">Settings</div><div class="rowf">' +
        fld('Discord notify service', sel('notify_service', withCur(svcs, s.notify_service), s.notify_service)) +
        fld('Quiet mode entity', inp('quiet_entity', s.quiet_entity, 'input_boolean.nabu_quiet_mode')) +
        fld('Announce service (optional)', sel('announce_service', withCur([['', 'None']].concat(svcs), s.announce_service), s.announce_service)) +
        fld('Snapshot file path (optional)', inp('snapshot_path', s.snapshot_path, 'default: /config/www/nabu_snapshot.jpg')) +
        fld('History size', inp('history_size', s.history_size, '100', 'number', ' min="10" max="500"')) +
        '</div><div class="bar" style="margin-top:12px"><button class="btn pri" data-act="settings-save">Save settings</button></div></div>';
      h += '<div class="card" id="tform"><div class="name">Send a test</div><div class="rowf">' + fld('Channel', sel('channel', chans, s.default_channel)) +
        fld('Title', inp('title', 'Test from Nabu Flow', '')) + fld('Message', inp('message', 'It works.', '')) + fld('Severity', sel('severity', SEVS, 'info')) +
        fld('Who', sel('who', whoList, 'all')) + fld('Phone push', sel('phone', PHONES, 'none')) + '</div>' +
        '<div class="bar" style="margin-top:12px"><button class="btn pri" data-act="test-send">Send test</button></div></div>';
      h += '<div class="card" id="xform"><div class="name">Backup and restore</div><label>Config JSON</label><textarea data-f="json" spellcheck="false"></textarea>' +
        '<div class="rowf">' + fld('Import mode', sel('mode', [['merge', 'Merge into current'], ['replace', 'Replace everything']], 'merge')) + '</div>' +
        '<div class="bar" style="margin-top:12px"><button class="btn" data-act="export">Export</button><button class="btn" data-act="import">Import</button></div></div>';
      return h + '<div class="muted small">Nabu Flow ' + esc(d.version) + '</div>';
    }

    // ---------- actions ----------
    _onClick(e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el) { return; }
      var fn = this['_a_' + el.getAttribute('data-act').replace(/-/g, '_')];
      if (fn) { fn.call(this, el.getAttribute('data-v'), el); }
    }
    _a_tab(v) {
      this._tab = v;
      this._edit = null;
      if (v === 'audit') { this._loadAudit(); }
      if (v === 'history') { this._hist = null; }
      this._render();
    }
    _a_route_new() { this._edit = ''; this._render(); }
    _a_route_edit(v) { this._edit = v; this._render(); }
    _a_route_cancel() { this._edit = null; this._render(); }
    _a_route_save() {
      var form = this._root.querySelector('#rform'), f = readForm(form), self = this;
      var name = String(f.name || '').trim();
      if (!name) { this._say('Give the route a name.'); return; }
      var id = this._edit === '' ? slug(name) : this._edit;
      if (!id) { this._say('Use letters or numbers in the name.'); return; }
      if (this._edit === '' && this._data.routes[id]) { this._say('A route with that name already exists.'); return; }
      var who = [];
      form.querySelectorAll('[data-who]').forEach(function (n) { if (n.checked) { who.push(n.getAttribute('data-who')); } });
      if (who.indexOf('all') >= 0 || !who.length) { who = ['all']; }
      var routes = Object.assign({}, this._data.routes);
      routes[id] = { name: name, channel: f.channel, who: who, severity: f.severity, discord: f.discord, phone: f.phone, presence: f.presence, announce: f.announce, cooldown: parseInt(f.cooldown, 10) || 0, enabled: f.enabled };
      this._edit = null;
      this._save('routes', routes, 'Route saved').then(function () { self._loadAudit(); });
    }
    _a_route_del(v) {
      var routes = Object.assign({}, this._data.routes);
      delete routes[v];
      this._save('routes', routes, 'Route deleted');
    }
    _a_route_test(v) {
      var self = this, r = this._data.routes[v];
      this._ws('nabu_flow/test', { data: { route: v, title: 'Test: ' + r.name, message: 'Test from Nabu Flow' } }).then(function (e) {
        self._say(e.suppressed ? 'Skipped (' + e.suppressed + ')' : 'Sent. See History for the result.');
        self._hist = null;
      }).catch(function (err) { self._say('Test failed: ' + ((err && err.message) || err)); });
    }
    _a_row_add(v) {
      var rows = this._root.querySelector('#rows');
      rows.insertAdjacentHTML('beforeend', v === 'people' ? this._personRow('', { name: '', person_entity: '', phone_service: '', discord_id: '' }) : this._chanRow('', { name: '', discord_id: '' }));
    }
    _a_row_del(v, el) {
      var card = el.closest('.card');
      if (card) { card.remove(); }
    }
    _collect(cls) {
      var out = {};
      this._root.querySelectorAll('.' + cls).forEach(function (row) {
        var f = readForm(row), k = slug(f.key);
        if (k) { delete f.key; out[k] = f; }
      });
      return out;
    }
    _a_people_save() { this._save('people', this._collect('prow'), 'People saved'); }
    _a_chan_save() {
      var self = this, f = readForm(this._root.querySelector('#sform'));
      var settings = Object.assign({}, this._data.settings, f);
      this._save('channels', this._collect('crow'), 'Channels saved').then(function () { return self._save('settings', settings, 'Channels saved'); });
    }
    _a_settings_save() {
      var f = readForm(this._root.querySelector('#setform'));
      f.history_size = parseInt(f.history_size, 10) || 100;
      this._save('settings', Object.assign({}, this._data.settings, f), 'Settings saved');
    }
    _a_test_send() {
      var self = this, f = readForm(this._root.querySelector('#tform'));
      this._ws('nabu_flow/test', { data: f }).then(function (e) {
        self._say('Sent. ' + (e.errors && e.errors.length ? 'Problem: ' + e.errors[0] : 'See History for the result.'));
        self._hist = null;
      }).catch(function (err) { self._say('Test failed: ' + ((err && err.message) || err)); });
    }
    _a_export() {
      var self = this, box = this._root.querySelector('#xform [data-f="json"]');
      this._ws('nabu_flow/export').then(function (c) { box.value = JSON.stringify(c, null, 2); self._say('Exported. Copy it somewhere safe.'); });
    }
    _a_import() {
      var self = this, f = readForm(this._root.querySelector('#xform')), data;
      try { data = JSON.parse(f.json); } catch (err) { this._say('That is not valid JSON.'); return; }
      this._ws('nabu_flow/import', { data: data, mode: f.mode }).then(function (d) {
        self._data = d;
        self._render();
        self._say('Imported.');
        self._loadAudit();
      }).catch(function (err) { self._say('Import failed: ' + ((err && err.message) || err)); });
    }
    _a_hist_refresh() { this._hist = null; this._render(); }
    _a_hist_clear() {
      var self = this;
      this._ws('nabu_flow/clear_history').then(function () { self._hist = []; self._render(); });
    }
    _a_audit_refresh() { this._audit = null; this._render(); this._loadAudit(); }
  }

  customElements.define('nabu-flow-panel', NabuFlowPanel);
})();
