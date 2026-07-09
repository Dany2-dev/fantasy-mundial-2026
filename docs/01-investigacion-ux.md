# Criterio 1 — Investigación y Fase UX (25%)

> Nivel Excelente exige: problema claro + user personas detalladas + mapa de empatía +
> journey map, **todo alineado con las decisiones de diseño de la interfaz**.

## 1. Definición del problema

Los aficionados al fútbol que quieren competir con sus amigos durante el Mundial 2026
se encuentran con fantasies genéricos (todos pueden tener al mismo jugador, no hay
sentido de propiedad) o con apps de colección sin competencia real entre amigos.

**Problema:** No existe una experiencia que combine la emoción de coleccionar cartas
(rareza, propiedad exclusiva) con la competencia social de una liga privada entre amigos.

**Propuesta:** Fantasy con exclusividad de cartas por liga: si tu amigo ya tiene a
Mbappé, es SUYO — te toca negociar un intercambio o buscar otra estrella en los sobres.

## 2. User Personas (completar en Figma)

### Persona 1 — "El Competitivo" (primaria)
- **Nombre:** Diego, 21 años, estudiante de ingeniería.
- **Contexto:** entra 3–5 veces al día en ratos cortos (camión, entre clases), 100% móvil.
- **Metas:** quedar 1º en la liga con sus amigos; presumir su colección.
- **Frustraciones:** apps que exigen sesiones largas; fantasies donde todos tienen el mismo equipo.
- **Escenario:** revisa su once antes del deadline, abre su sobre diario, lanza un clausulazo.

### Persona 2 — "La Social" (secundaria)
- **Nombre:** Fer, 24 años, diseñadora junior.
- **Contexto:** juega porque sus amigos la invitaron; conoce a los jugadores famosos, no las estadísticas.
- **Metas:** divertirse, no sentirse perdida, conseguir cartas de sus jugadores favoritos.
- **Frustraciones:** jerga futbolera sin explicar, onboarding confuso, pantallas saturadas de números.
- **Escenario:** entra con el código de invitación, abre su primer sobre, arma un once "a ojo".

## 3. Mapa de empatía (por persona)

| Dimensión | Diego | Fer |
|---|---|---|
| **Piensa/Siente** | "Tengo que ganarles"; orgullo por su colección | "No quiero regarla frente a todos" |
| **Ve** | Rankings, precios de mercado, notificaciones | Cartas bonitas, la posición de sus amigos |
| **Oye** | El grupo de WhatsApp presumiendo sobres | Que "está fácil, solo abre sobres" |
| **Dice/Hace** | Negocia intercambios, calcula puntos | Pregunta qué significa cada cosa |
| **Dolores** | Perder por no ajustar su once a tiempo | Sentir que empieza en desventaja |
| **Ganancias** | Estatus de líder de liga | Sorpresa/dopamina al abrir un sobre |

## 4. Customer Journey Map (flujo: primer día de juego)

| Etapa | Descubre | Se registra | Se une a liga | Abre sobres | Arma su once | Vuelve al día siguiente |
|---|---|---|---|---|---|---|
| Acción | Recibe link del grupo | Crea cuenta | Pega código | Abre 3 sobres de bienvenida | Selecciona 11 y capitán | Notificación de racha |
| Emoción | Curiosidad | Neutral (fricción) | Pertenencia | 🔥 Pico de emoción | Concentración | Hábito |
| Punto de dolor | "¿Otra app más?" | Formularios largos | Código confuso | Que salga puro 72 | No saber a quién poner | Olvidarse de la app |
| Oportunidad UI | Landing con carta hero | Registro de 3 campos | Input de código con auto-mayúsculas | Animación de reveal + rareza | Sugerencia "mejor once" | Racha visible + recompensa diaria |

## 5. Trazabilidad investigación → diseño

| Hallazgo | Decisión de diseño |
|---|---|
| Sesiones cortas en móvil | Mobile-first, navegación inferior, 1 acción principal por pantalla |
| La emoción está en el sobre | El reveal de cartas es la interacción más pulida (Smart Animate en Figma) |
| Fer se pierde con la jerga | Etiquetas claras ("Delantero", no "ST"), tooltips en primeras sesiones |
| Diego quiere estatus | Ranking de liga en el home; carta destacada "tu mejor carta" |
