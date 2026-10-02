// Set at build time with `ng build --define "NG_APP_API_URL='https://api.example.com'"`
// (the frontend Docker image passes its API_URL build arg). Without it the
// build falls back to the local backend.
declare const NG_APP_API_URL: string | undefined;

export const environment = {
  production: true,
  apiUrl:
    typeof NG_APP_API_URL === 'string'
      ? NG_APP_API_URL
      : 'http://localhost:8000',
};
