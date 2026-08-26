/// <reference types="astro/client" />

interface ImportMetaEnv {
  /* Site key pública de Turnstile. Sin ella el formulario anda igual, sin captcha. */
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface Window {
  /* Lo inyecta el script de Turnstile; puede no estar si no hay site key. */
  turnstile?: {
    reset: (widget?: string) => void;
  };
}
