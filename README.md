# Herramientas HHR Med

Módulos reutilizables para construir herramientas clínicas locales. El primer módulo es el **esquema de insulinoterapia** del Hospital Hanga Roa.

La aplicación permite editar insulina basal, dosis fijas y correcciones por HGT; guardar perfiles con nombre y uno predeterminado; copiar el esquema en un párrafo; e imprimir en Carta o A4 con ajuste a una hoja. Funciona sin servidor ni conexión cuando se abre la versión autónoma.

## Uso inmediato

Descarga [dist/insulinoterapia.html](dist/insulinoterapia.html) y ábrelo en un navegador. El archivo contiene el programa y el logo, sin recursos remotos. Para conservar los datos y perfiles en otra copia, usa **Guardar HTML editable**. Para mover solamente las pautas, usa **Exportar perfiles**.

Los perfiles se guardan en el navegador, no se sincronizan entre equipos. No contienen los campos de nombre, RUT, fecha ni profesional del formulario. Los campos de texto libre conservan lo que escribe el usuario.

## Desarrollo

Requiere Node.js 22 o superior y npm.

```sh
npm ci
npm run build
npm run dev
```

Abre [http://127.0.0.1:4173](http://127.0.0.1:4173). `index.html` usa los módulos de origen; `dist/insulinoterapia.html` es la distribución autónoma. No edites `dist/` a mano: se genera desde los paquetes.

```sh
npm run test             # Pruebas del núcleo, sin navegador
npm run test:types       # Contratos públicos para consumidores TypeScript
npm run format:check
npm run build
npx playwright install chromium
npm run test:e2e         # Interfaz, almacenamiento, exportación e impresión
```

## Reutilizar en otro programa

| Paquete                | Responsabilidad                                                    | Dependencias de ejecución |
| ---------------------- | ------------------------------------------------------------------ | ------------------------- |
| `@hhr/insulin-core`    | Datos, validación, perfiles, párrafo clínico y geometría del papel | Ninguna; no usa DOM       |
| `@hhr/insulin-planner` | Editor web embebible, portapapeles, descarga e impresión           | `@hhr/insulin-core`       |

Los paquetes son privados para evitar una publicación accidental en npm. Se pueden consumir desde este workspace, por ruta local o desde los bundles ESM en `dist/`. No es necesario adoptar un framework.

### Solo datos y texto

```js
import {
  createInitialRegimen,
  formatRegimenParagraph,
  ProfileRepository,
  createMemoryStorage,
} from '@hhr/insulin-core';

const regimen = createInitialRegimen();
const repository = new ProfileRepository({ storage: createMemoryStorage() });
const profile = repository.save('Mi plantilla', regimen);
repository.setDefault(profile.id);
console.log(formatRegimenParagraph(repository.initialRegimen()));
```

También puedes importar `dist/insulin-core.js` directamente en Node.js o un navegador. Ver [ejemplo de Node](examples/node-summary.mjs).

### Editor embebido

```js
import { mountInsulinPlanner } from './dist/insulin-planner.js';

const planner = mountInsulinPlanner(document.querySelector('#editor'), {
  storageNamespace: 'mi-programa-insulina-v1',
});

const regimen = planner.getRegimen();
const texto = planner.getText();
// Al desmontar una vista o componente:
planner.destroy();
```

El guardado de un HTML completo necesita además `getPortableBundle`; el [ejemplo embebido](examples/embed.html) muestra esa configuración. La integración en React, Vue u otros programas se explica en [docs/integration.md](docs/integration.md).

## Documentación

- [Arquitectura y límites de cada capa](docs/architecture.md)
- [API pública y esquema de datos](docs/api.md)
- [Integración en otras aplicaciones](docs/integration.md)
- [Compatibilidad y migración de perfiles anteriores](docs/migration.md)
- [Origen de las pautas y decisiones de presentación](docs/clinical-data.md)
- [Contribuir y validar cambios](CONTRIBUTING.md)

Los números de las pautas son transcripciones del material proporcionado para este proyecto. El programa organiza y formatea esas indicaciones; no calcula ni recomienda dosis. Los identificadores y concentraciones se conservan internamente y no se convierten al cambiar la presentación del nombre.
