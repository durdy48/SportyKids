# Flujos de usuario

## Diagrama general de navegacion

```mermaid
flowchart TD
    START["Abrir app"] --> CHECK{"¿Existe<br/>usuario?"}
    CHECK -->|No| ONB["Onboarding<br/>(4 pasos)"]
    CHECK -->|Si| HOME["Home Feed"]

    ONB --> |Paso 1| NOMBRE["Nombre + Edad"]
    NOMBRE --> DEPORTES["Deportes favoritos"]
    DEPORTES --> EQUIPO["Equipo favorito"]
    EQUIPO --> FEEDS["Feeds de prensa"]
    FEEDS --> |Crear usuario| HOME

    HOME --> REELS["Reels"]
    HOME --> QUIZ["Quiz"]
    HOME --> MIEQ["Mi Equipo (/team)"]
    HOME --> PADRES["Control Parental (/parents)"]

    PADRES --> PIN{"¿Tiene PIN?"}
    PIN -->|No| CREAR_PIN["Crear PIN"]
    PIN -->|Si| VERIFICAR["Verificar PIN"]
    CREAR_PIN --> PANEL["ParentalPanel"]
    VERIFICAR --> PANEL
```

## 1. Onboarding

El onboarding es un wizard de 4 pasos que se muestra la primera vez que se abre la app.

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
    App->>API: GET /api/news/sources/list
    API-->>App: Lista de fuentes RSS
    Nino->>App: Selecciona fuentes

    Nino->>App: Click "Empezar"
    App->>API: POST /api/users
    API-->>App: Usuario creado
    App->>App: Guarda ID en localStorage
    App-->>Nino: Redirige al Home Feed
```

## 2. Home Feed

El feed principal muestra noticias deportivas reales filtradas por preferencias.

- **Filtros**: chips de deportes (componente `FiltersBar`) + selector de rango de edad
- **Tarjetas**: imagen, titular, resumen, fuente, fecha, badge de deporte/equipo (componente `NewsCard`)
- **Paginacion**: boton "Cargar mas" al final
- **Personalizacion**: filtra automaticamente por la edad del usuario

## 3. Reels

Feed vertical de videos cortos con scroll snap.

- **Formato**: un video por pantalla (estilo TikTok/Instagram Reels)
- **Filtros**: chips de deportes (`FiltersBar`)
- **Info**: titulo, deporte, equipo, duracion, fuente
- **Reproduccion**: iframe de YouTube embebido

## 4. Quiz

Juego de trivia deportiva con sistema de puntos.

```mermaid
stateDiagram-v2
    [*] --> Inicio
    Inicio --> Jugando: Click "Empezar"
    Jugando --> Pregunta: Cargar 5 preguntas
    Pregunta --> Feedback: Seleccionar opcion
    Feedback --> Pregunta: Siguiente pregunta
    Feedback --> Resultado: Ultima pregunta
    Resultado --> Inicio: Volver
    Resultado --> Jugando: Jugar otra vez
```

- **Pantalla de inicio**: puntuacion total + boton empezar
- **Juego**: 5 preguntas aleatorias, 4 opciones cada una
- **Feedback**: inmediato (verde = correcto, rojo = incorrecto)
- **Resultado**: puntos ganados + puntuacion total acumulada

## 5. Mi Equipo (`/team`)

Seccion dedicada al equipo favorito del usuario. Componente: `FavoriteTeam` (mobile).

- **Feed filtrado**: noticias que mencionan al equipo
- **Cambiar equipo**: selector con lista de equipos conocidos (constante `TEAMS`)
- **Sin equipo**: muestra selector para elegir uno

## 6. Control Parental (`/parents`)

Acceso protegido por PIN para los padres. Componente: `ParentalPanel` (web) / `ParentalControl` (mobile).

```mermaid
sequenceDiagram
    actor Padre as Padre
    participant App as Webapp
    participant API as API

    Padre->>App: Click en icono candado
    App->>API: GET /api/parents/profile/:id
    API-->>App: exists: true/false

    alt Primera vez
        App-->>Padre: Crear PIN (4 digitos)
        Padre->>App: Introduce PIN
        App-->>Padre: Confirmar PIN
        Padre->>App: Repite PIN
        App->>API: POST /api/parents/configure
        API-->>App: Perfil creado
    else Ya tiene PIN
        App-->>Padre: Verificar PIN
        Padre->>App: Introduce PIN
        App->>API: POST /api/parents/verify-pin
        API-->>App: verified: true + profile
    end

    App-->>Padre: ParentalPanel
    Note over Padre,App: Resumen de actividad semanal
    Note over Padre,App: Toggles de formatos (noticias/reels/quiz)
    Note over Padre,App: Tiempo maximo diario

    Padre->>App: Desactiva "Reels"
    App->>API: PUT /api/parents/profile/:id
    API-->>App: Perfil actualizado
    App->>App: NavBar oculta tab Reels
```

### Panel parental incluye:

| Seccion | Descripcion |
|---------|-------------|
| **Actividad semanal** | Contadores: `news_viewed`, `reels_viewed`, `quizzes_played`, puntos |
| **Formatos permitidos** | Toggles para activar/desactivar noticias, reels, quiz |
| **Tiempo maximo** | Selector de minutos por dia (15, 30, 45, 60, 90, 120) |
