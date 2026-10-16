# Migración y compatibilidad

El editor mantiene el formato JSON `hhr-insulin-profiles`, versión `1`, y las claves existentes:

- `hhr-insulin-profiles-v1`: biblioteca de perfiles.
- Sufijo `-preferences`: perfil predeterminado y papel.
- Sufijo `-removed`: marcas de eliminación.

Los IDs como `apidra`, `glargine100`, `glargine300` o `humalog200` no se renombraron. Las concentraciones permanecen en el catálogo y los identificadores aunque el párrafo exportado muestre solamente el nombre. No hay conversiones de dosis.

Los campos opcionales ausentes en los perfiles antiguos se completan al normalizar: tabla de sensibilidad, modo, frecuencia y visibilidad basal. Los horarios y dosis escritos se conservan. AM y 22:00–23:00 para NPH son valores iniciales para perfiles basales **nuevos**, no una modificación de las pautas ya guardadas.

Para mover los perfiles de un HTML anterior a esta versión:

1. Abre el archivo anterior y exporta sus perfiles.
2. Abre la nueva versión e importa el archivo JSON.
3. Revisa el perfil seleccionado y, si corresponde, márcalo como predeterminado.
4. Guarda una copia del nuevo HTML para llevar la biblioteca a otro equipo.

El navegador puede aislar el almacenamiento de cada archivo `file://`; no se depende de que dos archivos distintos compartan `localStorage`. La importación y la copia autónoma son las rutas portables.

Las versiones desconocidas se rechazan antes de cambiar la biblioteca. Una evolución futura del esquema debe incorporar una migración explícita y pruebas de no modificación de dosis.
