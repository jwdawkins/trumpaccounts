/** Public runtime config from Vite env (see .env.example). */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env ${name} — copy web/.env.example to web/.env`);
  return value;
}

export const config = {
  apiUrl: required("VITE_API_URL", import.meta.env.VITE_API_URL),
  region: required("VITE_AWS_REGION", import.meta.env.VITE_AWS_REGION),
  userPoolId: required("VITE_USER_POOL_ID", import.meta.env.VITE_USER_POOL_ID),
  userPoolClientId: required("VITE_USER_POOL_CLIENT_ID", import.meta.env.VITE_USER_POOL_CLIENT_ID),
};
