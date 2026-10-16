import {
  RAPID_INSULINS,
  BASAL_INSULINS,
  DEFAULT_NOTE as defaultNote,
  LIMITS,
  createBlankRapidProfile as blankRapid,
  createSensitivityPreset as presetSensitivity,
  createInitialRegimen as initialState,
  createBasalProfile,
  getCurrentNote,
  normalizeRegimen,
  isValidRegimen,
  formatRegimenParagraph,
  ProfileRepository,
  createPaperCss,
  getPrintScale,
  clone,
} from '@hhr/insulin-core';
import { TEMPLATE } from './template.js';
import { STYLES } from './styles.js';
import { downloadText, createStandaloneDocument, safeJson } from './portable.js';

/** Mount one independent planner. The return value is the public host integration API. */
export function mountInsulinPlanner(root, options = {}) {
  if (!root?.ownerDocument) throw new TypeError('Se requiere un elemento contenedor.');
  const doc = root.ownerDocument,
    win = doc.defaultView,
    abort = new win.AbortController();
  root.classList.add('hhr-insulin');
  root.innerHTML = TEMPLATE;
  const style = doc.createElement('style');
  style.textContent = STYLES;
  root.prepend(style);
  const $ = (id) => root.querySelector('#' + id);
  for (const id of ['paciente', 'rut', 'fecha', 'prescriber'])
    if (options.identity?.[id]) $(id).value = options.identity[id];
  if (options.brand?.logoSrc) $('logoImage').src = options.brand.logoSrc;
  if (options.brand?.hospitalName)
    root.querySelector('.hospital-name').textContent = options.brand.hospitalName;
  if (options.brand?.hospitalSubtitle)
    root.querySelector('.hospital-sub').textContent = options.brand.hospitalSubtitle;
  function readJson(id, fallback) {
    const key = {
      savedState: 'regimen',
      savedProfiles: 'profiles',
      savedPreferences: 'preferences',
    }[id];
    if (options.savedSnapshot && options.savedSnapshot[key] != null)
      return options.savedSnapshot[key];
    try {
      return JSON.parse($(id).textContent) ?? fallback;
    } catch {
      return fallback;
    }
  }
  function browserStorage() {
    try {
      return win.localStorage;
    } catch {
      return null;
    }
  }
  function status(message) {
    $('status').textContent = message;
  }
  function listen(target, type, listener) {
    target.addEventListener(
      type,
      listener,
      target === win || root.contains(target) ? { signal: abort.signal } : undefined,
    );
  }
  const medicines = Object.fromEntries(
    Object.entries(RAPID_INSULINS).map(([id, m]) => [id, [m.name, '']]),
  );
  const basals = Object.fromEntries(
    Object.entries(BASAL_INSULINS).map(([id, m]) => [id, [m.name, '']]),
  );
  let rendering = false;
  let state = initialState();
  const saved = readJson('savedState', null);
  if (isValidRegimen(saved)) state = normalizeRegimen(saved);
  if (options.initialRegimen) state = normalizeRegimen(options.initialRegimen);
  function rapid() {
    return state.rapidProfiles[state.rapid] || (state.rapidProfiles[state.rapid] = blankRapid());
  }
  function basal() {
    return (
      state.basalProfiles[state.basal] ||
      (state.basalProfiles[state.basal] = createBasalProfile(state.basal))
    );
  }
  function basalVisible() {
    return state.basal !== 'none' && state.showBasal !== false;
  }
  function currentNote() {
    return getCurrentNote(state);
  }
  function notify() {
    if (rendering) return;
    root.dispatchEvent(
      new win.CustomEvent('hhr:change', {
        detail: { regimen: normalizeRegimen(state) },
        bubbles: true,
      }),
    );
  }
  function field(value, label, classes, multiline = false) {
    const el = doc.createElement(multiline ? 'textarea' : 'input');
    el.className = 'editable ' + classes;
    el.setAttribute('aria-label', label);
    if (multiline) el.rows = 1;
    else el.type = 'text';
    el.value = value;
    el.autocomplete = 'off';
    return el;
  }
  function row(table, fields) {
    const tr = doc.createElement('tr'),
      index = table.children.length,
      kind =
        table.id === 'correctionRows'
          ? 'refuerzo'
          : table.id === 'sensitivityRows'
            ? 'sensibilidad'
            : table.id === 'mealRows'
              ? 'comida'
              : 'basal';
    fields.forEach((f, i) => {
      const td = doc.createElement('td');
      if (i === fields.length - 1) {
        const wrap = doc.createElement('div');
        wrap.className = 'cell-content';
        const remove = doc.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-row';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Eliminar fila de ' + kind + ' ' + (index + 1));
        remove.title = 'Eliminar esta fila';
        listen(remove, 'click', () => {
          capture();
          const p = rapid(),
            b = state.basal === 'none' ? null : basal();
          const keys =
            kind === 'refuerzo' || kind === 'sensibilidad'
              ? ['ranges', 'doses']
              : kind === 'comida'
                ? ['meals', 'fixed']
                : ['times', 'doses'];
          const profile = kind === 'basal' ? b : kind === 'sensibilidad' ? p.sensitivity : p;
          if (kind === 'basal') {
            if (b.frequency !== 'custom') {
              b.times = b.times.slice(0, Number(b.frequency));
              b.doses = b.doses.slice(0, Number(b.frequency));
            }
            b.frequency = 'custom';
          }
          keys.forEach((key) => profile[key].splice(index, 1));
          render();
          const next = table.querySelectorAll('.remove-row');
          (
            next[Math.min(index, next.length - 1)] ||
            table.closest('.panel').querySelector('[data-add]')
          ).focus();
          $('status').textContent =
            'Fila eliminada. Puede añadir una nueva o restablecer la plantilla.';
        });
        wrap.append(f, remove);
        td.append(wrap);
      } else td.append(f);
      tr.append(td);
    });
    table.append(tr);
  }
  function capture() {
    if (rendering) return;
    const p = rapid();
    p.ranges = [...root.querySelectorAll('#correctionRows .editable.range')].map((e) => e.value);
    p.doses = [...root.querySelectorAll('#correctionRows .editable.dose')].map((e, i) =>
      state.showFixed === false &&
      p.doses[i] === '0 UI de refuerzo (solo dosis fija)' &&
      e.value === '0 UI de refuerzo'
        ? p.doses[i]
        : e.value,
    );
    p.meals = [...root.querySelectorAll('#mealRows .editable.meal-name')].map((e) => e.value);
    p.fixed = [...root.querySelectorAll('#mealRows .editable.meal-dose')].map((e) => e.value);
    if (p.useSensitivity) {
      p.sensitivity.note = $('patientNote').value;
      root.querySelectorAll('#sensitivityRows tr').forEach((tr, i) => {
        p.sensitivity.ranges[i] = tr.querySelector('.editable.sensitivity-range').value;
        tr.querySelectorAll('.editable.sensitivity-dose').forEach(
          (el) => (p.sensitivity.doses[i][Number(el.dataset.column)] = el.value),
        );
      });
    } else if ($('patientNote').value !== currentNote()) p.note = $('patientNote').value;
    p.custom = $('rapidCustom').value;
    if (state.basal !== 'none') {
      const b = basal();
      root
        .querySelectorAll('#basalRows .editable.basal-time')
        .forEach((el, i) => (b.times[i] = el.value));
      root
        .querySelectorAll('#basalRows .editable.basal-dose')
        .forEach((el, i) => (b.doses[i] = el.value));
      b.custom = $('basalCustom').value;
    }
  }
  function titles() {
    const p = rapid(),
      m = medicines[state.rapid],
      name = state.rapid === 'custom' ? p.custom || m[0] : m[0];
    $('headingCorrection').textContent =
      name +
      (p.useSensitivity ? ': corrección según sensibilidad' : ': refuerzo según glicemia (HGT)');
    $('headingFixed').textContent = name + ' precomidas: dosis fija';
    root.querySelector('.rapidMedication').textContent = '';
    $('correctionSub').textContent = p.useSensitivity
      ? 'Dosis de insulina correccional · UI' +
        (p.sensitivityView === 'all'
          ? ' · según sensibilidad del paciente'
          : ' · ' +
            ['Insulinosensible', 'Normal', 'Insulinorresistente'][Number(p.sensitivityView)])
      : state.rapid === 'apidra' && state.showFixed !== false
        ? 'Agregar a la dosis fija de Apidra precomidas.'
        : 'Pauta individualizada indicada por el profesional tratante.';
    if (state.basal !== 'none') {
      const b = basal(),
        bm = basals[state.basal];
      $('headingBasal').textContent =
        'Insulina basal: ' + (state.basal === 'custom' ? b.custom || bm[0] : bm[0]);
      $('basalMedication').textContent =
        b.frequency === '1'
          ? '1 vez al día'
          : b.frequency === '2'
            ? '2 veces al día'
            : 'Horarios personalizados';
    }
  }
  function resize(el) {
    if (el.tagName === 'TEXTAREA') {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  }
  function mirrors() {
    root.querySelectorAll('.print-value').forEach((e) => e.remove());
    root.querySelectorAll('.sheet input,.sheet textarea').forEach((el) => {
      const span = doc.createElement('span');
      span.className = 'print-value ' + [...el.classList].filter((c) => c !== 'editable').join(' ');
      span.textContent = el.value;
      span.setAttribute('aria-hidden', 'true');
      el.after(span);
    });
  }
  // Removing focused inputs can emit blur/change synchronously. Do not capture
  // a partially rebuilt DOM into the newly selected insulin profile.
  function render() {
    rendering = true;
    try {
      const p = rapid();
      $('rapidSelect').value = state.rapid;
      $('basalSelect').value = state.basal;
      $('rapidCustomWrap').hidden = state.rapid !== 'custom';
      $('basalCustomWrap').hidden = state.basal !== 'custom';
      $('rapidCustom').value = p.custom;
      $('correctionRows').replaceChildren();
      p.ranges.forEach((v, i) =>
        row($('correctionRows'), [
          field(v, 'Rango HGT ' + (i + 1), 'range'),
          field(
            state.showFixed === false && p.doses[i] === '0 UI de refuerzo (solo dosis fija)'
              ? '0 UI de refuerzo'
              : p.doses[i],
            'Refuerzo o conducta ' + (i + 1),
            'dose' + (p.doses[i].length > 18 ? ' long' : ''),
            true,
          ),
        ]),
      );
      $('mealRows').replaceChildren();
      p.meals.forEach((v, i) =>
        row($('mealRows'), [
          field(v, 'Comida ' + (i + 1), 'meal-name'),
          field(p.fixed[i], 'Dosis ' + v, 'dose meal-dose'),
        ]),
      );
      $('patientNote').value = currentNote();
      $('patientNote').closest('.note').hidden =
        currentNote() === '' && state.showCorrection === false;
      renderSensitivity();
      renderBasal();
      ['correctionRows', 'mealRows', 'basalRows'].forEach((id) =>
        $(id)
          .closest('.panel')
          .classList.toggle(
            'empty',
            id === 'correctionRows' && p.useSensitivity
              ? p.sensitivity.ranges.length === 0
              : $(id).children.length === 0,
          ),
      );
      $('profileBadge').textContent = p.useSensitivity
        ? 'Corrección por sensibilidad'
        : state.rapid === 'apidra'
          ? 'Perfil Apidra'
          : 'Pauta individual';
      titles();
      root.querySelectorAll('textarea').forEach(resize);
      mirrors();
    } finally {
      rendering = false;
    }
  }
  function renderBasal() {
    const visible = basalVisible();
    $('basalPanel').hidden = !visible;
    $('showBasal').checked =
      state.showBasal === undefined ? state.basal !== 'none' : !!state.showBasal;
    root.querySelector('[data-state-for="showBasal"]').textContent = $('showBasal').checked
      ? 'On'
      : 'Off';
    $('basalSettings').hidden = !visible;
    $('printSheet').classList.toggle('has-basal', visible);
    $('basalRows').replaceChildren();
    if (state.basal !== 'none') {
      const b = basal();
      $('basalCustom').value = b.custom;
      $('basalFrequency').value = b.frequency;
      const count = b.frequency === 'custom' ? b.times.length : Number(b.frequency);
      for (let i = 0; i < count; i++)
        row($('basalRows'), [
          field(b.times[i] || '', 'Horario basal ' + (i + 1), 'basal-time'),
          field(b.doses[i] || '', 'Dosis basal ' + (i + 1) + ' en UI', 'basal-dose'),
        ]);
    }
  }
  listen($('basalFrequency'), 'change', (e) => {
    capture();
    const b = basal();
    b.frequency = e.target.value;
    if (b.frequency === '2')
      while (b.times.length < 2) {
        b.times.push('');
        b.doses.push('');
      }
    render();
    $('status').textContent =
      'Frecuencia basal actualizada; complete las dosis y horarios indicados.';
  });
  function updateBoundaryNotice() {
    const ranges = [...root.querySelectorAll('#sensitivityRows .editable.sensitivity-range')].map(
      (el) => el.value.replace(/\s/g, ''),
    );
    $('boundaryNotice').hidden = !(ranges.includes('<140') && ranges.includes('141–180'));
  }
  function renderSensitivity() {
    const p = rapid(),
      active = !!p.useSensitivity,
      view = p.sensitivityView,
      columns = view === 'all' ? [0, 1, 2] : [Number(view)],
      names = ['Insulinosensible', 'Normal', 'Insulinorresistente'];
    $('showCorrection').checked = state.showCorrection !== false;
    $('showFixed').checked = state.showFixed !== false;
    $('sensitivityToggle').checked = active;
    $('sensitivityView').value = view;
    $('sensitivitySettings').hidden = !active;
    $('correctionPanel').hidden = state.showCorrection === false;
    $('fixedPanel').hidden = state.showFixed === false;
    $('originalCorrection').hidden = active;
    $('sensitivityTable').hidden = !active;
    root.querySelector('[data-add="correction"]').textContent = '+ Añadir rango';
    root
      .querySelectorAll('[data-state-for]')
      .forEach((el) => (el.textContent = $(el.dataset.stateFor).checked ? 'On' : 'Off'));
    $('sensitivityCols').replaceChildren();
    for (let i = 0; i < columns.length + 1; i++)
      $('sensitivityCols').append(doc.createElement('col'));
    const tr = doc.createElement('tr');
    ['HGT · mg/dL', ...columns.map((i) => names[i] + ' · UI')].forEach((name) => {
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = name;
      tr.append(th);
    });
    $('sensitivityHead').replaceChildren(tr);
    $('sensitivityRows').replaceChildren();
    p.sensitivity.ranges.forEach((v, i) => {
      const fields = [field(v, 'Rango sensibilidad ' + (i + 1), 'sensitivity-range')];
      columns.forEach((col) => {
        const el = field(
          p.sensitivity.doses[i][col],
          'Dosis ' + names[col] + ' rango ' + (i + 1) + ' en UI',
          'sensitivity-dose',
        );
        el.dataset.column = String(col);
        fields.push(el);
      });
      row($('sensitivityRows'), fields);
    });
    $('correctionPanel').classList.toggle(
      'empty',
      active ? p.sensitivity.ranges.length === 0 : p.ranges.length === 0,
    );
    updateBoundaryNotice();
  }
  function setVisibility(id, value) {
    capture();
    state[id] = value;
    render();
    $('status').textContent =
      id === 'showBasal' && value && state.basal === 'none'
        ? 'Seleccione la insulina basal para incluir su cuadro.'
        : value
          ? 'Cuadro incluido en la hoja y en la impresión.'
          : 'Cuadro retirado de la hoja y de la impresión; puede reactivarlo con el interruptor.';
  }
  ['showCorrection', 'showFixed', 'showBasal'].forEach((id) =>
    listen($(id), 'change', (e) => setVisibility(id, e.target.checked)),
  );
  root.querySelectorAll('[data-hide]').forEach((el) =>
    listen(el, 'click', () => {
      setVisibility(el.dataset.hide, false);
      $(el.dataset.hide).focus();
    }),
  );
  listen($('sensitivityToggle'), 'change', (e) => {
    capture();
    rapid().useSensitivity = e.target.checked;
    render();
    $('status').textContent = e.target.checked
      ? 'Pauta correccional de la imagen activada. Puede mostrar las tres sensibilidades o elegir una.'
      : 'Pauta anterior recuperada; se conservaron sus dosis y ajustes.';
  });
  listen($('sensitivityView'), 'change', (e) => {
    capture();
    rapid().sensitivityView = e.target.value;
    render();
  });
  listen($('rapidSelect'), 'change', (e) => {
    capture();
    state.rapid = e.target.value;
    render();
    $('status').textContent =
      state.rapid === 'apidra'
        ? 'Apidra: pauta de esta sesión recuperada.'
        : 'Complete y revise dosis e indicaciones de esta insulina. Las dosis de Apidra no se transfieren.';
  });
  listen($('basalSelect'), 'change', (e) => {
    capture();
    state.basal = e.target.value;
    state.showBasal = state.basal !== 'none';
    render();
    $('status').textContent =
      state.basal === 'none'
        ? 'Se retiró la sección basal de la hoja.'
        : 'Complete la dosis en UI y el horario de la insulina basal seleccionada.';
  });
  listen($('rapidCustom'), 'input', () => {
    rapid().custom = $('rapidCustom').value;
    titles();
  });
  listen($('basalCustom'), 'input', () => {
    if (state.basal !== 'none') {
      basal().custom = $('basalCustom').value;
      titles();
    }
  });
  listen($('printSheet'), 'input', (e) => {
    resize(e.target);
    if (e.target.classList.contains('sensitivity-range')) updateBoundaryNotice();
    mirrors();
  });
  root.querySelectorAll('[data-add]').forEach((button) =>
    listen(button, 'click', () => {
      capture();
      const kind = button.dataset.add,
        p = rapid();
      let target;
      if (kind === 'correction') {
        if (p.useSensitivity) {
          p.sensitivity.ranges.push('');
          p.sensitivity.doses.push(['', '', '']);
          target = 'sensitivityRows';
        } else {
          p.ranges.push('');
          p.doses.push('');
          target = 'correctionRows';
        }
      } else if (kind === 'meal') {
        p.meals.push('');
        p.fixed.push('');
        target = 'mealRows';
      } else {
        const b = basal();
        if (b.frequency !== 'custom') {
          b.times = b.times.slice(0, Number(b.frequency));
          b.doses = b.doses.slice(0, Number(b.frequency));
        }
        b.frequency = 'custom';
        b.times.push('');
        b.doses.push('');
        target = 'basalRows';
      }
      render();
      $(target).lastElementChild.querySelector('.editable').focus();
      $('status').textContent = 'Fila añadida. Complete el rango u horario y la dosis indicada.';
    }),
  );
  listen($('restoreBtn'), 'click', () => {
    state = initialState();
    render();
    $('status').textContent =
      'Plantilla restablecida: filas y dosis originales de Apidra. Se conservaron los datos del paciente y el logo.';
  });

  const repository = new ProfileRepository({
    storage: Object.hasOwn(options, 'storage') ? options.storage : browserStorage(),
    namespace: options.storageNamespace,
    seed: readJson('savedProfiles', []),
    preferences: readJson('savedPreferences', null),
  });
  let preferences = repository.getPreferences();
  function listProfiles(selected = '') {
    $('profileSelect').replaceChildren(new win.Option('Seleccionar perfil guardado', ''));
    for (const p of repository.list())
      $('profileSelect').add(
        new win.Option(p.name + (p.id === preferences.defaultId ? ' ★ Predeterminado' : ''), p.id),
      );
    $('profileSelect').value = selected;
    const p = repository.get(preferences.defaultId);
    $('defaultProfileLabel').textContent = p
      ? 'Inicio: ' + p.name
      : 'Inicio: sin perfil predeterminado';
  }
  function selectedProfile() {
    return repository.get($('profileSelect').value);
  }
  function persisted(message) {
    preferences = repository.getPreferences();
    $('status').textContent = repository.persistent
      ? message
      : message + ' Use Guardar HTML o Exportar perfiles para conservarlo en un archivo.';
  }
  function applyPaper() {
    $('paperSize').value = preferences.paperSize;
    $('paperStyle').textContent = createPaperCss(preferences.paperSize);
  }
  listen($('paperSize'), 'change', () => {
    repository.setPaperSize($('paperSize').value);
    preferences = repository.getPreferences();
    applyPaper();
    persisted('Papel de impresión actualizado.');
  });
  listen($('setDefaultProfile'), 'click', () => {
    const p = selectedProfile();
    if (!p) return status('Seleccione un perfil guardado.');
    repository.setDefault(p.id);
    preferences = repository.getPreferences();
    listProfiles(p.id);
    persisted('Al abrir se cargará el perfil ' + p.name + '.');
  });
  listen($('clearDefaultProfile'), 'click', () => {
    repository.setDefault('');
    preferences = repository.getPreferences();
    listProfiles($('profileSelect').value);
    persisted('Perfil predeterminado retirado.');
  });
  listen($('storeProfile'), 'click', () => {
    const name = $('profileName').value.trim();
    if (!name) {
      $('profileName').focus();
      return status('Escriba un nombre para el perfil.');
    }
    try {
      capture();
      const p = repository.save(name, state);
      listProfiles(p.id);
      persisted('Perfil guardado: ' + p.name + '.');
    } catch (error) {
      status(error.message);
    }
  });
  listen($('profileSelect'), 'change', () => {
    const p = selectedProfile();
    if (p) $('profileName').value = p.name;
  });
  listen($('loadProfile'), 'click', () => {
    const p = selectedProfile();
    if (!p) return status('Seleccione un perfil guardado.');
    state = p.regimen;
    render();
    $('profileName').value = p.name;
    status('Perfil cargado: ' + p.name + '. Se conservaron los datos del paciente y el logo.');
    notify();
  });
  listen($('updateProfile'), 'click', () => {
    const old = selectedProfile();
    if (!old) return status('Seleccione el perfil que desea actualizar.');
    try {
      capture();
      const p = repository.save($('profileName').value.trim() || old.name, state, { id: old.id });
      listProfiles(p.id);
      persisted('Perfil actualizado: ' + p.name + '.');
    } catch (error) {
      status(error.message);
    }
  });
  listen($('deleteProfile'), 'click', () => {
    const p = selectedProfile();
    if (!p) return;
    repository.remove(p.id);
    preferences = repository.getPreferences();
    listProfiles();
    $('profileName').value = '';
    persisted('Perfil eliminado: ' + p.name + '. La pauta actual se conserva.');
  });
  listen($('exportProfiles'), 'click', () =>
    downloadText(
      repository.export(),
      'Perfiles_Insulina_HHR.json',
      'application/json;charset=utf-8',
      doc,
    ),
  );
  listen($('importProfiles'), 'change', async () => {
    const input = $('importProfiles'),
      file = input.files[0];
    if (!file) return;
    try {
      if (file.size > LIMITS.maxImportBytes) throw new Error('El archivo supera 2 MB.');
      const count = repository.import(await file.text());
      preferences = repository.getPreferences();
      listProfiles();
      persisted(count + ' perfiles importados. La pauta actual se conserva.');
    } catch (error) {
      status(error.message);
    }
    input.value = '';
  });
  listProfiles();
  applyPaper();
  const preferred = repository.get(preferences.defaultId);
  if (preferred) {
    state = preferred.regimen;
    $('profileName').value = preferred.name;
    listProfiles(preferred.id);
    status('Perfil predeterminado cargado: ' + preferred.name + '.');
  }

  listen($('logoUpload'), 'change', () => {
    const file = $('logoUpload').files[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 8 * 1024 * 1024) {
      $('status').textContent = 'Seleccione un logo PNG, JPG o WEBP de hasta 8 MB.';
      return;
    }
    const reader = new win.FileReader();
    reader.onload = () => {
      $('logoImage').src = String(reader.result);
      $('status').textContent = 'Logo actualizado. Se incluirá al imprimir y guardar el HTML.';
    };
    reader.readAsDataURL(file);
  });

  function schemeParagraph() {
    capture();
    return formatRegimenParagraph(state);
  }
  listen($('copyTextBtn'), 'click', async () => {
    const text = schemeParagraph();
    $('schemeText').value = text;
    try {
      if (!win.navigator.clipboard?.writeText) throw new Error();
      await win.navigator.clipboard.writeText(text);
      status('Esquema copiado en un solo párrafo.');
    } catch {
      $('textExport').open = true;
      $('schemeText').focus();
      $('schemeText').select();
      status('Texto generado y seleccionado. Copie con ⌘C o Ctrl+C.');
    }
  });
  listen($('textExport'), 'toggle', () => {
    if ($('textExport').open) $('schemeText').value = schemeParagraph();
  });
  listen(win, 'beforeprint', () => {
    capture();
    titles();
    mirrors();
    const sheet = $('printSheet');
    sheet.style.setProperty('--print-scale', '1');
    if (win.matchMedia('print').matches) {
      applyPaper();
      sheet.style.setProperty(
        '--print-scale',
        String(getPrintScale(sheet.getBoundingClientRect().height, preferences.paperSize)),
      );
    }
  });
  listen(win, 'afterprint', () => $('printSheet').style.removeProperty('--print-scale'));
  listen(win, 'resize', () => root.querySelectorAll('textarea.editable').forEach(resize));
  listen($('printBtn'), 'click', () => {
    capture();
    mirrors();
    win.print();
  });
  listen($('saveBtn'), 'click', async () => {
    try {
      const html = await exportHtml();
      const name = ($('paciente').value || 'Paciente')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9_-]+/g, '_')
        .slice(0, 50);
      downloadText(html, 'Esquema_Insulina_' + name + '.html', 'text/html;charset=utf-8', doc);
      status('Archivo editable descargado con pautas, perfiles y preferencias.');
    } catch (error) {
      status(error.message);
    }
  });

  async function exportHtml() {
    capture();
    const bundle = await options.getPortableBundle?.();
    if (!bundle)
      throw new Error(
        'Para guardar un HTML autónomo, abra la versión autónoma o configure getPortableBundle.',
      );
    return createStandaloneDocument({
      doc,
      template: TEMPLATE,
      styles: STYLES,
      bundle,
      regimen: normalizeRegimen(state),
      profiles: repository.list(),
      preferences: repository.getPreferences(),
      identity: {
        paciente: $('paciente').value,
        rut: $('rut').value,
        fecha: $('fecha').value,
        prescriber: $('prescriber').value,
      },
      logo: $('logoImage').src,
      brand: {
        hospitalName: root.querySelector('.hospital-name').textContent,
        hospitalSubtitle: root.querySelector('.hospital-sub').textContent,
      },
    });
  }
  listen(root, 'input', () => {
    capture();
    if ($('textExport').open) $('schemeText').value = formatRegimenParagraph(state);
    notify();
  });
  listen(root, 'change', () => {
    capture();
    notify();
  });
  listen(root, 'click', () =>
    win.queueMicrotask(() => {
      if (!abort.signal.aborted) {
        capture();
        notify();
      }
    }),
  );
  render();
  return {
    getRegimen() {
      capture();
      return normalizeRegimen(state);
    },
    setRegimen(value) {
      state = normalizeRegimen(value);
      render();
      notify();
    },
    getText: schemeParagraph,
    getProfiles: () => repository.list(),
    exportProfiles: () => repository.export(),
    importProfiles(json) {
      const n = repository.import(json);
      preferences = repository.getPreferences();
      listProfiles();
      return n;
    },
    exportHtml,
    destroy() {
      abort.abort();
      root.replaceChildren();
      root.classList.remove('hhr-insulin');
    },
  };
}
