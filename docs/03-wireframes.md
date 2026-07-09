# Criterio 2b — Wireframes (low/mid-fi)

> En Figma: página "Wireframes" con frames móvil (390×844). Aquí la especificación
> de bloques de cada pantalla para trazarlos rápido.

## Convención
- `[ ]` = contenedor / tarjeta · `(btn)` = acción primaria · `<icon>` = icono

## 1. Acceso (login/registro)
```
┌─────────────────────────┐
│   LOGO + carta hero     │  ← 40% superior, gancho visual
│                         │
│ [ email____________ ]   │
│ [ contraseña_______ ]   │
│ (Entrar)                │  ← CTA lleno, ancho completo
│ ¿No tienes cuenta? Crear│  ← link, cambia el form (no navega)
└─────────────────────────┘
```

## 2. Inicio
```
┌─────────────────────────┐
│ Hola, Diego   🪙 15,000 │  ← header con monedas siempre visibles
│ [Liga: Los Compas ▾]    │  ← selector de liga activa
│ ┌─────────────────────┐ │
│ │ 🏆 Vas 2º de 6      │ │  ← tarjeta de posición (tap → Ligas)
│ └─────────────────────┘ │
│ [ TU MEJOR CARTA ]      │  ← carta grande, orgullo/estatus
│ [Sobre diario] [Tu once]│  ← accesos rápidos (2 col)
│ ⌂  📦  🃏  ⚽  ⋯        │  ← tab bar
└─────────────────────────┘
```

## 3. Sobres — tienda y reveal
```
Tienda:                     Reveal:
┌───────────────┐          ┌───────────────┐
│ [Bronce 2500] │          │   (fondo con  │
│ [Plata  5000] │          │    glow por   │
│ [Oro    9000] │   →      │    rareza)    │
│  saldo: 🪙    │          │  🃏 🃏 🃏     │ ← volteo secuencial
└───────────────┘          │ (Ver colección)│
                           └───────────────┘
```

## 4. Colección
```
┌─────────────────────────┐
│ [buscar___] [Pos ▾][País▾]
│ ┌────┐ ┌────┐ ┌────┐   │  ← grid 3 col (móvil 2)
│ │ 🃏 │ │ 🃏 │ │ 🃏 │   │    carta = rating + pos + bandera + nombre
│ └────┘ └────┘ └────┘   │
└─────────────────────────┘
```

## 5. Mi Once
```
┌─────────────────────────┐
│ [Formación: 4-4-2 ▾]    │
│      🥅 cancha           │
│   ○     ○     ○  ←siluetas vacías = tap para elegir
│   ○  ○  ○  ○           │
│      ○     ○©           │  ← © capitán
│ (Guardar once)          │
└─────────────────────────┘
Sheet inferior al tocar slot: cartas filtradas por posición.
```

## 6. Mercado
```
┌─────────────────────────┐
│ [Cartas][Recibidas][Enviadas]  ← tabs
│ ┌────┐ ┌────┐           │
│ │🃏 de│ │🃏 de│          │  ← dueño visible en cada carta
│ │ Fer │ │ Leo │          │
│ └────┘ └────┘           │
└─────────────────────────┘
Modal de oferta: mi carta ▾ + monedas [___] → (Enviar oferta)
```

## 7. Ligas
```
┌─────────────────────────┐
│ [Mis ligas]  [+ Crear] [Unirme]
│ ── Clasificación ──     │
│ 1. Leo      1,240 pts   │
│ 2. Diego    1,180 pts ← tú (resaltado)
│ 3. Fer        950 pts   │
│ Código: ABX4T9 (copiar) │
└─────────────────────────┘
```
