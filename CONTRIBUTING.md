# Contribuir

1. Usa Node.js 22 o superior y ejecuta `npm ci`.
2. Modifica el paquete correspondiente; no edites `dist/` ni `styles.js` manualmente.
3. Ejecuta `npm run test`, `npm run test:types`, `npm run build` y `npm run format`.
4. Instala Chromium con `npx playwright install chromium` y ejecuta `npm run test:e2e`.
5. Revisa el formato con `npm run format:check` y confirma que los archivos de `dist/` reflejen el código fuente.

Los cambios de dosis, rangos o unidades no deben mezclarse con cambios de arquitectura. Deben indicar su fuente y conservar pruebas de las tablas completas. Los cambios de almacenamiento deben probar importación inválida, pérdida de disponibilidad del almacenamiento, perfil predeterminado y eliminación de perfiles.

Para un nuevo módulo, crea un paquete propio bajo `packages/`; separa datos y lógica de DOM, almacenamiento y red. Expón contratos TypeScript y un ejemplo de consumo independiente. Evita dependencias de ejecución cuando la plataforma cubra la necesidad.

No agregues exportaciones de pacientes, archivos de pruebas del entorno local, secretos ni rutas personales al repositorio.
