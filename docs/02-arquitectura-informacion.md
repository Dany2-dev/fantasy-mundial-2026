# Criterio 2a — Arquitectura de Información (con Wireframes: 20%)

## 1. Sitemap

```
Fantasy Mundial 2026
├── Acceso (público)
│   ├── Iniciar sesión
│   └── Crear cuenta
└── App (autenticado)
    ├── Inicio (dashboard)
    │   ├── Resumen: monedas, liga activa, posición
    │   ├── Tu mejor carta
    │   └── Accesos rápidos (sobre pendiente, once incompleto)
    ├── Sobres
    │   ├── Tienda (Bronce / Plata / Oro)
    │   └── Apertura (reveal de cartas)
    ├── Colección
    │   ├── Grid de cartas (filtros: posición, país, rareza)
    │   └── Detalle de carta
    ├── Mi Once
    │   ├── Cancha con formación (4-4-2, 4-3-3, 3-5-2)
    │   ├── Selector de jugadores por posición
    │   └── Capitán (x2 puntos)
    ├── Mercado
    │   ├── Cartas de otros mánagers de la liga
    │   ├── Proponer intercambio (carta + monedas)
    │   └── Ofertas recibidas / enviadas
    └── Ligas
        ├── Mis ligas (selector de liga activa)
        ├── Crear liga → código de invitación
        ├── Unirse con código
        └── Clasificación (standings)
```

## 2. User Flows críticos

### Flujo A — Onboarding completo (registro → primer sobre)
1. Landing → **[Crear cuenta]**
2. Formulario: nombre, email, contraseña (3 campos) → submit
3. Sistema otorga 15,000 monedas → redirige a **Inicio**
4. Estado vacío: "Aún no estás en una liga" → **[Crear liga]** o **[Tengo un código]**
5. Crear liga: nombre → sistema genera código de 6 caracteres → pantalla "comparte este código"
6. CTA "Abre tu primer sobre" → **Sobres** → elige Bronce (2,500) → confirmación
7. Reveal: 3 cartas volteándose una a una (la de mayor rating al final) → **[Ver colección]**

### Flujo B — Armar el once
1. **Mi Once** → cancha vacía con siluetas por posición según formación
2. Tap en silueta → sheet inferior con cartas de la colección filtradas por esa posición
3. Selecciona carta → ocupa el slot → repite
4. Tap prolongado / botón en carta → asignar capitán (badge ©)
5. **[Guardar once]** → toast de confirmación

### Flujo C — Intercambio entre mánagers
1. **Mercado** → grid de cartas de otros mánagers → tap en carta deseada
2. Modal: elegir carta propia a ofrecer + monedas adicionales (opcional)
3. **[Enviar oferta]** → estado "pendiente" en pestaña Enviadas
4. El otro mánager ve la oferta en Recibidas → **[Aceptar]** / **[Rechazar]**
5. Al aceptar: swap de cartas + transferencia de monedas + notificación a ambos

## 3. Modelo de navegación

- **Móvil:** barra de navegación inferior con 5 destinos (Inicio, Sobres, Colección, Once, Más).
- **Desktop:** navegación superior persistente.
- Selector de **liga activa** siempre visible en el header (las cartas y el mercado dependen de la liga).
- Profundidad máxima: 3 niveles (regla de los 3 taps para cualquier tarea crítica).
