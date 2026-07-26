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
│ ──────── o ────────     │  ← separador
│ (Entrar con Google)     │  ← botón oficial de Google; se oculta
│ ¿No tienes cuenta? Crear│    si el servidor no tiene client id
└─────────────────────────┘
```

## 2. Inicio
```
┌─────────────────────────┐
│ Hola, Diego     €50M    │  ← header con el presupuesto de la liga activa
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
│ [Bronce   €8M]│          │   (fondo con  │
│ [Plata   €15M]│          │    glow por   │
│ [Oro     €30M]│   →      │    rareza)    │
│ [Legend. €60M]│          │  🃏 🃏 🃏     │ ← volteo secuencial
│  saldo: €__M  │          │ (Ver colección)│
└───────────────┘          └───────────────┘
```
Oro y Legendario garantizan al menos una carta élite de la competencia.

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
│ [Libres][Clausulazo]    │  ← tabs (+ Ventas, Recibidas, Enviadas)
│ ⏱ Nuevo mercado en 6 h  │  ← solo en Agentes libres
│ ┌────┐ ┌────┐           │
│ │ 🃏 │ │ 🃏 │           │  ← sin dueño en Libres;
│ │Fichar│ │Fichar│        │    con dueño visible en Clausulazo
│ │ €12M │ │ €4M  │        │
│ └────┘ └────┘           │
└─────────────────────────┘
Modal de oferta: mi carta ▾ + euros [___] → (Enviar oferta)
```
Cuatro vías de fichaje en el mismo lugar: agentes libres (lote de 12 que se
renueva cada 24 h), clausulazo, compra de una publicación e intercambio.

## 6b. Detalle de carta (modal)
```
┌─────────────────────────┐
│ 🃏  Nombre              │  ← cabecera teñida por rareza
│     Club · edad         │
│ [Media][Valor][Cláusula]│  ← los 3 datos que deciden
│ ── Blindar ──           │
│ (+€1M)(+€5M)(+€10M)     │  ← atajos, evita teclear ceros
│ [____] (Subir)          │
│ Quedaría en €XX M       │  ← vista previa antes de pagar
│ ── Vender ──            │
│ (Valor)(+25%)(+50%)     │
│ [____] (Vender)         │
└─────────────────────────┘
```

## 6c. Tu Leyenda
```
Identidad:                       Carrera:
┌───────────────────────┐   ┌──────────────┬──────────────┐
│ ① Identidad  ② País   │   │ Ficha (OVR,  │  Historial   │
│ ③ Posición            │   │ club, stats) │  16 ○ ○ ○    │
│ [camiseta] [lista]    │   ├──────────────┤  18 ○ ○ ○    │
│ [apellido] [cancha]   │   │ 1 · Futuro   │  20 …        │
│  (Confirmar identidad)│   │ 2 · Enfoque  │              │
└───────────────────────┘   └──────────────┴──────────────┘
```
El número de cada paso se rellena al completarse: indica qué falta para poder
empezar. En la carrera, lo único que scrollea es la tabla del historial.

## 7. Ligas
```
┌─────────────────────────┐
│ [Mis ligas]  [+ Crear] [Unirme]
│ ── Clasificación ──     │
│ # Mánager  Pts Cartas Valor Patrimonio
│ 1 Leo    1,240  18  €410M  €455M
│ 2 Diego  1,180  16  €380M  €402M ← tú (resaltado)
│ 3 Fer      950  15  €300M  €338M
│ Código: ABX4T9 (copiar) │
└─────────────────────────┘
```
*Valor* = valor de mercado de la plantilla. *Patrimonio* = plantilla + lo que
queda en caja; es el que ordena el desempate.
