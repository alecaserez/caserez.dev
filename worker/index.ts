/**
 * Worker del formulario de contacto.
 *
 * El sitio sigue siendo estático: Cloudflare sirve `dist/` como assets y sólo
 * las requests que no matchean un archivo llegan acá. En la práctica eso es
 * únicamente POST /api/contact.
 */

interface EmailBinding {
  send(message: {
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
  }): Promise<unknown>;
}

interface Env {
  EMAIL: EmailBinding;
  /* Destinatario y remitente, definidos como `vars` en wrangler.jsonc. */
  CONTACT_TO: string;
  CONTACT_FROM: string;
  /* Secret del Worker: `wrangler secret put TURNSTILE_SECRET_KEY`. */
  TURNSTILE_SECRET_KEY?: string;
}

const ENDPOINT = '/api/contact';
const MAX_EMAIL = 254;
const MAX_MENSAJE = 5000;

/* Deliberadamente laxo: validar mail con regex a fondo da falsos negativos.
   Lo único que importa es que sea plausible antes de usarlo como Reply-To. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname !== ENDPOINT) {
      return new Response('Not found', { status: 404 });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
    }

    // Con JS el fetch pide JSON; sin JS es un submit nativo y espera HTML.
    const wantsJson = (request.headers.get('accept') ?? '').includes('application/json');

    try {
      const form = await request.formData();
      const email = String(form.get('email') ?? '').trim();
      const mensaje = String(form.get('mensaje') ?? '').trim();
      const honeypot = String(form.get('website') ?? '').trim();

      // Campo trampa: invisible para personas, irresistible para bots.
      // Se responde OK a propósito, para no avisarle al bot que lo detectamos.
      if (honeypot) return respond(wantsJson, 200, 'Gracias, te leo pronto.');

      if (!EMAIL_RE.test(email) || email.length > MAX_EMAIL) {
        return respond(wantsJson, 400, 'Revisá el email: no parece válido.');
      }

      if (!mensaje) {
        return respond(wantsJson, 400, 'Escribí un mensaje antes de enviar.');
      }

      if (mensaje.length > MAX_MENSAJE) {
        return respond(wantsJson, 400, `El mensaje no puede pasar de ${MAX_MENSAJE} caracteres.`);
      }

      /* Falla cerrado: la site key ya viaja en el HTML, así que si falta el
         secret es una config rota, no un sitio sin captcha. Mejor rechazar
         visiblemente que aceptar spam en silencio. */
      if (!env.TURNSTILE_SECRET_KEY) {
        console.error('Falta TURNSTILE_SECRET_KEY: el formulario rechaza todo hasta configurarlo.');
        return respond(wantsJson, 503, 'El formulario está fuera de servicio. Escribime por mail.');
      }

      const token = String(form.get('cf-turnstile-response') ?? '');
      if (!(await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY, request))) {
        return respond(wantsJson, 403, 'No pudimos verificar que no seas un bot. Probá de nuevo.');
      }

      await env.EMAIL.send({
        to: env.CONTACT_TO,
        from: env.CONTACT_FROM,
        replyTo: email, // responder desde el cliente de mail le llega a la persona
        subject: `Contacto desde caserez.dev — ${email}`,
        text: `${mensaje}\n\n—\nDe: ${email}\nEnviado desde el formulario de caserez.dev`,
      });

      return respond(wantsJson, 200, 'Gracias, te leo pronto.');
    } catch (error) {
      console.error('Falló el envío del formulario de contacto:', error);
      return respond(
        wantsJson,
        502,
        'No se pudo enviar el mensaje. Probá de nuevo o escribime directo por mail.'
      );
    }
  },
};

async function verifyTurnstile(token: string, secret: string, request: Request): Promise<boolean> {
  if (!token) return false;

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) body.append('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  });

  const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };

  /* Los códigos ayudan a diagnosticar: `invalid-input-secret` es un secret mal
     cargado, `timeout-or-duplicate` es un token reusado o vencido. */
  if (data.success !== true) {
    console.error('Turnstile rechazó el token:', data['error-codes'] ?? 'sin código');
    return false;
  }

  return true;
}

function respond(wantsJson: boolean, status: number, message: string): Response {
  const ok = status === 200;

  if (wantsJson) {
    return new Response(JSON.stringify({ ok, message }), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  return new Response(htmlPage(ok, message), {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

/* Respuesta para el caso sin JS, donde el form hace un submit nativo. */
function htmlPage(ok: boolean, message: string): string {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${ok ? 'Mensaje enviado' : 'No se pudo enviar'} — caserez.dev</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 18px;
        padding: 64px 24px;
        background: #0d0e10;
        color: oklch(0.84 0.01 250);
        font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 15px;
        line-height: 1.8;
        box-sizing: border-box;
      }
      main { width: 100%; max-width: 740px; margin: 0 auto; }
      p { margin: 0 0 18px; }
      a { color: oklch(0.9 0.008 250); }
    </style>
  </head>
  <body>
    <main>
      <p>${escapeHtml(message)}</p>
      <p><a href="/">← Volver a caserez.dev</a></p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
