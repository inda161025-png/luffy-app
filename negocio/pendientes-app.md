# Pendientes / bitácora de la app (Inda Studio · luffy-app)

Este archivo documenta trabajo cerrado y pendiente sobre la app, para que cualquier
sesión de Claude (o persona) que retome el proyecto tenga contexto sin tener que
releer todo el código. Se actualiza a medida que se cierra cada cosa.

> Nota de coordinación (2026-09-29): dos sesiones de Claude distintas venían
> trabajando sobre este mismo repo en paralelo sin avisarse. A partir de ahora,
> los cambios grandes se preparan en una rama aparte y se avisan antes de
> mergear a `main`, en vez de pushear directo.

---

## En curso — rama `claude/app-repository-access-pbpvxu`

### Prioridad 1 — Ordenar Finanzas
- [ ] "Cambio de efectivo" y "Diferencia de caja" excluidos del cálculo de facturación (son movimientos internos, no ingreso/gasto).
- [ ] Descuento por efectivo (10%) registrado como descuento explícito, no como precio ya rebajado.
- [ ] Sucursal obligatoria en cada gasto (Diego Laure / French).
- [ ] Comisión 70% para podología/cosmetología/cejas/masajes cargada en la tabla de tramos.
- [ ] Sección de deudas con profesionales (monto + fecha), visible.
- [ ] Foto de comprobante obligatoria para gastos por encima de un monto configurable (default $50.000).

### Prioridad 2 — Reordenar menú de Admin
- [ ] Agrupar en: Inicio / Agenda / Clientes (CRM) / Catálogo / Equipo / Finanzas / Configuración — reusando pantallas existentes, sin inventar nuevas salvo que falten.

### Prioridad 3 — Dirección visual más adulta
- [ ] Sacar glow/brillo de los acentos violeta, color sólido.
- [ ] Íconos rellenos, monocromáticos (blanco/gris), sin multicolor.
- [ ] Tipografía tabular para números/stats, sin gradientes.
- [ ] Referencia: fintech dark-mode serio (Mercury, Ramp) / grooming premium (Baxter of California, Aesop).

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
