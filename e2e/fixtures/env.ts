/** Where the stack under test listens. Defaults match docker/docker-compose.e2e.yml. */
export const urls = {
  app: process.env.E2E_APP_URL ?? 'http://localhost:4200',
  api: process.env.E2E_API_URL ?? 'http://localhost:8000',
  mailhog: process.env.E2E_MAILHOG_URL ?? 'http://localhost:8025',
};
