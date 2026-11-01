# Jump Boy — Rocket Edited

Port moderno a Java de **Jump Boy**, el clásico juego para móviles Java ME (MIDP)
de **SteamHouse**. Esta edición **Rocket Edited** añade un ejecutable autónomo
para Windows, arregla el sonido y pule varios detalles del port original.

> **Jugar:** doble clic en **`Jump Boy.exe`** (carpeta principal) o en
> **`Rocket Edited\Rocket Edited.exe`**. No hace falta instalar Java:
> el runtime va incluido.

---

## Inicio rápido (Windows)

| | |
|---|---|
| **Sistema** | Windows 10 / 11 de 64 bits |
| **Java** | No necesario (runtime privado incluido) |
| **Instalación** | Ninguna: es portable |
| **Ejecutable principal** | `Jump Boy.exe` |
| **Edición Rocket Edited** | `Rocket Edited\Rocket Edited.exe` |

1. Abre la carpeta del juego.
2. Haz doble clic en `Jump Boy.exe`.
3. Si Windows SmartScreen avisa de que el archivo no está firmado, pulsa
   **Más información → Ejecutar de todas formas**. Es normal en ejecutables
   caseros sin certificado de firma.
4. No muevas el `.exe` fuera de su carpeta: necesita `app\` y `runtime\`,
   que están a su lado.

## Controles

| Acción | Teclas |
|---|---|
| Moverse a la izquierda / derecha | `←` / `→` (o `4` / `6`) |
| Subir / bajar | `↑` / `↓` (o `2` / `8`) |
| Saltar | `Enter`, `Espacio` o `5` |
| Salto extra (cuando tienes “breaks”) | `Z` o `0` |
| Botones blandos del móvil (atrás / opciones) | `Q` / `W` |
| Navegar menús | Flechas + `Enter` / `Espacio` |
| Móvil o tablet | Controles táctiles que aparecen en la versión web |

## Contenido del paquete

```
jump boy\
├─ Jump Boy.exe            ← ejecuta el juego (runtime incluido)
├─ app\
│  ├─ JumpBoy.jar          ← código compilado
│  └─ res\                 ← gráficos, música y datos de guardado
├─ runtime\                ← Java 17 privado, no tocar
├─ README.md
├─ LICENSE
├─ Jump-Boy-Port\          ← código fuente del port + script de compilación
└─ Rocket Edited\          ← copia completa de la edición Rocket Edited
```

Dentro de `Rocket Edited\` la estructura es equivalente, con
`Rocket Edited.exe`, su propia copia de `res\` y una carpeta `source\`
con el código, la licencia y el script de compilación.

## Guardado

El progreso (nivel máximo alcanzado e idioma) se guarda automáticamente en:

```
app\res\data\data.bin
```

Es un archivo de 22 bytes. Si se borra, el juego lo recrea con valores
iniciales. Para empezar de cero, bórralo con el juego cerrado.

## Qué mejora esta edición

- **Sonido arreglado.** El port original intentaba abrir archivos `.mid` con
  `AudioSystem` (que solo entiende audio muestreado), así que la música nunca
  sonaba. Ahora se usa un `Sequencer` MIDI real, con música en bucle y efecto
  de muerte.
- **El interruptor de sonido funciona de verdad.** Antes solo cambiaba el
  icono; ahora detiene y reanuda la música.
- **Escalado nítido.** Ventana de 528×660 a 3× (352×440 a 2× en pantallas
  pequeñas), con interpolación *nearest neighbor* y sin píxeles borrosos.
- **Icono propio** en la ventana y en el ejecutable.
- **Guardado a prueba de fallos.** Se crea `data.bin` si no existe y se
  rellena si está incompleto, sin excepciones.
- **Controles más cómodos:** `Espacio` también salta y `Z` se libera
  correctamente.
- **Ejecutable portable** generado con `jpackage`, con Java 17 incluido.
- **Arranque de audio precargado**, para que la música empiece sin tirones.

## Versión web (GitHub Pages)

La versión web ejecuta el port Java en el navegador con **CheerpJ**; no es una
compilación Unity/WebGL. El código de este repositorio tampoco contiene un
proyecto Android/Unity. En ordenador se puede jugar con el teclado y en móvil o
tablet aparecen controles táctiles dentro del juego. La primera carga requiere
conexión a Internet para descargar el runtime de CheerpJ.

Para generar la página localmente, desde `Jump-Boy-Port` con JDK 17 o superior:

```powershell
powershell -ExecutionPolicy Bypass -File .\build-web.ps1
```

El script compila el juego para Java 8 y escribe `docs\jumpboy-web.jar`, junto a
la página `docs\index.html`. Para publicarlo, sube el repositorio a GitHub y en
**Settings → Pages** selecciona **GitHub Actions** como fuente. El workflow
`.github\workflows\build-and-pages.yml` genera y publica la web al actualizar
`main`; también compila la aplicación Windows y la adjunta como artefacto a la
ejecución del workflow.

## Compilar desde el código

Requisitos: **JDK 17 o superior** (probado con Temurin 17.0.20).

```powershell
# Desde Jump-Boy-Port
$env:JAVA_HOME = "C:\ruta\a\jdk-17"
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```

El script compila, crea el `.jar`, copia `res\` y genera
`dist\Jump Boy\Jump Boy.exe` con runtime propio.

Para generar la variante **Rocket Edited** se usa el mismo `appinput` y se
añade la opción `--java-options "-Djumpboy.edition=Rocket"` a `jpackage`;
así el ejecutable se llama `Rocket Edited.exe` y la ventana muestra
*Jump Boy - Rocket Edited*.

Compilación manual:

```powershell
# 1) Clases
New-Item -ItemType Directory -Force build\classes | Out-Null
javac -encoding UTF-8 -d build\classes (Get-ChildItem src -Recurse -Filter *.java).FullName

# 2) Jar ejecutable
jar --create --file build\JumpBoy.jar --main-class rocket -C build\classes .

# 3) Probar (res\ debe estar junto al jar)
Copy-Item res build\res -Recurse
java -jar build\JumpBoy.jar
```

### Estructura del código

| Archivo | Función |
|---|---|
| `src/rocket.java` | Punto de entrada, ventana e icono |
| `src/b.java` | Motor del juego: dibujo, niveles, menús, entrada |
| `src/c.java` | Reproductor MIDI (música y sonido de muerte) |
| `src/a.java` | Lectura del progreso guardado |
| `src/utils/` | Utilidades de imagen, fuente y streams |

El código original venía decompilado del MIDlet, por eso abundan nombres como
`b`, `aU` o `aS`. Se ha mantenido el estilo para no romper la lógica; las
partes nuevas están comentadas.

## Limitaciones conocidas

- El ejecutable no está firmado digitalmente (SmartScreen puede avisar).
- La música usa el sintetizador MIDI de Windows; en equipos sin dispositivo
  MIDI el juego funciona igual, pero en silencio.
- No hay soporte de mando ni de pantalla completa; el juego es de 176×220
  escalado a 3×.

## Créditos y licencia

- Juego original: **SteamHouse** (*Jump Boy*, Java ME / MIDP).
- Port a Java moderno: **OmkarDev** —
  [github.com/OmkarDev/Jump-Boy-Port](https://github.com/OmkarDev/Jump-Boy-Port)
  · [vídeo](https://www.youtube.com/watch?v=P-g7jtyrMc8)
- **Rocket Edited**: arreglo de audio/guardado, escalado, controles,
  icono y empaquetado para Windows.

Distribuido bajo **GNU GPL v3** (ver `LICENSE`). El código fuente completo
está incluido en este paquete para cumplir con la licencia.

---

## English quick start

**Jump Boy — Rocket Edited** is a modern Java port of the SteamHouse mobile
game, packaged as a portable Windows executable.

- Run **`Jump Boy.exe`** (or **`Rocket Edited\Rocket Edited.exe`**).
- No Java installation required: a private Java 17 runtime is bundled.
- Windows 10/11 x64. The exe is unsigned, so SmartScreen may ask for
  “More info → Run anyway”.
- Keys: arrows to move, `Enter`/`Space`/`5` to jump, `Z`/`0` for the extra
  jump, `Q`/`W` for the phone soft keys.
- Save data: `app\res\data\data.bin` (22 bytes).
- Build from source with `build-windows.ps1` and JDK 17+.

Changes: real MIDI playback (the old `AudioSystem` approach could not read
MIDI), working mute switch, crisp adaptive 3×/2× nearest-neighbor scaling,
window/exe icon, crash-proof save handling, Space jump and correct `Z` key
release.

Original game © SteamHouse. Port by OmkarDev. Rocket Edited packaging and
fixes as described above. Licensed under GPL-3.0.
