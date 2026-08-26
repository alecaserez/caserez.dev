# caserez.dev

Sitio personal. Astro estático, sin JS de cliente, desplegado en Cloudflare Pages.

El diseño viene del proyecto de Claude Design `caserez.dev - Home.dc.html`.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # astro check + build → dist/
npm run preview  # sirve dist/
```

## Conductor

`.conductor/settings.toml` define los scripts del workspace:

- **setup** — `npm ci` (o `npm install` si no hay lockfile) + `astro sync`, para que
  `astro check` y el editor tengan los tipos generados desde el primer momento.
- **dev** (por defecto) — `astro dev` en `$CONDUCTOR_PORT`, con HMR. Arranca solo
  al terminar el setup y el botón *Open* apunta a `http://localhost:$CONDUCTOR_PORT`.
- **preview** — `build` + `astro preview`, para ver el sitio como lo sirve Cloudflare Pages.
- **check** — `astro check`.

`run_mode = "concurrent"`: el sitio es estático, sin base de datos ni puertos fijos,
así que varios workspaces pueden correr a la vez.

Los scripts corren en shells no interactivos (`zsh` local, `bash` en la nube).

## Estructura

```
src/
  pages/index.astro       contenido de la home + estilos de página
  layouts/BaseLayout.astro  <head>, fuentes, metadatos
  components/             Project, Bullet, BracketLink
  styles/global.css       tokens de color (oklch) y estilos base
public/
  favicon.svg
  _headers                cabeceras de Cloudflare Pages
```

`src/pages/index.astro` expone los dos interruptores del diseño original,
`showFrontMatter` y `showToc`, apagados por defecto.

## Deploy en Cloudflare Pages

Sitio 100% estático: no hace falta adapter.

**Git integration** (recomendado) — en el dashboard de Pages:

| Campo | Valor |
| --- | --- |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |

**Manual:**

```bash
npm run deploy   # build + npx wrangler pages deploy dist
```
