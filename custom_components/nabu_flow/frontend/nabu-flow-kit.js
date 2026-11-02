/* Nabu Flow panel helpers (styles, markup builders). Loaded by nabu-flow-panel.js.
   Split out to keep each file well under the iOS companion 24KB resource limit. */
(function () {
  'use strict';

  var TABS = [['routes', 'Routes'], ['alerts', 'Alerts'], ['audit', 'Audit'], ['people', 'People'], ['channels', 'Channels'], ['history', 'History'], ['settings', 'Settings']];
  var SEVS = [['info', 'Info'], ['heads_up', 'Heads-up'], ['critical', 'Critical']];
  var PHONES = [['auto', 'Auto (critical only)'], ['none', 'None'], ['normal', 'Normal'], ['urgent', 'Urgent (time sensitive)'], ['critical', 'Critical (loud)']];
  var PRES = [['aware', 'Aware'], ['ignore', 'Ignore'], ['home_only', 'Home only']];
  var KIND_CLS = { nabu: 'ok', nabu_dynamic: 'ok', nabu_inline: 'warn', nabu_unknown_route: 'bad', legacy_script: 'warn', discord_direct: 'warn', phone_direct: 'warn', persistent: '', other_notify: '' };

  var CSS = [
    ':host{display:block;min-height:100vh;background:#0e1116;color:#eef1f5;font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;--bd:rgba(255,255,255,.12);--mut:#9aa4b2;--amber:#FFC857;--teal:#5EEAD4}',
    '*{box-sizing:border-box}',
    '.wrap{max-width:1100px;margin:0 auto;padding:12px 16px calc(96px + env(safe-area-inset-bottom))}',
    '.top{display:flex;align-items:center;gap:12px;min-height:56px}',
    '.logo{width:40px;height:40px;flex:0 0 40px}',
    '.ttl{font-size:20px;font-weight:700}',
    '.muted{color:var(--mut)}',
    '.tabs{display:flex;gap:6px;overflow-x:auto;margin:12px 0;padding-bottom:4px}',
    '.tab{flex:0 0 auto;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid var(--bd);background:transparent;color:var(--mut);font:inherit;cursor:pointer}',
    '.tab.on{background:var(--amber);color:#1a1405;border-color:var(--amber);font-weight:600}',
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:12px}',
    '.card{background:rgba(255,255,255,.06);border:1px solid var(--bd);border-radius:16px;padding:14px;margin-bottom:12px;-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}',
    '.grid .card{margin-bottom:0}',
    '.bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}',
    '.row{display:flex;align-items:center;gap:8px;justify-content:space-between}',
    '.name{font-weight:600;font-size:15px}',
    '.chip{display:inline-block;padding:2px 10px;border-radius:999px;background:rgba(255,255,255,.09);font-size:12px;margin:3px 4px 0 0}',
    '.chip.ok{background:rgba(94,234,212,.16);color:var(--teal)}',
    '.chip.warn{background:rgba(255,200,87,.16);color:var(--amber)}',
    '.chip.bad{background:rgba(229,72,77,.2);color:#ff9a9d}',
    '.ok{color:var(--teal)}.bad{color:#ff9a9d}.warn{color:var(--amber)}',
    '.dot{width:10px;height:10px;border-radius:50%;display:inline-block;flex:0 0 10px}',
    '.sev-info{background:#5B8DEF}.sev-heads_up{background:#FFC857}.sev-critical{background:#E5484D}',
    '.btn{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--bd);background:rgba(255,255,255,.08);color:inherit;font:inherit;cursor:pointer}',
    '.btn.pri{background:var(--amber);color:#1a1405;border-color:var(--amber);font-weight:600}',
    '.btn.dng{color:#ff9a9d}',
    '.btn.sm{min-height:40px;padding:0 12px}',
    'label{display:block;font-size:12px;color:var(--mut);margin:10px 0 4px}',
    'input,select,textarea{width:100%;min-height:44px;background:rgba(0,0,0,.35);color:inherit;border:1px solid var(--bd);border-radius:10px;padding:8px 10px;font:inherit}',
    'textarea{min-height:140px;font-family:ui-monospace,Menlo,monospace;font-size:12px}',
    'input[type=checkbox]{width:20px;height:20px;min-height:0;flex:0 0 20px}',
    '.chk{display:flex;align-items:center;gap:8px;color:#eef1f5;font-size:14px;margin:8px 0}',
    '.rowf{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;align-items:end}',
    '.whos{display:flex;flex-wrap:wrap;gap:4px 18px}',
    'a{color:var(--amber)}',
    '.toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom));transform:translateX(-50%);max-width:90vw;background:#202734;border:1px solid var(--bd);padding:10px 16px;border-radius:12px;z-index:10}',
    '.small{font-size:12px}'
  ].join('');

  var FACE = '<svg class="logo" viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" rx="40" fill="#F4E9D8"/><line x1="100" y1="42" x2="100" y2="24" stroke="#12303A" stroke-width="6" stroke-linecap="round"/><circle cx="100" cy="18" r="8" fill="#E8A317"/><rect x="38" y="52" width="124" height="104" rx="24" fill="#12303A"/><rect x="24" y="86" width="14" height="36" rx="7" fill="#12303A"/><rect x="162" y="86" width="14" height="36" rx="7" fill="#12303A"/><circle cx="76" cy="98" r="15" fill="#F4E9D8"/><circle cx="124" cy="98" r="15" fill="#F4E9D8"/><circle cx="80" cy="93" r="5.5" fill="#FFC857"/><circle cx="128" cy="93" r="5.5" fill="#FFC857"/><path d="M82 128 Q100 142 118 128" fill="none" stroke="#F4E9D8" stroke-width="6" stroke-linecap="round"/></svg>';

  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function slug(v) {
    return String(v || '').trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48);
  }
  function opts(list, cur) {
    return list.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (o[0] === cur ? ' selected' : '') + '>' + esc(o[1]) + '</option>';
    }).join('');
  }
  function withCur(list, cur) {
    if (cur && !list.some(function (o) { return o[0] === cur; })) { return list.concat([[cur, cur]]); }
    return list;
  }
  function fld(label, inner) { return '<div><label>' + esc(label) + '</label>' + inner + '</div>'; }
  function inp(f, v, ph, type, extra) {
    return '<input data-f="' + f + '" type="' + (type || 'text') + '" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '"' + (extra || '') + '>';
  }
  function sel(f, list, cur) { return '<select data-f="' + f + '">' + opts(list, cur) + '</select>'; }
  function chk(f, label, on) {
    return '<label class="chk"><input data-f="' + f + '" type="checkbox"' + (on ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }
  function chip(text, cls) { return '<span class="chip ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function label(list, v) {
    for (var i = 0; i < list.length; i++) { if (list[i][0] === v) { return list[i][1]; } }
    return v;
  }
  function readForm(el) {
    var out = {};
    el.querySelectorAll('[data-f]').forEach(function (n) {
      out[n.getAttribute('data-f')] = n.type === 'checkbox' ? n.checked : n.value;
    });
    return out;
  }

  window.NabuFlowKit = {
    TABS: TABS,
    SEVS: SEVS,
    PHONES: PHONES,
    PRES: PRES,
    KIND_CLS: KIND_CLS,
    CSS: CSS,
    FACE: FACE,
    esc: esc,
    slug: slug,
    opts: opts,
    withCur: withCur,
    fld: fld,
    inp: inp,
    sel: sel,
    chk: chk,
    chip: chip,
    label: label,
    readForm: readForm
  };
})();
