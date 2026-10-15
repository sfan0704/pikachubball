-- Explicit metadata projection: never SELECT * or client_secret.
select identifier, provider_type as "providerType", issuer, enabled,
  pkce_enabled as "pkceEnabled", skip_nonce_check as "skipNonceCheck", scopes
from auth.custom_oauth_providers order by identifier;
