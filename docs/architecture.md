# Arquitectura

## Capas

```text
Aplicación anfitriona / HTML autónomo
                 │
        @hhr/insulin-planner
     DOM · estilos · descarga · impresión
                 │
         @hhr/insulin-core
  catálogo · pautas · esquema · texto · perfiles
                 │
      StorageAdapter opcional
    localStorage / memoria / adaptador propio
```

El núcleo no importa la interfaz, no consulta el navegador y no realiza peticiones de red. Cada función de formato recibe un esquema y devuelve texto. Las factorías devuelven objetos independientes para impedir que editar una pauta modifique otra.

## Organización

- `packages/insulin-core/src/catalog.js`: IDs estables, nombres y metadatos de medicamentos.
- `presets.js`: transcripciones iniciales y factorías de perfiles vacíos.
- `schema.js`: validación estructural, límites de importación y normalización por lista de campos permitidos.
- `text.js`: redacción de un párrafo a partir de las secciones activas.
- `profiles.js`: repositorio independiente del almacenamiento concreto.
- `paper.js`: medidas de Carta/A4, CSS de página y factor de ajuste.
- `packages/insulin-planner/src/index.js`: ciclo de vida del editor y eventos de la interfaz.
- `template.js`, `styles.css`: presentación. `styles.js` se genera al compilar y permite importar el editor directamente como ESM.
- `portable.js`: exportación autocontenida y escape de datos serializados.
- `standalone.js`: arranque de la distribución sin instalación.
- `scripts/build.mjs`: bundles reproducibles con esbuild; no interviene en los datos clínicos.

## Contratos y compatibilidad

La estructura pública está declarada en `index.d.ts` de cada paquete. Cambiar un ID de medicamento o el formato de un perfil requiere migración explícita y una prueba. No se cambian unidades ni dosis durante una migración.

`normalizeRegimen` valida y copia solamente los campos conocidos. La identidad del paciente vive en el formulario, fuera de los perfiles reutilizables. Una nota libre es texto escrito por el usuario y no se anonimiza automáticamente.

Las importaciones se validan por completo antes de modificar la biblioteca. Los perfiles borrados dejan una marca local para que una copia antigua del HTML no los restaure accidentalmente. Una importación explícita sí puede restaurarlos.

## Persistencia

`ProfileRepository` acepta un objeto con `getItem` y `setItem`. Si el almacenamiento falla, conserva la sesión en memoria y permite exportarla; `persistent` informa si la última escritura se completó. Las claves heredadas se conservan para no perder las pautas ya creadas.

La escritura de tres claves de `localStorage` no constituye una transacción de base de datos. Un anfitrión que necesite escrituras atómicas o sincronización debe suministrar su propio almacenamiento o usar la API del núcleo con su capa de persistencia.

## Interfaz y ciclo de vida

El editor usa elementos HTML nativos y CSS bajo `.hhr-insulin`. `destroy()` retira los eventos globales y limpia el contenedor. El núcleo puede utilizarse en múltiples contextos independientes; la interfaz actual admite un editor por documento, por sus IDs de formulario y porque `@page` y la impresión son propiedades del documento. Para dos editores simultáneos, usa documentos/iframes separados o una interfaz propia sobre el núcleo.

## Impresión

La impresión considera las medidas reales del papel y sus márgenes. Se mide la hoja con los estilos de impresión y se reduce proporcionalmente cuando es necesario. No se cortan filas para cumplir el límite de una hoja. Muchas filas o notas muy largas pueden reducir la tipografía; el usuario debe revisar la vista previa. La aplicación anfitriona debe colocar el editor en una vista dedicada a impresión o definir su propia estrategia para ocultar el resto de su interfaz.
