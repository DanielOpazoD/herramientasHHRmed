import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
function pdfPages(buffer) {
  return (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
}
function observe(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

test('ESM editor loads, preserves the original doses, and hides basal', async ({ page }) => {
  const errors = observe(page);
  await page.goto('/');
  await expect(page).toHaveTitle(/Insulinoterapia/);
  await expect(page.locator('h1')).toHaveText('Esquema de Insulinoterapia');
  expect(
    await page.locator('.editable.meal-dose').evaluateAll((els) => els.map((e) => e.value)),
  ).toEqual(['4 UI', '4 UI', '2 UI', '4 UI']);
  await expect(page.locator('#basalPanel')).toBeHidden();
  expect(errors).toEqual([]);
});

test('basal is first, NPH labels are AM and 22–23, and frequency preserves doses', async ({
  page,
}) => {
  await page.goto('/');
  await page.selectOption('#basalSelect', 'nph');
  await page.selectOption('#basalFrequency', '2');
  await expect(page.locator('.editable.basal-time').first()).toHaveValue('AM');
  await expect(page.locator('.editable.basal-time').nth(1)).toHaveValue('22:00–23:00');
  await page.locator('.editable.basal-dose').nth(1).fill('6 UI');
  await page.selectOption('#basalFrequency', '1');
  await expect(page.locator('#basalRows tr')).toHaveCount(1);
  await page.selectOption('#basalFrequency', '2');
  await expect(page.locator('.editable.basal-dose').nth(1)).toHaveValue('6 UI');
  expect(await page.locator('.panel').first().getAttribute('id')).toBe('basalPanel');
});

test('profiles and their default persist, including the updated saved dose', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#basalSelect', 'nph');
  await page.locator('.editable.basal-dose').first().fill('12 UI');
  await page.locator('#profileName').fill('Perfil sintético');
  await page.locator('#storeProfile').click();
  await page.locator('#setDefaultProfile').click();
  await page.locator('.editable.basal-dose').first().fill('14 UI');
  await page.locator('#updateProfile').click();
  await page.reload();
  await expect(page.locator('#basalSelect')).toHaveValue('nph');
  await expect(page.locator('.editable.basal-dose').first()).toHaveValue('14 UI');
  await expect(page.locator('#profileSelect option:checked')).toContainText('Predeterminado');
});

test('clipboard text is one paragraph, names only, and excludes inactive sections', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copied = text;
        },
      },
    }),
  );
  await page.selectOption('#basalSelect', 'nph');
  await page.selectOption('#basalFrequency', '2');
  await page.locator('.editable.basal-dose').first().fill('12');
  await page.locator('.editable.basal-dose').nth(1).fill('6');
  await page.locator('#copyTextBtn').click();
  let text = await page.evaluate(() => window.copied);
  expect(text).toContain('AM: 12 UI; 22:00–23:00: 6 UI');
  expect(text).not.toMatch(/[\r\n]|U-100|UI\/mL/);
  await page.locator('#showFixed').uncheck();
  await page.locator('#showCorrection').uncheck();
  await page.locator('#copyTextBtn').click();
  text = await page.evaluate(() => window.copied);
  expect(text).not.toContain('Dosis fija');
  expect(text).not.toContain('HGT');
});

test('correction mode, row deletions and per-insulin edits are independent', async ({ page }) => {
  await page.goto('/');
  await page.locator('.editable.meal-dose').first().fill('6 UI');
  await page.selectOption('#rapidSelect', 'novorapid');
  await expect(page.locator('.editable.meal-dose').first()).toHaveValue('');
  await page.selectOption('#rapidSelect', 'apidra');
  await expect(page.locator('.editable.meal-dose').first()).toHaveValue('6 UI');
  await page.locator('#sensitivityToggle').check();
  await page.selectOption('#sensitivityView', '1');
  await expect(page.locator('#sensitivityRows tr')).toHaveCount(8);
  await page.getByRole('button', { name: 'Eliminar fila de sensibilidad 3', exact: true }).click();
  await expect(page.locator('#sensitivityRows tr')).toHaveCount(7);
  await page.locator('#sensitivityToggle').uncheck();
  await expect(page.locator('#correctionRows tr')).toHaveCount(7);
});

test('portable saved HTML preserves profiles, default, identity and runs offline', async ({
  page,
  browser,
}, testInfo) => {
  await page.goto('/');
  await page.selectOption('#basalSelect', 'nph');
  await page.locator('.editable.basal-dose').first().fill('12 UI');
  await page.locator('#profileName').fill('Portable');
  await page.locator('#storeProfile').click();
  await page.locator('#setDefaultProfile').click();
  await page.locator('#paciente').fill('Paciente sintético');
  await page.locator('#patientNote').fill('</script><script>window.INJECTED=true</script>');
  await page.locator('#updateProfile').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#saveBtn').click();
  const download = await downloadPromise,
    path = testInfo.outputPath('portable.html');
  await download.saveAs(path);
  const context = await browser.newContext({ offline: true }),
    p = await context.newPage(),
    errors = observe(p);
  await p.goto(pathToFileURL(path).href);
  await expect(p.locator('#paciente')).toHaveValue('Paciente sintético');
  await expect(p.locator('#patientNote')).toHaveValue(
    '</script><script>window.INJECTED=true</script>',
  );
  expect(await p.evaluate(() => window.INJECTED)).toBeUndefined();
  await expect(p.locator('.editable.basal-dose').first()).toHaveValue('12 UI');
  await expect(p.locator('#profileSelect option:checked')).toContainText('Predeterminado');
  expect(errors).toEqual([]);
  await context.close();
});

test('invalid imports preserve the active library and text is never interpreted as HTML', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await page.locator('#profileName').fill('Conservar');
  await page.locator('#storeProfile').click();
  const file = testInfo.outputPath('invalid.json');
  await writeFile(
    file,
    JSON.stringify({ format: 'hhr-insulin-profiles', version: 1, profiles: [{ id: 'bad' }] }),
  );
  await page.locator('#importProfiles').setInputFiles(file);
  await expect(page.locator('#status')).toContainText('inválido');
  await expect(page.locator('#profileSelect option')).toHaveCount(2);
  await page.locator('#patientNote').fill('</script><script>window.INJECTED=true</script>');
  expect(await page.evaluate(() => window.INJECTED)).toBeUndefined();
});

test('full layouts and added rows fit one page in A4 and Carta', async ({ page }) => {
  await page.goto('/');
  await page.selectOption('#basalSelect', 'nph');
  await page.selectOption('#basalFrequency', '2');
  await page.locator('#sensitivityToggle').check();
  for (let i = 0; i < 10; i++) await page.locator('[data-add="correction"]').click();
  for (const size of ['A4', 'Letter']) {
    await page.emulateMedia({ media: 'screen' });
    await page.selectOption('#paperSize', size);
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    expect(pdfPages(pdf)).toBe(1);
    if (size === 'Letter') expect(pdf.toString('latin1')).toMatch(/612\s+792/);
  }
});

test('bundled editor opens offline, mobile does not overflow, and print hides controls', async ({
  page,
}) => {
  const errors = observe(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dist/insulinoterapia.html');
  await page.context().setOffline(true);
  await page.selectOption('#basalSelect', 'nph');
  await page.locator('#sensitivityToggle').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#storeProfile')).toBeHidden();
  await expect(page.locator('.hide-panel').first()).toBeHidden();
  expect(errors).toEqual([]);
});

test('host API isolates clinical state, and destroy permits remounting', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { mountInsulinPlanner } = await import('/dist/insulin-planner.js');
    // Replace the view as a host router would; use a separate frame for an independent document.
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const doc = frame.contentDocument,
      root = doc.createElement('div');
    doc.body.append(root);
    const app = mountInsulinPlanner(root, { storage: null }),
      snapshot = app.getRegimen();
    snapshot.rapidProfiles.apidra.fixed[0] = '7 UI';
    app.setRegimen(snapshot);
    const text = app.getText();
    app.destroy();
    const cleared = root.childElementCount === 0;
    const again = mountInsulinPlanner(root, { storage: null });
    const initial = again.getRegimen().rapidProfiles.apidra.fixed[0];
    again.destroy();
    frame.remove();
    return { text, cleared, initial };
  });
  expect(result.text).toContain('Desayuno: 7 UI');
  expect(result.cleared).toBe(true);
  expect(result.initial).toBe('4 UI');
});
