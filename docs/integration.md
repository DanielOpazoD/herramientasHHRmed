# Integración en otros programas

## Elegir la capa

Si el programa ya tiene su interfaz, importa únicamente `@hhr/insulin-core`: usa las factorías y validaciones para sus formularios, `ProfileRepository` para las plantillas y `formatRegimenParagraph` para la evolución o epicrisis. No necesita CSS, DOM, acceso al portapapeles ni un framework específico.

Si se desea reutilizar el editor completo, importa `mountInsulinPlanner`. El módulo fuente utiliza `@hhr/insulin-core`; un empaquetador resuelve la dependencia workspace. Sin empaquetador, usa `dist/insulin-planner.js`, que contiene su dependencia, o el import map del ejemplo.

## Consumo por archivos locales

Tras `npm ci && npm run build`, copia los dos bundles ESM de `dist/` al programa anfitrión o instala los paquetes desde rutas locales. Mantén las versiones de ambos paquetes juntas. Para un programa Node.js solo hace falta `dist/insulin-core.js`.

```js
import { createInitialRegimen, formatRegimenParagraph } from './vendor/insulin-core.js';
```

## React

La interfaz es independiente de React; se monta y desmonta con su ciclo de vida.

```jsx
import { useEffect, useRef } from 'react';
import { mountInsulinPlanner } from './vendor/insulin-planner.js';

export function Insulinoterapia() {
  const root = useRef(null);
  useEffect(() => {
    const planner = mountInsulinPlanner(root.current, {
      storageNamespace: 'mi-app-insulina-v1',
    });
    return () => planner.destroy();
  }, []);
  return <div ref={root} />;
}
```

Para Vue o un enrutador propio, aplica el mismo patrón al montar y desmontar la vista. No invoques `setRegimen` dentro de un receptor de `hhr:change` sin comparar el estado: produciría un bucle de actualizaciones.

## Exportación autónoma

El archivo exportado debe seguir funcionando sin los archivos de la aplicación anfitriona. Por eso la descarga utiliza el bundle autónomo completo, no una copia del DOM del anfitrión. Solo exporta el editor, sus datos y su marca institucional. Se escapan los datos JSON y los atributos escritos por el usuario.

```js
const response = await fetch('/vendor/insulinoterapia.html');
const portable = new DOMParser().parseFromString(await response.text(), 'text/html');
const bundle = portable.querySelector('script[data-hhr-bundle]').textContent;
const planner = mountInsulinPlanner(root, { getPortableBundle: () => bundle });
```

Esta petición se hace a un recurso de la propia aplicación. La versión HTML autónoma no realiza ninguna petición de red.

## Persistencia externa

`StorageAdapter` es síncrono, compatible con `localStorage`. Para IndexedDB, una API HTTP o un backend, carga un snapshot en memoria y sincroniza explícitamente desde el anfitrión; no presentes una escritura asíncrona pendiente como una escritura ya completada. No se incluye sincronización, autenticación ni modificación del censo HHR.

Cada aplicación debe decidir su `storageNamespace` para compartir o aislar las bibliotecas. El espacio predeterminado conserva la compatibilidad con los HTML anteriores.
