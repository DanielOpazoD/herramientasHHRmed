/** Prevent JSON data and bundle source from terminating an inline script element. */
export function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
export function createStandaloneDocument({
  doc,
  template,
  styles,
  bundle,
  regimen,
  profiles,
  preferences,
  identity = {},
  logo,
  brand = {},
}) {
  const container = doc.createElement('div');
  container.className = 'hhr-insulin';
  // Only the trusted application template is inserted as HTML; imported values use text/attributes.
  container.innerHTML = template;
  for (const id of ['paciente', 'rut', 'fecha', 'prescriber'])
    container.querySelector('#' + id).setAttribute('value', identity[id] ?? '');
  for (const [id, data] of Object.entries({
    savedState: regimen,
    savedProfiles: profiles,
    savedPreferences: preferences,
  }))
    container.querySelector('#' + id).textContent = safeJson(data);
  if (logo) container.querySelector('#logoImage').setAttribute('src', logo);
  if (brand.hospitalName)
    container.querySelector('.hospital-name').textContent = brand.hospitalName;
  if (brand.hospitalSubtitle)
    container.querySelector('.hospital-sub').textContent = brand.hospitalSubtitle;
  const style = doc.createElement('style');
  style.textContent = styles;
  container.prepend(style);
  const script = bundle.replace(/<\/script/gi, '<\\/script');
  return (
    '<!doctype html>\n<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Esquema de Insulinoterapia</title><style>body{margin:0}</style></head><body>' +
    container.outerHTML +
    '<script data-hhr-bundle>' +
    script +
    '</script></body></html>'
  );
}
export function downloadText(text, name, type, doc) {
  const win = doc.defaultView,
    url = win.URL.createObjectURL(new win.Blob([text], { type })),
    anchor = doc.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  win.setTimeout(() => win.URL.revokeObjectURL(url), 2000);
}
