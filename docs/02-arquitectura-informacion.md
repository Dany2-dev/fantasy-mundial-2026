# Criterio 2a — Arquitectura de Información (con Wireframes: 20%)

## 1. Sitemap

```
Fantasy Mundial 2026
├── Acceso (público)
│   ├── Iniciar sesión (email o Google)
│   └── Crear cuenta
└── App (autenticado)
    ├── Inicio (dashboard)
    │   ├── Resumen: presupuesto de la liga, liga activa, posición
    │   ├── Tu mejor carta
    │   └── Accesos rápidos (sobre pendiente, once incompleto)
    ├── Mi Once
    │   ├── Cancha con formación (4-4-2, 4-3-3, 3-5-2)
    │   ├── Selector de jugadores por posición
    │   └── Capitán (x2 puntos)
    ├── Mercado
    │   ├── Agentes libres (lote de 12, se renueva cada 24 h)
    │   ├── Clausulazo (cartas de otros mánagers de la liga)
    │   ├── Ventas (publicaciones a precio fijo)
    │   └── Intercambios recibidos / enviados
    ├── Sobres
    │   ├── Tienda (Bronce / Plata / Oro / Legendario)
    │   └── Apertura (reveal de cartas)
    ├── Colección
    │   ├── Grid de cartas (filtros: posición, país, rareza)
    │   └── Detalle de carta (cláusula, venta, estadísticas por jornada)
    ├── Ligas
    │   ├── Mis ligas (selector de liga activa)
    │   ├── Crear liga → código de invitación
    │   ├── Unirse con código
    │   └── Clasificación (puntos, cartas, valor de plantilla, patrimonio)
    ├── Partidos (calendario y resultados reales de la competencia)
    ├── Rivales (plantillas del resto de mánagers)
    ├── Historial (jornadas cerradas y puntos)
    ├── Jugar (hub de minijuegos)
    └── Tu Leyenda (simulador de carrera)
        ├── Identidad (nombre, dorsal, país, puesto)
        ├── Carrera (tramos de 2 años, 16 → 38)
        └── Resumen (palmarés por club)
```

## 2. User Flows críticos

### Flujo A — Onboarding completo (registro → primer sobre)
1. Landing → **[Crear cuenta]** (o **[Entrar con Google]**, que salta el formulario)
2. Formulario: nombre, email, contraseña (3 campos) → submit
3. Redirige a **Inicio**
4. Estado vacío: "Aún no estás en una liga" → **[Crear liga]** o **[Tengo un código]**
5. Crear liga: elegir competencia y nombre → sistema genera código de 6 caracteres
   → pantalla "comparte este código". Al entrar a una liga se otorgan **€50M de
   presupuesto en ella** (el dinero es por liga, no global)
6. CTA "Abre tu primer sobre" → **Sobres** → elige Bronce (€8M) → confirmación
7. Reveal: 3 cartas volteándose una a una (la de mayor rating al final) → **[Ver colección]**

### Flujo B — Armar el once
1. **Mi Once** → cancha vacía con siluetas por posición según formación
2. Tap en silueta → sheet inferior con cartas de la colección filtradas por esa posición
3. Selecciona carta → ocupa el slot → repite
4. Tap prolongado / botón en carta → asignar capitán (badge ©)
5. **[Guardar once]** → toast de confirmación

### Flujo C — Intercambio entre mánagers
1. **Mercado → Clausulazo** → grid de cartas de otros mánagers → tap en carta deseada
2. Modal: elegir carta propia a ofrecer + euros adicionales (opcional)
3. **[Enviar oferta]** → estado "pendiente" en pestaña Enviadas
4. El otro mánager ve la oferta en Recibidas → **[Aceptar]** / **[Rechazar]**
5. Al aceptar: swap de cartas + transferencia del dinero + notificación a ambos

### Flujo D — Fichar un agente libre
1. **Mercado → Agentes libres** → lote de 12 jugadores sin dueño en la liga,
   con contador de "próximo mercado en …"
2. Tap en una carta → detalle; o directamente **[Fichar · €X]**
3. El importe sale del presupuesto de esa liga y la carta pasa a tu colección
   con 7 días de protección ante clausulazos
4. El lote se renueva entero cada 24 h

## 3. Modelo de navegación

- **Móvil:** barra inferior con 5 destinos (Inicio, Mi Once, Mercado, Sobres,
  Colección) + hoja "Más" con el resto.
- **Escritorio:** riel lateral fijo que se expande al pasar el cursor.
- El orden responde al **uso diario**: primero armar y mover el equipo (Mi Once,
  Mercado), luego conseguir cartas (Sobres, Colección) y al final lo de consulta
  (Ligas, Partidos, Rivales, Historial). Un separador marca ese corte.
- Selector de **liga activa** siempre visible en el header, junto al presupuesto
  de esa liga (las cartas y el mercado dependen de la liga).
- Profundidad máxima: 3 niveles (regla de los 3 taps para cualquier tarea crítica).
