# Flujos de usuario

## Diagrama general de navegacion

```mermaid
flowchart TD
    START["Abrir app"] --> CHECKIN["Daily check-in<br/>(+2 puntos, racha)"]
    CHECKIN --> CHECK{"Existe<br/>usuario?"}
    CHECK -->|No| ONB["Onboarding<br/>(5 pasos)"]
    CHECK -->|Si| HOME["Home Feed"]

    ONB --> |Paso 1| NOMBRE["Nombre + Edad"]
    NOMBRE --> DEPORTES["Deportes favoritos"]
    DEPORTES --> EQUIPO["Equipo favorito"]
    EQUIPO --> FEEDS["Feeds de prensa"]
    FEEDS --> PIN_SETUP["PIN parental + Restricciones"]
    PIN_SETUP --> |Crear usuario| HOME

    HOME --> REELS["Reels"]
    HOME --> QUIZ["Quiz"]
    HOME --> MIEQ["Mi Equipo"]
    HOME --> COLEC["Coleccion"]
    HOME --> PADRES["Control Parental"]

    PADRES --> PIN{"Tiene PIN?"}
    PIN -->|No| CREAR_PIN["Crear PIN"]
    PIN -->|Si| VERIFICAR["Verificar PIN"]
    CREAR_PIN --> PANEL["ParentalPanel<br/>(5 pestanas)"]
    VERIFICAR --> PANEL
```

## 1. Onboarding (5 pasos)

El onboarding es un wizard de 5 pasos que se muestra la primera vez que se abre la app.

```mermaid
sequenceDiagram
    actor Nino as Nino
    participant App as Webapp
    participant API as API

    Nino->>App: Abre la app
    App->>App: Comprueba localStorage
    App-->>Nino: Redirige a /onboarding

    Note over Nino,App: Paso 1: Nombre + Edad
    Nino->>App: Escribe nombre, elige rango

    Note over Nino,App: Paso 2: Deportes
    Nino->>App: Selecciona deportes favoritos

    Note over Nino,App: Paso 3: Equipo
    Nino->>App: Elige equipo (opcional)

    Note over Nino,App: Paso 4: Feeds
    App->>API: GET /api/news/fuentes/listado
    API-->>App: Lista de fuentes RSS
    Nino->>App: Selecciona fuentes

    Note over Nino,App: Paso 5: Control parental
    Nino->>App: Pasa dispositivo al padre/madre
    App-->>Nino: Crear PIN (4 digitos)
    App-->>Nino: Configurar formatos permitidos
    App-->>Nino: Configurar tiempo maximo diario

    Nino->>App: Click "Empezar"
    App->>API: POST /api/users
    App->>API: POST /api/parents/configurar
    API-->>App: Usuario + perfil parental creados
    App->>App: Guarda ID en localStorage
    App-->>Nino: Redirige al Home Feed
```

### Paso 5 detallado (Control parental en onboarding)

El quinto paso permite a los padres configurar las restricciones desde el inicio:
- Introducir PIN de 4 digitos + confirmacion
- Seleccionar formatos permitidos (noticias, reels, quiz)
- Seleccionar deportes permitidos
- Establecer tiempo maximo diario (15-120 minutos)
- Este paso es opcional: se puede omitir y configurar despues

## 2. Home Feed

El feed principal muestra noticias deportivas reales filtradas y ordenadas por el **feed ranker**.

- **Ranking personalizado**: noticias del equipo favorito aparecen primero (+5), seguidas por deportes favoritos (+3)
- **3 modos de vista**:
  - **Headlines**: solo titulares compactos
  - **Cards**: tarjeta completa con imagen, resumen, fuente
  - **Explain**: tarjeta + boton "Explica facil" para resumen adaptado por edad
- **Filtros**: chips de deportes (componente `FiltersBar`) + selector de rango de edad
- **Tarjetas**: imagen, titular, resumen, fuente, fecha, badge de deporte/equipo (componente `NewsCard`)
- **Boton "Explica facil"**: abre `AgeAdaptedSummary` con resumen generado por IA para la edad del nino
- **Paginacion**: boton "Cargar mas" al final
- **Personalizacion**: filtra automaticamente por la edad del usuario
- **Gamificacion**: +5 puntos al ver una noticia

## 3. Reels

Feed de videos cortos con layout de grid y miniaturas de YouTube.

- **Layout grid**: miniaturas con preview, titulo y deporte
- **Formato**: video embebido (YouTube) o nativo
- **Filtros**: chips de deportes (`FiltersBar`)
- **Info**: titulo, deporte, equipo, duracion, fuente
- **Interacciones**: like y share (iconos)
- **Gamificacion**: +3 puntos al ver un reel

## 4. Quiz

Juego de trivia deportiva con quiz diario generado por IA.

```mermaid
stateDiagram-v2
    [*] --> Inicio
    Inicio --> Jugando: Click "Empezar"
    Inicio --> QuizDiario: Click "Quiz del dia"
    Jugando --> Pregunta: Cargar 5 preguntas
    QuizDiario --> Pregunta: Cargar preguntas diarias
    Pregunta --> Feedback: Seleccionar opcion
    Feedback --> Pregunta: Siguiente pregunta
    Feedback --> Resultado: Ultima pregunta
    Resultado --> Inicio: Volver
    Resultado --> Jugando: Jugar otra vez
    Resultado --> Coleccion: Ver cromos ganados
```

- **Pantalla de inicio**: puntuacion total + boton empezar + boton quiz diario
- **Quiz diario**: generado automaticamente a las 06:00 UTC con preguntas basadas en noticias recientes
- **Juego**: 5 preguntas aleatorias (o diarias), 4 opciones cada una
- **Adaptacion por edad**: preguntas filtradas por `ageRange` del usuario
- **Feedback**: inmediato (verde = correcto, rojo = incorrecto)
- **Resultado**: puntos ganados + puntuacion total acumulada + cromos nuevos
- **Gamificacion**: +10 puntos por respuesta correcta, +50 bonus por quiz perfecto (5/5)
- **Fallback**: si la IA no esta disponible, usa preguntas del seed

## 5. Mi Equipo (`/team`)

Seccion dedicada al equipo favorito del usuario con estadisticas en vivo.

- **Tarjeta de estadisticas** (`TeamStats`): victorias, empates, derrotas, posicion, goleador, proximo partido
- **Feed filtrado**: noticias que mencionan al equipo
- **Cambiar equipo**: selector con lista de equipos conocidos (constante `TEAMS`)
- **Sin equipo**: muestra selector para elegir uno
- **Datos**: via `GET /api/teams/:name/stats` (15 equipos con datos seed)

## 6. Coleccion (`/collection`)

Pagina de cromos y logros del usuario.

```
┌─────────────────────────────────────────┐
│  Mi Coleccion          12/36 cromos     │
├─────────────────────────────────────────┤
│  [Filtros por deporte]                  │
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ ⚽   │  │ 🏀   │  │ 🎾   │          │
│  │ Bota │  │ Mate │  │ ???  │  ...      │
│  │ Oro  │  │ Epico│  │      │          │
│  └──────┘  └──────┘  └──────┘          │
│                                         │
│  Logros                    8/20         │
│  ┌─────────────────────────────────┐    │
│  │ ✓ Racha de 3 dias              │    │
│  │ ✓ 100 puntos                   │    │
│  │ □ Leer 5 deportes distintos    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- **Grid de cromos**: filtrable por deporte, muestra desbloqueados vs bloqueados
- **Rarezas**: common, rare, epic, legendary (con indicador visual)
- **Logros**: lista con progreso, desbloqueados marcados
- **Estadisticas**: total coleccionado, racha actual, puntos

## 7. Control Parental (`/parents`)

Acceso protegido por PIN con sesiones temporales. Componente: `ParentalPanel` (web, 5 pestanas) / `ParentalControl` (mobile).

```mermaid
sequenceDiagram
    actor Padre as Padre
    participant App as Webapp
    participant API as API

    Padre->>App: Click en icono candado
    App->>API: GET /api/parents/perfil/:id
    API-->>App: exists: true/false

    alt Primera vez
        App-->>Padre: Crear PIN (4 digitos)
        Padre->>App: Introduce PIN
        App-->>Padre: Confirmar PIN
        Padre->>App: Repite PIN
        App->>API: POST /api/parents/configurar
        API-->>App: Perfil creado (PIN bcrypt)
    else Ya tiene PIN
        App-->>Padre: Verificar PIN
        Padre->>App: Introduce PIN
        App->>API: POST /api/parents/verificar-pin
        API-->>App: verified: true + sessionToken (5 min TTL)
    end

    App-->>Padre: ParentalPanel (5 pestanas)

    Note over Padre,App: Pestana 1: Perfil del nino
    Note over Padre,App: Pestana 2: Contenido (formatos + deportes)
    Note over Padre,App: Pestana 3: Restricciones (tiempo)
    Note over Padre,App: Pestana 4: Actividad semanal
    Note over Padre,App: Pestana 5: Cambiar PIN

    Padre->>App: Desactiva "Reels"
    App->>API: PUT /api/parents/perfil/:id
    API-->>App: Perfil actualizado
    App->>App: NavBar oculta tab Reels
    Note over App,API: Middleware parental-guard tambien bloquea en servidor
```

### Panel parental (5 pestanas):

| Pestana | Descripcion |
|---------|-------------|
| **Perfil** | Informacion del nino: nombre, edad, deportes favoritos |
| **Contenido** | Toggles de formatos (noticias/reels/quiz) + deportes permitidos |
| **Restricciones** | Tiempo maximo diario (15-120 min) con barra visual |
| **Actividad** | Resumen semanal: contadores, minutos por dia, desglose por deporte |
| **PIN** | Cambiar PIN de acceso |

### Enforcement server-side (parental-guard middleware)

Las restricciones parentales se aplican en **dos niveles**:
1. **Frontend**: oculta tabs y opciones bloqueadas
2. **Backend**: middleware `parental-guard.ts` en rutas de news, reels y quiz
   - Verifica formato permitido (403 si bloqueado)
   - Filtra deportes no permitidos
   - Verifica tiempo diario (429 si excedido)

### Tracking de actividad con duracion

El frontend envia la duracion de cada sesion usando `sendBeacon` al cerrar/navegar:
```
POST /api/parents/actividad/registrar
{ userId, type, durationSeconds, contentId, sport }
```

Esto permite al panel parental mostrar:
- Minutos totales por dia
- Desglose por deporte
- Contenido mas consumido
