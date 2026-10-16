# API pública

Las definiciones completas se encuentran en los archivos `src/index.d.ts` de cada paquete.

## Núcleo

| API                                  | Entrada / resultado                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `createInitialRegimen()`             | Plantilla Apidra original; basal oculta                                                                         |
| `createBlankRapidProfile()`          | Comidas y rangos editables sin dosis asignadas                                                                  |
| `createBasalProfile(id)`             | Dosis vacías, AM y horario nocturno inicial                                                                     |
| `createSensitivityPreset()`          | Tabla independiente de tres sensibilidades                                                                      |
| `isValidRegimen(value)`              | Validación estructural booleana                                                                                 |
| `normalizeRegimen(value)`            | Copia validada, migra campos opcionales antiguos y omite campos desconocidos; lanza `TypeError` si no es válido |
| `formatRegimenParagraph(regimen)`    | Un párrafo sin saltos de línea; solo cuadros activos                                                            |
| `getCurrentNote(regimen)`            | Nota correspondiente al modo y cuadros visibles                                                                 |
| `decodeProfileFile(json)`            | Decodifica exportaciones v1, comprueba tamaño y estructura                                                      |
| `getPaperSettings('A4' \| 'Letter')` | Medidas físicas y área imprimible en mm                                                                         |
| `getPrintScale(heightPx, size)`      | Factor entre 0 y 1 para una hoja                                                                                |

Un esquema contiene `rapid`, `basal`, `rapidProfiles`, `basalProfiles`, `showCorrection`, `showFixed` y `showBasal`. Los perfiles rápidos guardan rangos, indicaciones, comidas, dosis fijas y una pauta de sensibilidad independiente. La frecuencia basal admite `'1'`, `'2'` o `'custom'`.

Los valores de dosis e indicaciones son **cadenas** para preservar exactamente textos como `+1 UI`, `Omitir la dosis precomidas y avisar` o una pauta individualizada. No se interpretan como instrucciones de un motor de dosificación. Un número solo se acompaña con `UI` al formatear porque esa es la unidad del encabezado de la tabla.

## Repositorio de perfiles

```js
const repository = new ProfileRepository({
  storage: localStorage, // Opcional; null conserva solo memoria
  namespace: 'mi-aplicacion-insulina',
  seed: [], // Biblioteca de un HTML portátil
  preferences: null, // Preferencias de esa copia
});

const perfil = repository.save('Mi pauta', regimen);
repository.save('Mi pauta revisada', otroRegimen, { id: perfil.id });
repository.setDefault(perfil.id);
repository.setPaperSize('Letter');
const alAbrir = repository.initialRegimen();
const archivo = repository.export();
repository.import(archivo);
repository.remove(perfil.id);
```

`list()`, `get(id)`, `getPreferences()` e `initialRegimen()` entregan copias independientes. Los IDs se conservan al actualizar. `clock` y `createId` son inyectables para pruebas y aplicaciones que gestionen sus propios identificadores. `persistent` indica el resultado de la última escritura.

## Interfaz

```js
const handle = mountInsulinPlanner(root, {
  initialRegimen: regimen,
  storage: localStorage,
  storageNamespace: 'mi-programa-insulina-v1',
  brand: {
    hospitalName: 'Mi institución',
    hospitalSubtitle: 'Mi servicio',
    logoSrc: 'data:image/png;base64,...',
  },
  identity: { paciente: '', rut: '', fecha: '', prescriber: '' },
  getPortableBundle: async () => codigoDelBundleAutonomo,
});
```

Métodos: `getRegimen()`, `setRegimen(value)`, `getText()`, `getProfiles()`, `exportProfiles()`, `importProfiles(json)`, `exportHtml()` y `destroy()`.

Al modificar la pauta, el contenedor emite `hhr:change` con `{ regimen }` en `event.detail`. La identidad se conserva en el formulario al cambiar de perfil y no forma parte del evento del esquema.

`getPortableBundle` debe devolver el código del script `data-hhr-bundle` de `dist/insulinoterapia.html`. Es necesario para `exportHtml()` y para el botón de guardar una copia autónoma. El ejemplo embebido muestra cómo obtenerlo una vez desde la distribución.
