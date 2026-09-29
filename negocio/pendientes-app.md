# Pendientes / bitácora de la app (Inda Studio · luffy-app)

Este archivo documenta trabajo cerrado y pendiente sobre la app, para que cualquier
sesión de Claude (o persona) que retome el proyecto tenga contexto sin tener que
releer todo el código. Se actualiza a medida que se cierra cada cosa.

> Nota de coordinación (2026-09-29): dos sesiones de Claude distintas venían
> trabajando sobre este mismo repo en paralelo sin avisarse. A partir de ahora,
> los cambios grandes se preparan en una rama aparte y se avisan antes de
> mergear a `main`, en vez de pushear directo.

> **Excepción a esa regla (2026-09-29, tarde):** el commit "Finanzas + menú +
> visual + acumulación de fidelidad + Fase A/C (tarjetas/billetera + perfil
> `/#cuenta`)" se mergeó a `main` **sin esperar la confirmación de Central**,
> por pedido explícito de Ivo (apurado, sin tiempo de coordinar en el momento).
> Antes de mergear se verificó que `main` no tenía commits nuevos desde el
> último sync (sin conflicto), y todo el trabajo ya estaba probado con
> Playwright (ver detalle de cada fase más abajo). Si Central estaba tocando
> algo relacionado a Finanzas, el menú de Admin, las tarjetas de fidelidad o
> `/#cuenta` en simultáneo, **revisar acá primero** antes de asumir que un
> conflicto es un bug — puede ser este merge apurado pisando ese trabajo.

---

## Hecho — rama `claude/app-repository-access-pbpvxu` (sin mergear a `main` todavía, a propósito: se avisa antes)

### Acumulación de descuento de fidelidad (29/09/2026) ✅
Si el escalón de fidelidad del día pierde contra un descuento más grande, ya no se pierde:
se banca como cupón aparte (mismo mecanismo que los cupones de referidos), acumulando hasta
un tope de **30% por tarjeta**. Había un campo (`fidSobra`) que alguien dejó preparado para
esto pero nunca se conectó — quedó terminado. Código: `js/05-descuentos-cobro.js`, función
`calcCobro()`.

### Fase A — Tarjetas de fidelidad rediseñadas + billetera (29/09/2026) ✅
- Cada tarjeta tiene su propio color sólido por rubro (hash determinístico, sin necesidad
  de config nueva) + ícono de fondo, barra de progreso, sin glow.
- Si el cliente tiene más de una tarjeta (una por rubro), se comporta como billetera: la
  primera abierta, el resto en pestañas — tocar una pestaña abre esa y cierra la anterior.
  Funciona en la ficha del staff (CRM) y en `/#cuenta`.
- Código: `js/05-descuentos-cobro.js` (`htmlTarjetaCliente`, `htmlUnaTarjetaCliente`,
  `walletMostrar`, `colorDeTarjeta`, `iconoDeTarjeta`).

### Fase C — Perfil del cliente en `/#cuenta` (29/09/2026) ✅
- **Avatar**: centrado, tocable para cambiar — subir foto propia (comprimida en el
  navegador, misma técnica que los comprobantes de Finanzas) o elegir uno de 12
  "monstruitos" (emoji, v1 simple — armar avatares dibujados/generados por IA queda para
  más adelante, como pidió el usuario). Placeholder con iniciales si no eligió nada.
- **WhatsApp directo** arriba a la izquierda (usa `promos.whatsappNegocio`, ya existía).
- **FAQ**: ícono "?" abre preguntas frecuentes + botón de WhatsApp si no encuentra la
  respuesta. Nueva sección "Preguntas frecuentes" en Admin → Configuración para cargarlas
  (`promos.faq`). **No es IA respondiendo** — es una lista fija que carga el negocio; una
  versión con IA (reusando `api/chat.js`, que hoy solo la usa el staff para reels) queda
  como fase futura si se quiere.
- **Profesión editable por el cliente**: antes solo la cargaba el mostrador.
- **Antigüedad autodeclarada → credencial de veterano**: se le pregunta al cliente hace
  cuánto viene (5 opciones), el staff lo ve en la ficha del CRM con botones "Es verdad ·
  dar veterano" / "No es cierto". Si se confirma, `c.veterano=true` y se le muestra la
  credencial en su cuenta. **El descuento asociado a ser veterano todavía no está
  definido** — el usuario dijo explícitamente "después vemos eso", así que solo se
  construyó la credencial, no el descuento.
- Código: `js/17-menu-cierre.js` (`renderCuentaLogueado`, `htmlAvatarCliente`,
  `abrirElegirAvatar`, `htmlAntiguedadCuenta`, `abrirFaqCliente`, `renderAdminFaq`),
  `js/03-clientes.js` (`revisarAntiguedad`, `ANTIGUEDAD_OPCS`).

Todo lo de arriba probado con Playwright antes de subir (billetera con cambio de
pestaña, foto de avatar comprimida, monstruito, antigüedad → veterano, FAQ del admin
apareciendo en la cuenta).

### Fase D — BLOQUEADA hasta que Central confirme que está libre
Ver horarios con descuento al armar un paquete (aunque el descuento sea menor, para que
el cliente vea qué le conviene). Toca el motor compartido de "Armar Paquete" / `/#reserva`
(~600 líneas en `js/05-descuentos-cobro.js` y `js/17-menu-cierre.js`, estado global
`ventaSel`, usado también por la reserva pública sin login y por el botón "Reservar
turno" de `/#cuenta`). **No tocar sin avisar primero.**

### Prioridad 1 — Ordenar Finanzas ✅
- [x] "Cambio de efectivo" (traspaso a cuenta) ya estaba excluido del cálculo de facturación — no hacía falta arreglar la suma, solo la visibilidad: no aparecía en ningún lado. Ahora sí figura en Finanzas → Balance → "Movimientos internos", con fecha y sucursal (`js/08-caja-calendario.js`, concepto `deposito`).
- [x] "Diferencia de caja" (arqueo) ya vivía separada del balance, solo en Caja — confirmado, sin cambios.
- [x] Descuento por efectivo (10%) ya se registraba como descuento explícito (`t.descuentoTipo:'efectivo'`), compitiendo con los demás — confirmado, sin cambios.
- [x] Sucursal ahora es obligatoria al cargar un gasto: ya no queda en "Compartido" en silencio si no la tocás (`js/07-finanzas.js`, `abrirFormGasto`/`guardarGasto`).
- [x] Comisión 70% podología/cosmetología/cejas/masajes: existía solo como estimación para la ganancia de paquetes (`comisionRubroEstim`). Ahora se paga de verdad (`calcComision`, `js/09-proveedores-cuentas.js`) para quien **solo** hace esos rubros. Si un profesional mezcla esos rubros con barbería/peluquería, sigue cobrando por el tramo genérico — para resolver bien la mezcla hace falta comisión por servicio, no por facturación total de la quincena (ver Prioridad 4).
- [x] Nueva sub-pestaña "Deudas con el equipo" en Finanzas: agrupa adelantos, liquidaciones y pagos de deuda ya anotados desde Caja, por a quién se le cargó (texto libre, no está ligado al perfil real del profesional todavía — mejora posible a futuro).
- [x] Foto de comprobante obligatoria para gastos ≥ $50.000 (configurable desde la propia pantalla de Gastos → "Cambiar monto"). Se comprime en el navegador (canvas → JPEG) antes de guardar.

Probado con Playwright: bloqueo sin sucursal, bloqueo sin foto en gastos grandes, guardado ok con foto adjunta, pestaña de deudas renderiza.

### Prioridad 2 — Reordenar menú de Admin ✅
El menú ya estaba bastante ordenado (obra de la otra sesión). Cambios hechos:
- "Panel" → "Inicio" (mismo id interno).
- Nueva sección **Configuración**: Sucursales (antes en Equipo), Descuentos (antes en Clientes), Reserva pública (antes solo un botón escondido dentro del CRM).
- Dentro de Equipo, se sumó **"Piso asegurado"** como su propia sub-pestaña (antes mezclado dentro de "Comisiones"): quién tiene piso, el % asegurado, y los casos pendientes de decidir.
- **"Marca"** (que pedían agrupar en Configuración) no existe como pantalla — no hay editor de colores/logo en la app hoy. No se inventó para no meter una feature grande de prepo; queda pendiente como punto aparte si se quiere un editor de marca real.
- Todo lo demás (Catálogo, Clientes, Finanzas, Contenido) se dejó como estaba: la lista del pedido era orientativa, no una poda — sacar sub-pestañas que ya se usan hoy habría sido perder funcionalidad real sin que lo pidieran.

Probado con Playwright: se recorrieron las 8 secciones y sus 31 sub-pestañas sin errores.

### Prioridad 3 — Dirección visual más adulta (parcial)
- [x] Sacado el gradiente + glow violeta del botón central de navegación (el elemento con más "brillo" de toda la app) — ahora es color sólido con una sombra chica, no un resplandor de color.
- [x] Sacado un gradiente de texto + halo radial que tenía el número grande de "Mis puntos" — ahora es texto sólido.
- [x] Números de stats (`.sc-val`, usado en toda la app) y el `body` en general ahora usan tipografía tabular (`font-variant-numeric: tabular-nums`), sin gradientes.
- [ ] **Íconos monocromáticos en vez de emoji: NO se hizo, y es importante que quede claro por qué.** La app ya tiene un sistema de íconos SVG monocromáticos propio (`ICN`/`mi()` en `js/01-core-datos.js`) — se usa en la barra de navegación de Admin y de recepción/profesional. Pero el resto de la app (miles de líneas en los 17 archivos de `js/`) usa emoji directo adentro de los strings de HTML para casi todo (💈✂️📱🎂💳🧾 etc.), no solo como "ícono" sino mezclado con texto en cientos de lugares. Reemplazar eso por el sistema SVG existente es un trabajo grande y transversal (fácil de romper si se apura), no algo para meter de pasada en esta tanda. Quedó pendiente como una tarea aparte, more grande: armar el set de íconos que falten en `ICN` y reemplazar emoji por pantalla, una por vez, empezando por las de más uso (Inicio, Agenda, Cobro).
- Referencia pedida (Mercury/Ramp, Baxter of California/Aesop): la paleta base ya venía moviéndose para ese lado (ver comentario "Paleta Inda (ajustada 23/09/2026)" en `assets/styles.css` — negro/gris/blanco de base, violeta solo en detalles). Los cambios de esta pasada van en la misma dirección; falta la parte de íconos para que se sienta completo.

---

## Prioridad 4 (no urgente, documentada para más adelante) — Costo real por servicio

**Objetivo:** saber la ganancia neta real de cada servicio, no solo lo que factura.

**Cómo tiene que funcionar:**

1. **Receta de insumos por servicio.** Cada servicio del catálogo (ej. "Corte de
   cabello") tiene una lista de insumos que consume, con cantidad. Ejemplo:
   - 1 filo de navaja
   - 1 cuellito
   - 1 g de talco
   - 1 g de gel de afeitar

2. **Costo unitario de cada insumo** sale de Stock/Insumos (ya existe la sección
   Insumos en Catálogo — esto se apoya en esos datos, no crea un catálogo nuevo).

3. **Recalculo del costo de insumos por servicio:** se recalcula solo (automático)
   cuando cambia el precio de alguno de los insumos de su receta — no hace falta
   tocarlo a mano cada vez.

4. **Prorrateo de gastos generales:** además del costo de insumos, cada servicio
   se lleva una parte proporcional de los gastos generales del local del período
   (fijos + variables del mes), repartida **por partes iguales entre el total de
   servicios hechos en ese período** (a ajustar más adelante si hace falta un
   criterio más fino, por ejemplo por tiempo de silla en vez de por cantidad).

5. **Costo total del servicio = costo de insumos + prorrateo de gastos generales.**

6. **Margen real:**
   ```
   ganancia neta = ingreso − comisión del profesional − (costo total × cantidad)
   ```

**Dónde va:** nueva sub-sección "Costo por servicio" dentro de Finanzas en Admin
(el menú ya tiene un lugar reservado para esto: `ADMIN_SECCIONES` → `finanzas` →
sub `costos`, agregado por la otra sesión pero todavía sin implementar).

**Estado:** solo especificado acá, sin implementar. Retomar cuando se pida.

---

## Historial de cambios grandes (resumen, no exhaustivo)

- CRM de recepción: tablero kanban por franja (Activos/Turno reservado/Por
  perder/Inactivos/Perdidos/Sin visitas/Problemáticos), arrastrable con mouse y
  touch, con auto-scroll en los bordes; después migrado a pantalla completa
  (`crmboard`) en vez de modal, con más color. Vive en
  `js/06-admin-clientes-crm.js`.
- Reordenamiento del código: `index.html` (antes ~934 KB con todo adentro) se
  separó en `js/01..17-*.js` + `assets/styles.css`, y los `.sql` de Supabase se
  numeraron en `db/`.
- PWA instalable, cuenta de cliente pública (`/#cuenta`) con login de Google,
  reserva pública (`/#reserva`) con wizard por rubro.
