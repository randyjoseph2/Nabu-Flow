/* Nabu Flow panel: Alerts tab (rules, settings, AlertTicker import, log).
   Loaded by nabu-flow-panel.js, kept separate for the iOS 24KB resource limit.
   Plain JS: no template literals, no emoji. Version 0.4.0. */
(function () {
  'use strict';

  var K = window.NabuFlowKit;
  var esc = K.esc, slug = K.slug, fld = K.fld, inp = K.inp, sel = K.sel, chk = K.chk, chip = K.chip, readForm = K.readForm, withCur = K.withCur;

  var SUBS = [['rules', 'Rules'], ['settings', 'Display'], ['import', 'Import'], ['log', 'Log']];
  var PRI = [['critical', 'Critical'], ['warning', 'Warning'], ['info', 'Info'], ['low', 'Low']];
  var OPS = [['=', 'is (=)'], ['!=', 'is not (!=)'], ['>', 'above (>)'], ['<', 'below (<)'], ['>=', 'at least (>=)'], ['<=', 'at most (<=)'], ['contains', 'contains'], ['not_contains', 'does not contain']];
  var MODES = [['state', 'While the condition is true'], ['persistent', 'Stay until dismissed'], ['on_change', 'Flash on any state change']];
  var TAPS = [['default', 'Default (more info or camera)'], ['none', 'Do nothing'], ['more-info', 'More info'], ['navigate', 'Go to dashboard path'], ['url', 'Open URL'], ['call-service', 'Run action']];
  var TRANS = [['fold', 'Fold'], ['slide', 'Slide'], ['fade', 'Fade'], ['none', 'None']];
  var CLEARS = [['message', 'Message'], ['clock', 'Clock'], ['weather', 'Weather'], ['weather_clock', 'Clock and weather'], ['hidden', 'Hide the strip']];
  var VALKEY = { 'more-info': 'entity', navigate: 'navigation_path', url: 'url_path', 'call-service': 'service' };
  var STARTERS = {
    low_battery: { name: 'Low battery', device_class: 'battery', operator: '<', state: '20', priority: 'warning', message: '{name} battery is {state}%', icon: 'mdi:battery-alert' },
    water_leak: { name: 'Water leak', device_class: 'moisture', state: 'on', priority: 'critical', message: 'Water detected: {name}', icon: 'mdi:water-alert' },
    smoke: { name: 'Smoke', device_class: 'smoke', state: 'on', priority: 'critical', message: 'Smoke detected: {name}', icon: 'mdi:smoke-detector-alert' },
    carbon_monoxide: { name: 'Carbon monoxide', device_class: 'carbon_monoxide', state: 'on', priority: 'critical', message: 'CO detected: {name}', icon: 'mdi:molecule-co' },
    door_open: { name: 'Door open', device_class: 'door', state: 'on', priority: 'info', message: '{name} is open', icon: 'mdi:door-open' }
  };

  function say(p, m) { p._say(m); }

  function view(p) {
    var sub = p._asub || 'rules';
    var h = '<div class="tabs" style="margin-top:0">' + SUBS.map(function (s) {
      return '<button class="tab' + (s[0] === sub ? ' on' : '') + '" data-act="alert-sub" data-v="' + s[0] + '">' + s[1] + '</button>';
    }).join('') + '</div>';
    if (sub === 'rules') { return h + vRules(p); }
    if (sub === 'settings') { return h + vSettings(p); }
    if (sub === 'import') { return h + vImport(p); }
    return h + vLog(p);
  }

  function summary(r) {
    var c = '';
    if (r.entity) { c += chip(r.entity); }
    if (r.entity_filter) { c += chip('filter ' + r.entity_filter); }
    if (r.device_class) { c += chip('class ' + r.device_class); }
    if (r.template) { c += chip('template'); }
    if (r.entity || r.entity_filter || r.device_class) { c += chip((r.attribute ? r.attribute + ' ' : '') + r.operator + ' ' + r.state); }
    if (r.mode !== 'state') { c += chip(r.mode === 'persistent' ? 'persistent' : 'on change'); }
    if (r.time_from && r.time_to) { c += chip(r.time_from + '-' + r.time_to); }
    if (r.route) { c += chip('route ' + r.route, 'ok'); }
    if (r.visible_to.indexOf('all') < 0) { c += chip('for ' + r.visible_to.join(', ')); }
    return c;
  }

  function vRules(p) {
    var d = p._data, rules = d.alerts.rules, ids = Object.keys(rules);
    var h = '<div class="card"><div class="name">Live strip</div><div class="muted small" style="margin-bottom:8px">This is the same strip your dashboards show.</div><div id="livestrip"></div></div>';
    h += '<div class="bar"><button class="btn pri" data-act="alert-new">New alert</button></div>';
    if (p._aedit !== null && p._aedit !== undefined) { h += vForm(p); }
    if (!ids.length) {
      h += '<div class="card muted">No alert rules yet. Start from a ready-made rule, add your own, or import your AlertTicker config.</div><div class="bar">';
      Object.keys(STARTERS).forEach(function (k) { h += '<button class="btn sm" data-act="alert-starter" data-v="' + k + '">' + esc(STARTERS[k].name) + '</button>'; });
      h += '</div>';
    }
    h += '<div class="grid">' + ids.sort(function (a, b) { return rules[a].name.localeCompare(rules[b].name); }).map(function (id) {
      var r = rules[id];
      return '<div class="card"><div class="row"><span class="name">' + esc(r.name) + '</span><span class="dot sev-' + (r.priority === 'critical' ? 'critical' : r.priority === 'warning' ? 'heads_up' : 'info') + '"></span></div>' +
        '<div class="muted small">' + esc(r.message) + (r.enabled ? '' : ' (off)') + '</div><div>' + summary(r) + '</div>' +
        '<div class="bar" style="margin:10px 0 0"><button class="btn sm" data-act="alert-edit" data-v="' + esc(id) + '">Edit</button><button class="btn sm" data-act="alert-test" data-v="' + esc(id) + '">Test</button>' +
        '<button class="btn sm" data-act="alert-toggle" data-v="' + esc(id) + '">' + (r.enabled ? 'Turn off' : 'Turn on') + '</button><button class="btn sm dng" data-act="alert-del" data-v="' + esc(id) + '">Delete</button></div></div>';
    }).join('') + '</div>';
    return h;
  }

  function vForm(p) {
    var d = p._data, isNew = p._aedit === '', r = isNew ? { name: '', priority: 'warning', message: '{name} is {state}', secondary: '', entity: '', entity_filter: '', exclude: [], device_class: '', attribute: '', operator: '=', state: 'on', template: '', time_from: '', time_to: '', mode: 'state', auto_dismiss: 0, icon: '', color: '', camera_entity: '', route: '', snoozable: true, enabled: true, visible_to: ['all'], tap_action: { action: 'default' } } : d.alerts.rules[p._aedit];
    var ta = r.tap_action || { action: 'default' };
    var cams = withCur([['', 'None']].concat((d.discovery.cameras || []).map(function (x) { return [x, x]; })), r.camera_entity);
    var routes = withCur([['', 'None']].concat(Object.keys(d.routes).map(function (k) { return [k, d.routes[k].name]; })), r.route);
    var all = r.visible_to.indexOf('all') >= 0, who = '<div class="whos"><label class="chk"><input type="checkbox" data-who="all"' + (all ? ' checked' : '') + '> Everyone</label>';
    [['admin', 'Admins'], ['non_admin', 'Non-admins']].concat(Object.keys(d.people).map(function (k) { return [k, d.people[k].name]; })).forEach(function (x) {
      who += '<label class="chk"><input type="checkbox" data-who="' + esc(x[0]) + '"' + (!all && r.visible_to.indexOf(x[0]) >= 0 ? ' checked' : '') + '> ' + esc(x[1]) + '</label>';
    });
    who += '</div>';
    var h = '<div class="card" id="aform"><div class="name">' + (isNew ? 'New alert' : 'Edit ' + esc(r.name)) + '</div>';
    h += '<div class="rowf">' + fld('Name', inp('name', r.name, 'Garage left open')) + fld('Priority', sel('priority', PRI, r.priority)) + fld('Mode', sel('mode', MODES, r.mode)) + fld('Auto-dismiss after (s, flash mode)', inp('auto_dismiss', r.auto_dismiss, '60', 'number', ' min="0"')) + '</div>';
    h += '<div class="rowf">' + fld('Message ({name} {state} {entity} {device} {area} {trigger_time})', inp('message', r.message, '')) + fld('Second line (optional)', inp('secondary', r.secondary, '')) + '</div>';
    h += '<div class="name" style="margin-top:12px">What to watch</div><div class="rowf">' + fld('Entity', inp('entity', r.entity, 'binary_sensor.garage_door')) + fld('Or match a pattern', inp('entity_filter', r.entity_filter, 'sensor.*_battery')) +
      fld('Or a device class', inp('device_class', r.device_class, 'battery')) + fld('Exclude (comma list)', inp('exclude', (r.exclude || []).join(', '), 'sensor.phone_*')) + '</div>';
    h += '<div class="rowf">' + fld('Attribute (optional)', inp('attribute', r.attribute, 'battery_level')) + fld('Alert when value', sel('operator', OPS, r.operator)) + fld('Compared to', inp('state', r.state, 'on')) + fld('From', inp('time_from', r.time_from, '', 'time')) + fld('Until', inp('time_to', r.time_to, '', 'time')) + '</div>';
    h += '<label>Template condition (optional, must be true)</label><textarea data-f="template" style="min-height:60px" spellcheck="false" placeholder="{{ states(\'sensor.x\') | float(0) > 5 }}">' + esc(r.template) + '</textarea>';
    h += '<div class="bar" style="margin-top:8px"><button class="btn sm" data-act="alert-check">Check matches</button></div><div id="acheck" class="small muted">' + (p._acheck || '') + '</div>';
    h += '<div class="name" style="margin-top:12px">Look and feel</div><div class="rowf">' + fld('Icon', inp('icon', r.icon, 'mdi:garage-open')) + fld('Color (optional)', inp('color', r.color, '#FFC857')) + fld('Camera', sel('camera_entity', cams, r.camera_entity)) +
      fld('Tap does', sel('tap_action', TAPS, ta.action)) + fld('Path, URL, entity or action', inp('tap_value', ta[VALKEY[ta.action]] || '', '/newui-4-0/cameras')) + '</div>';
    h += '<label>Action data (JSON, for Run action)</label><textarea data-f="tap_data" style="min-height:44px" spellcheck="false">' + esc(ta.service_data && Object.keys(ta.service_data).length ? JSON.stringify(ta.service_data) : '') + '</textarea>';
    h += '<div class="name" style="margin-top:12px">Who and where</div><label>Who sees it</label>' + who;
    h += '<div class="rowf">' + fld('Also send through Nabu route (when it first appears)', sel('route', routes, r.route)) + '</div>';
    h += '<div class="whos">' + chk('snoozable', 'Can be snoozed', r.snoozable) + chk('enabled', 'Alert enabled', r.enabled) + '</div>';
    return h + '<div class="bar"><button class="btn pri" data-act="alert-save">Save alert</button><button class="btn" data-act="alert-cancel">Cancel</button></div></div>';
  }

  function vSettings(p) {
    var s = p._data.alerts.settings, wx = withCur([['', 'None']].concat((p._data.discovery.weather || []).map(function (x) { return [x, x]; })), s.clear_weather_entity);
    return '<div class="card" id="asform"><div class="name">Display</div><div class="rowf">' + fld('Cycle every (seconds)', inp('cycle_seconds', s.cycle_seconds, '6', 'number', ' min="3" max="120"')) + fld('Transition', sel('transition', TRANS, s.transition)) +
      fld('Snooze choices (hours)', inp('snooze_hours', s.snooze_hours.join(', '), '1, 4, 8, 24')) + fld('When nothing is wrong', sel('clear_mode', CLEARS, s.clear_mode)) + fld('All-clear message', inp('clear_message', s.clear_message, '')) + fld('Weather entity', sel('clear_weather_entity', wx, s.clear_weather_entity)) + '</div>' +
      '<div class="whos">' + chk('enabled', 'Alerts Flow on', s.enabled) + chk('clock_24h', '24-hour clock', s.clock_24h) + chk('clock_show_date', 'Show date under the clock', s.clock_show_date) + chk('severity_border', 'Colored edge by priority', s.severity_border) + chk('show_count', 'Show 1/1 counter on a single alert', s.show_count) + chk('allow_user_actions', 'Everyone can snooze and dismiss', s.allow_user_actions) + '</div>' +
      '<div class="bar" style="margin-top:12px"><button class="btn pri" data-act="alert-settings-save">Save display</button></div></div>' +
      '<div class="muted small">Add the strip with <b>alerts: true</b> on the top bar card, or use the card <b>custom:nabu-alerts-card</b>. Automations can raise one-off alerts with the nabu_flow.alert action.</div>';
  }

  function vImport(p) {
    var h = '<div class="card" id="iform"><div class="name">Import from AlertTicker</div><div class="muted small">Open your AlertTicker card, choose Show code editor, copy everything and paste it here. Rules are converted on a best-effort basis; review them before turning them on.</div>' +
      '<label>AlertTicker card YAML</label><textarea data-f="text" spellcheck="false" style="min-height:180px"></textarea><div class="bar" style="margin-top:10px"><button class="btn pri" data-act="alert-convert">Convert</button></div></div>';
    var c = p._conv;
    if (!c) { return h; }
    var ids = Object.keys(c.rules);
    h += '<div class="card"><div class="name">' + ids.length + ' rule' + (ids.length === 1 ? '' : 's') + ' ready</div>';
    c.warnings.forEach(function (w) { h += '<div class="warn small">' + esc(w) + '</div>'; });
    h += ids.map(function (k) { return '<div style="margin-top:8px"><b>' + esc(c.rules[k].name) + '</b> ' + summary(c.rules[k]) + '</div>'; }).join('');
    h += '<div class="whos" style="margin-top:10px">' + chk('keep_display', 'Also apply the display settings found', Object.keys(c.settings).length > 0) + '</div>';
    return h + '<div class="bar" id="iadd" style="margin-top:8px"><button class="btn pri" data-act="alert-import">Add to Alerts Flow</button></div></div>';
  }

  function vLog(p) {
    if (!p._alog) {
      p._ws('nabu_flow/alerts_log').then(function (r) { p._alog = r.items; if (p._tab === 'alerts' && p._asub === 'log') { p._render(); } });
      return '<div class="card muted">Loading...</div>';
    }
    var h = '<div class="bar"><button class="btn" data-act="alert-log-refresh">Refresh</button></div>';
    if (!p._alog.length) { return h + '<div class="card muted">No alert activity yet.</div>'; }
    return h + p._alog.map(function (e) {
      var when = new Date(e.ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      return '<div class="card"><div class="row"><span class="name">' + esc(e.name) + '</span>' + chip(e.event, e.event === 'triggered' ? 'warn' : e.event === 'cleared' ? 'ok' : '') + '</div><div>' + esc(e.message) + '</div><div class="muted small">' + esc(when) + '</div></div>';
    }).join('');
  }

  function ruleFromForm(p) {
    var form = p._root.querySelector('#aform'), f = readForm(form), who = [], old = p._aedit ? p._data.alerts.rules[p._aedit] : null;
    form.querySelectorAll('[data-who]').forEach(function (n) { if (n.checked) { who.push(n.getAttribute('data-who')); } });
    if (!who.length || who.indexOf('all') >= 0) { who = ['all']; }
    var act = { action: f.tap_action };
    if (VALKEY[f.tap_action]) { act[VALKEY[f.tap_action]] = f.tap_value; }
    if (f.tap_action === 'call-service') { act.service_data = f.tap_data; }
    return {
      name: String(f.name || '').trim(), priority: f.priority, mode: f.mode, auto_dismiss: parseInt(f.auto_dismiss, 10) || 0, message: f.message, secondary: f.secondary,
      entity: f.entity, entity_filter: f.entity_filter, device_class: f.device_class, exclude: f.exclude, attribute: f.attribute, operator: f.operator, state: f.state,
      template: f.template, time_from: f.time_from, time_to: f.time_to, icon: f.icon, color: f.color, camera_entity: f.camera_entity, route: f.route,
      snoozable: f.snoozable, enabled: f.enabled, visible_to: who, tap_action: act, hold_action: old ? old.hold_action : { action: 'default' }
    };
  }

  function saveAlerts(p, alerts, msg) {
    p._edit = null;
    return p._save('alerts', alerts, msg);
  }
  function withRules(p, mut) {
    var a = JSON.parse(JSON.stringify(p._data.alerts));
    mut(a.rules);
    return a;
  }

  function install(proto) {
    proto._vAlerts = function () { return view(this); };
    proto._a_alert_sub = function (v) { this._asub = v; this._aedit = null; if (v === 'log') { this._alog = null; } this._render(); };
    proto._a_alert_new = function () { this._aedit = ''; this._acheck = ''; this._render(); };
    proto._a_alert_edit = function (v) { this._aedit = v; this._acheck = ''; this._render(); };
    proto._a_alert_cancel = function () { this._aedit = null; this._render(); };
    proto._a_alert_save = function () {
      var rule = ruleFromForm(this), id = this._aedit === '' ? slug(rule.name) : this._aedit;
      if (!rule.name || !id) { say(this, 'Give the alert a name.'); return; }
      if (!rule.entity && !rule.entity_filter && !rule.device_class && !rule.template) { say(this, 'Pick an entity, a pattern, a device class or a template.'); return; }
      if (this._aedit === '' && this._data.alerts.rules[id]) { say(this, 'An alert with that name already exists.'); return; }
      this._aedit = null;
      saveAlerts(this, withRules(this, function (r) { r[id] = rule; }), 'Alert saved');
    };
    proto._a_alert_del = function (v) { saveAlerts(this, withRules(this, function (r) { delete r[v]; }), 'Alert deleted'); };
    proto._a_alert_toggle = function (v) { saveAlerts(this, withRules(this, function (r) { r[v].enabled = !r[v].enabled; }), 'Saved'); };
    proto._a_alert_starter = function (v) {
      var s = Object.assign({}, STARTERS[v]);
      saveAlerts(this, withRules(this, function (r) { r[v] = s; }), 'Added ' + s.name + '. Edit it to fit your home.');
    };
    proto._a_alert_test = function (v) {
      var self = this;
      this._ws('nabu_flow/alerts_test', { rule_id: v }).then(function () { say(self, 'Test alert shown for 30 seconds.'); }).catch(function (e) { say(self, 'Test failed: ' + ((e && e.message) || e)); });
    };
    proto._a_alert_check = function () {
      var self = this, rule = ruleFromForm(this), box = this._root.querySelector('#acheck');
      this._ws('nabu_flow/alerts_preview', { rule: rule }).then(function (r) {
        var h = r.note ? esc(r.note) + ' ' : '';
        h += r.count + ' match' + (r.count === 1 ? '' : 'es') + ', ' + r.active + ' active now. ';
        h += r.entities.slice(0, 12).map(function (e) { return chip(e.entity_id + ' ' + e.state, e.active ? 'warn' : ''); }).join('');
        self._acheck = h;
        if (box) { box.innerHTML = h; }
      });
    };
    proto._a_alert_settings_save = function () {
      var f = readForm(this._root.querySelector('#asform'));
      f.cycle_seconds = parseInt(f.cycle_seconds, 10) || 6;
      var a = JSON.parse(JSON.stringify(this._data.alerts));
      a.settings = Object.assign(a.settings, f);
      saveAlerts(this, a, 'Display saved');
    };
    proto._a_alert_convert = function () {
      var self = this, f = readForm(this._root.querySelector('#iform'));
      this._ws('nabu_flow/alerts_convert', { text: f.text }).then(function (r) { self._conv = r; self._render(); }).catch(function (e) { say(self, (e && e.message) || 'Could not convert that.'); });
    };
    proto._a_alert_import = function () {
      var c = this._conv, keep = this._root.querySelector('[data-f="keep_display"]'), a = JSON.parse(JSON.stringify(this._data.alerts));
      Object.keys(c.rules).forEach(function (k) {
        var id = k, n = 2;
        while (a.rules[id]) { id = k + '_' + n; n += 1; }
        a.rules[id] = c.rules[k];
      });
      if (keep && keep.checked) { a.settings = Object.assign(a.settings, c.settings); }
      this._conv = null;
      this._asub = 'rules';
      saveAlerts(this, a, 'Imported ' + Object.keys(c.rules).length + ' alert rules');
    };
    proto._a_alert_log_refresh = function () { this._alog = null; this._render(); };
  }

  function after(p) {
    var slot = p._root.querySelector('#livestrip');
    if (!slot || !window.customElements.get('nabu-alert-strip')) { return; }
    var el = document.createElement('nabu-alert-strip');
    el.setConfig({});
    el.hass = p._hass;
    slot.appendChild(el);
  }

  window.NabuFlowAlertsTab = { install: install, after: after };
})();
