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

## 1. Autenticacion (Login / Registro)

El sistema soporta autenticacion JWT con email/password, manteniendo compatibilidad con usuarios anonimos.

```mermaid
sequenceDiagram
    actor Usuario as Usuario
    participant App as App
    participant API as API

    alt Registro nuevo
        Usuario->>App: Pantalla de registro
        Usuario->>App: Introduce email + password + nombre
        App->>API: POST /api/auth/register
        API-->>App: user + accessToken + refreshToken
        App->>App: Guarda tokens en storage
        App-->>Usuario: Redirige a Home Feed
    else Login existente
        Usuario->>App: Pantalla de login
        Usuario->>App: Introduce email + password
        App->>API: POST /api/auth/login
        API-->>App: user + accessToken + refreshToken
        App->>App: Guarda tokens en storage
        App-->>Usuario: Redirige a Home Feed
    else Upgrade anonimo
        Usuario->>App: Opcion "Crear cuenta" desde perfil
        App->>API: POST /api/auth/upgrade
        API-->>App: Usuario actualizado con email
        App-->>Usuario: Cuenta vinculada
    end

    Note over App,API: Access token (15 min TTL)
    Note over App,API: Refresh token (7 dias, rotado en cada uso)

    App->>API: Request con Authorization: Bearer <accessToken>
    API-->>App: 401 si token expirado
    App->>API: POST /api/auth/refresh {refreshToken}
    API-->>App: Nuevos accessToken + refreshToken
```

### Vinculacion padre-hijo

```mermaid
sequenceDiagram
    actor Padre as Padre
    participant App as App
    participant API as API

    Padre->>App: Login como padre
    Padre->>App: "Vincular hijo"
    App->>API: POST /api/auth/link-child {parentUserId, childUserId}
    API-->>App: Cuenta vinculada
    App-->>Padre: Puede gestionar perfil del hijo
```

- Los roles disponibles son `child` y `parent`
- El middleware de auth es **no bloqueante**: las rutas funcionan con y sin token
- Los tokens se almacenan en `SecureStore` (mobile) / `localStorage` (web)

---

## 2. Onboarding (5 pasos)

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

## 3. Home Feed

El feed principal muestra noticias deportivas reales filtradas y ordenadas por el **feed ranker**.

- **Busqueda**: barra de busqueda con debounce (300ms) que filtra por titulo y resumen via parametro `q`. Incluye sugerencias populares (equipos/ligas) al enfocar. Durante la busqueda se oculta el selector de modo de feed.
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
- **Favoritos**: boton de corazon en cada tarjeta para guardar noticias. Los favoritos se persisten en localStorage (web) / AsyncStorage (mobile). Las noticias guardadas aparecen en una franja "Guardados" encima del feed.
- **Trending**: las noticias con mas de 5 visualizaciones en las ultimas 24h muestran un badge "Trending" naranja
- **Gamificacion**: +5 puntos al ver una noticia

### Flujo de busqueda

```mermaid
sequenceDiagram
    actor Nino as Nino
    participant App as Webapp
    participant API as API

    Nino->>App: Escribe en la barra de busqueda
    App->>App: Debounce 300ms
    App->>API: GET /api/news?q=Madrid&sport=&age=
    API-->>App: Noticias filtradas por titulo/resumen
    App-->>Nino: Muestra resultados (o estado vacio si no hay)
    Nino->>App: Click en sugerencia "Real Madrid"
    App->>App: Rellena input y busca
    Nino->>App: Click en X para limpiar
    App-->>Nino: Vuelve al feed normal
```

- Al escribir, se oculta el selector de modo de feed
- Las sugerencias incluyen equipos y ligas populares
- Si no hay resultados, se muestra un estado vacio con ilustracion SVG

### Flujo de favoritos

```mermaid
sequenceDiagram
    actor Nino as Nino
    participant App as Webapp
    participant Storage as localStorage

    Nino->>App: Click corazon en NewsCard
    App->>Storage: Guardar ID de noticia
    App-->>Nino: Corazon se llena de rojo
    App-->>Nino: Franja "Guardados" aparece encima del feed

    Nino->>App: Click corazon otra vez
    App->>Storage: Eliminar ID de noticia
    App-->>Nino: Corazon vuelve a outline
    App-->>Nino: Noticia eliminada de "Guardados"
```

- Los favoritos se persisten entre sesiones (localStorage web, AsyncStorage mobile)
- No requiere autenticacion — almacenamiento local del cliente

## 4. Reels

Feed de videos cortos con layout de grid y miniaturas de YouTube.

- **Layout grid**: miniaturas con preview, titulo y deporte
- **Formato**: video embebido (YouTube) o nativo
- **Filtros**: chips de deportes (`FiltersBar`)
- **Info**: titulo, deporte, equipo, duracion, fuente
- **Interacciones**: like y share (iconos)
- **Gamificacion**: +3 puntos al ver un reel

## 5. Quiz

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

## 6. Mi Equipo (`/team`)

Seccion dedicada al equipo favorito del usuario con estadisticas en vivo.

- **Tarjeta de estadisticas** (`TeamStats`): victorias, empates, derrotas, posicion, goleador, proximo partido
- **Feed filtrado**: noticias que mencionan al equipo
- **Cambiar equipo**: selector con lista de equipos conocidos (constante `TEAMS`)
- **Sin equipo**: muestra selector para elegir uno
- **Datos**: via `GET /api/teams/:name/stats` (15 equipos con datos seed)

## 7. Coleccion (`/collection`)

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

## 8. Control Parental (`/parents`)

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

### Reporte de contenido

Los ninos pueden marcar cualquier noticia o reel como inapropiado directamente desde la tarjeta de contenido:

1. El nino pulsa el boton de reporte (icono de bandera) en una NewsCard o ReelCard
2. Selecciona una razon del dropdown (inapropiado, no es deporte, otro)
3. Opcionalmente anade un comentario
4. El reporte se envia a `POST /api/reports`
5. El padre ve los reportes pendientes en la pestana de Actividad del panel parental (`GET /api/reports/parent/:userId`)
6. El padre puede marcar el reporte como revisado o tomar accion

### Preview del feed

Los padres pueden ver exactamente lo que ve su hijo:

1. Desde el panel parental, el padre hace clic en "Ver feed del nino"
2. Se abre un modal (`FeedPreviewModal`) que muestra las noticias y reels con los filtros del hijo aplicados
3. El preview incluye las restricciones de formato, deporte y limites de tiempo vigentes
4. Datos via `GET /api/parents/preview/:userId`

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

### Digest semanal

Los padres pueden activar un resumen semanal automatico con la actividad del hijo:

1. Desde el panel parental, pestana "Digest", el padre activa el digest semanal
2. Configura email de destino y dia de envio (lunes por defecto)
3. Un cron job (08:00 UTC diario) verifica que dia toca enviar a cada usuario
4. El digest incluye: actividad semanal, deportes mas vistos, logros desbloqueados, racha
5. Se puede previsualizar en JSON (`GET /api/parents/digest/:userId/preview`) o descargar como PDF (`GET /api/parents/digest/:userId/download`)

## 9. Mision diaria

Cada dia el nino recibe una mision personalizada que incentiva el uso de la app.

```mermaid
sequenceDiagram
    actor Nino as Nino
    participant App as Webapp
    participant API as API

    Nino->>App: Abre la app
    App->>API: GET /api/missions/today/:userId
    API-->>App: Mision del dia (tipo, progreso, objetivo)
    App-->>Nino: Muestra MissionCard en Home Feed

    Nino->>App: Realiza la actividad (ej. leer 3 noticias)
    App->>API: POST /api/parents/actividad/registrar
    API-->>API: checkMissionProgress() actualiza progreso
    App->>API: GET /api/missions/today/:userId
    API-->>App: progress: 3/3, completed: true

    Nino->>App: Click "Reclamar recompensa"
    App->>API: POST /api/missions/claim
    API-->>App: pointsAwarded + stickerAwarded
    App-->>Nino: Animacion de recompensa
```

- **Generacion**: cron diario a las 05:00 UTC o bajo demanda al consultar
- **Tipos**: `read_news`, `watch_reels`, `play_quiz`, `check_in`, `explore_sports`
- **Recompensas**: puntos + posible sticker (rareza variable segun dificultad)
- **3 estados**: en progreso, completada (sin reclamar), reclamada

## 10. Dark mode

El usuario puede alternar entre tema claro, oscuro o automatico (sistema).

1. El toggle esta en la NavBar (web), cicla: system -> dark -> light
2. La preferencia se guarda en `localStorage` (`sportykids-theme`)
3. Un script inline en `<head>` aplica la clase `.dark` antes del render para evitar flash
4. Si el tema es `system`, escucha cambios en `prefers-color-scheme`
5. Todas las variables CSS se adaptan automaticamente (background, text, surface, border, muted)

## 11. Push Notifications

El sistema envia notificaciones push reales a dispositivos moviles mediante Expo Push Notifications.

```mermaid
sequenceDiagram
    actor Nino as Nino
    participant App as App Movil
    participant API as API
    participant Expo as Expo Push Service

    Note over Nino,App: Registro del token push
    App->>App: requestPermissions() via expo-notifications
    App->>App: getExpoPushTokenAsync()
    App->>API: POST /api/users/:id/notifications/subscribe {pushToken}
    API->>API: Guarda PushToken en DB

    Note over API,Expo: Trigger: Quiz diario listo (06:00 UTC)
    API->>API: Genera quiz diario
    API->>Expo: sendPushNotificationsAsync([...tokens])
    Expo-->>App: Push notification
    App-->>Nino: "Tu quiz del dia esta listo"
    Nino->>App: Toca notificacion
    App->>App: Deep link a /quiz

    Note over API,Expo: Trigger: Recordatorio de racha (20:00 UTC)
    API->>API: Cron busca usuarios sin check-in hoy
    API->>Expo: sendPushNotificationsAsync([...tokens])
    Expo-->>App: Push notification
    App-->>Nino: "No pierdas tu racha de 5 dias"
    Nino->>App: Toca notificacion
    App->>App: Deep link a Home Feed
```

### 5 triggers de push

| Trigger | Cuando | Deep link |
|---------|--------|-----------|
| Quiz listo | 06:00 UTC (cron quiz diario) | `/quiz` |
| Noticia del equipo | Al sincronizar feeds | Home Feed filtrado |
| Recordatorio de racha | 20:00 UTC si no hay check-in | Home Feed |
| Cromo obtenido | Al ganar sticker | `/collection` |
| Mision lista | 05:00 UTC (cron misiones) | Home Feed |

- Las notificaciones respetan las preferencias del usuario (`dailyQuiz`, `teamNews`, `newStickers`)
- Solo se envian a dispositivos fisicos (no emuladores)
- El campo `User.locale` permite localizar el texto de las notificaciones al idioma del usuario
