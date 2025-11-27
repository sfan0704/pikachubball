# Auth Validation Plan - Fantasy Basketball App

## Overview
This document maps all authentication flows, user journeys, error states, and testing strategies to ensure the auth system is bug-free.

---

## 1. AUTHENTICATION FLOWS

### 1.1 Basic Account Authentication (Local Auth)

**Signup Flow:**
```
User Input → Frontend Form
     ↓
POST /api/auth/signup
├─ Validation: username + password schema
├─ Check: username not already taken
├─ Hash: password with bcrypt
├─ Store: user in DB
├─ Auto-login: req.login()
└─ Response: user object (no password hash)

Result: User should be logged in immediately
Session: HttpOnly cookie created automatically
```

**Login Flow:**
```
User Input → Frontend Form
     ↓
POST /api/auth/login
├─ Passport local strategy
├─ Check: username exists
├─ Verify: password matches hash
├─ Create: session
└─ Response: user object

Result: User authenticated
Session: HttpOnly cookie created
```

**Logout Flow:**
```
POST /api/auth/logout
├─ req.logout() - destroys session
├─ Clear: queryClient cache (TanStack Query)
└─ Response: { success: true }

Result: User unauthenticated, redirected to login
```

**Session Check:**
```
GET /api/auth/me
├─ Check: req.isAuthenticated()
├─ If yes: return user (no password)
└─ If no: 401 error

Frontend: Called on page load to restore auth state
```

---

### 1.2 Yahoo Fantasy OAuth Flow

**Step 1: User Adds Yahoo Credentials (Settings)**
```
POST /api/settings/yahoo-credentials
├─ Body: { clientId, clientSecret }
├─ Validate: both fields required
├─ Encrypt: AES-256-GCM
├─ Store: in DB for authenticated user
└─ Response: success

User can now proceed to Yahoo OAuth
```

**Step 2: Generate Yahoo Auth URL**
```
GET /api/auth/yahoo/url (requireAuth)
├─ Fetch: user's encrypted Yahoo credentials
├─ Decrypt: clientId (clientSecret not used here)
├─ Generate: CSRF state token
├─ Store: state in memory (10 min expiry)
└─ Return: authorization URL with state param

Frontend: Opens this URL in new window/browser
```

**Step 3: Yahoo Redirects Back (OAuth Callback)**
```
GET /api/auth/yahoo/callback?code=<code>&state=<state>
├─ Validate: state parameter (CSRF protection)
│  └─ Check: state exists + not expired
│  └─ Delete: state from store (one-time use)
├─ Validate: authorization code exists
├─ Fetch: user's Yahoo credentials (must be logged in)
├─ Decrypt: clientId + clientSecret
├─ Exchange: code for tokens
│  ├─ POST to Yahoo token endpoint
│  ├─ Get: accessToken, refreshToken, expiresIn
│  └─ Calculate: expiresAt (now + expiresIn)
├─ Store: encrypted tokens in DB
└─ Redirect: to app with ?yahoo_connected=true

User: Can now see their Yahoo leagues
```

**Step 4: Use Yahoo Token for API Calls**
```
GET /api/yahoo/leagues (requireAuth)
├─ Fetch: user's Yahoo token from DB
├─ Check: token exists
├─ Check: token not expired
│  └─ If expired: automatically refresh
├─ Set: credentials on MCP client
├─ Call: Yahoo Fantasy API
└─ Return: league data

Note: Token refresh happens automatically via getValidAccessToken()
```

**Step 5: Token Refresh**
```
When token expired:
├─ Use: refresh token
├─ POST: to Yahoo token endpoint
├─ Get: new accessToken + refreshToken
├─ Store: updated tokens in DB
└─ Retry: original API call

User: Seamless experience, refresh hidden
```

---

### 1.3 Credential Management Flows

**Add/Update OpenAI Credentials:**
```
POST /api/settings/openai-credentials (requireAuth)
├─ Body: { apiKey }
├─ Validate: required
├─ Encrypt: AES-256-GCM
├─ Store: in DB
└─ Response: success
```

**Get Credential Status:**
```
GET /api/settings/yahoo-credentials (requireAuth)
├─ Fetch: user's Yahoo credentials
└─ Return: { hasCredentials: bool, updatedAt: timestamp }

GET /api/auth/yahoo/status (requireAuth)
├─ Fetch: Yahoo token
└─ Return: { hasCredentials, connected, hasValidToken }
```

**Delete Credentials:**
```
DELETE /api/settings/yahoo-credentials (requireAuth)
├─ Delete: encrypted credentials from DB
├─ Delete: Yahoo token from DB
└─ Response: success

DELETE /api/auth/yahoo (requireAuth)
├─ Delete: Yahoo token only
└─ Response: success
```

---

## 2. CRITICAL STATE TRANSITIONS

### Valid User States:
```
1. Not Authenticated
   ├─ Can: signup, login
   └─ Cannot: access protected routes

2. Authenticated (Local)
   ├─ Can: access /api/auth/me, logout
   ├─ Can: manage credentials
   ├─ Cannot: fetch Yahoo data without Yahoo credentials + token

3. Authenticated + Yahoo Credentials Set
   ├─ Can: initiate Yahoo OAuth
   └─ Cannot: see leagues until OAuth complete

4. Authenticated + Yahoo Connected
   ├─ Can: fetch leagues, rankings, matchups
   ├─ Can: chat with AI
   └─ Automatic token refresh on expiry

5. Authenticated + OpenAI Key Set
   ├─ Can: use chat features
```

### Invalid State Transitions (Should error):
```
✗ Unauthenticated user tries: /api/yahoo/leagues
  → 401 error, redirect to login

✗ Yahoo credentials not set, tries: GET /api/auth/yahoo/url
  → 400 error: "Yahoo credentials not configured"

✗ OAuth callback without session
  → 401 error: redirect to login

✗ Stale OAuth state token
  → 400 error: "invalid_state"

✗ Expired Yahoo token, no refresh token
  → Should refresh automatically OR 401 error
```

---

## 3. ERROR SCENARIOS TO TEST

### Authentication Errors:
```
Signup:
  ✓ Empty username → 400 (validation error)
  ✓ Empty password → 400 (validation error)
  ✓ Password too short → 400 (validation error)
  ✓ Username already exists → 400 (username taken)
  ✓ Database error → 500 (server error)

Login:
  ✓ Username doesn't exist → 401 (auth failed)
  ✓ Wrong password → 401 (auth failed)
  ✓ Empty credentials → 401 (auth failed)

Logout:
  ✓ Not authenticated → should still work (no-op)
  ✓ Session cleared → can't access protected routes after
```

### Yahoo OAuth Errors:
```
URL Generation:
  ✓ Not authenticated → 401 error
  ✓ No Yahoo credentials → 400 error
  ✓ Credentials missing clientId → 400 error
  ✓ Credentials missing clientSecret → 400 error

Callback:
  ✓ Missing code parameter → redirect to error page
  ✓ Missing state parameter → redirect to error page
  ✓ Invalid state (not in store) → redirect to error page
  ✓ Expired state (>10 min old) → redirect to error page
  ✓ User not authenticated in session → redirect to error page
  ✓ Code exchange fails (bad credentials) → redirect to error page
  ✓ Code exchange fails (network error) → redirect to error page
  ✓ Token storage fails → 500 error
```

### Credential Management Errors:
```
Save Credentials:
  ✓ Not authenticated → 401 error
  ✓ Empty clientId → 400 error
  ✓ Empty clientSecret → 400 error
  ✓ Storage fails → 500 error

Delete Credentials:
  ✓ Not authenticated → 401 error
  ✓ Already deleted → should succeed (idempotent)
```

---

## 4. SESSION & SECURITY TESTS

### Session Management:
```
✓ Session created after login
  └─ HttpOnly cookie set
  └─ Cannot be accessed by JavaScript

✓ Session persisted across page reloads
  └─ /api/auth/me returns user (not 401)

✓ Session destroyed on logout
  └─ /api/auth/me returns 401 after logout
  └─ Cannot access protected routes

✓ Session timeout (if implemented)
  └─ After X minutes, /api/auth/me returns 401
```

### CSRF Protection:
```
✓ OAuth state is random
  └─ Each auth URL request generates new state

✓ State is one-time use
  └─ Same state cannot be reused
  └─ Callback with same state twice → fails 2nd time

✓ State expires after 10 minutes
  └─ Stale callback → error

✓ State cleanup
  └─ Expired states removed from memory (every 5 min)
```

### Encryption:
```
✓ Yahoo credentials encrypted before storage
  └─ Decrypted only when needed
  └─ Never logged or exposed in responses

✓ OpenAI API key encrypted before storage
  └─ Same encryption as Yahoo credentials

✓ Password hashed with bcrypt
  └─ Never stored in plaintext
  └─ Cannot be recovered (only verified)

✓ Tokens encrypted in database
  └─ Access/refresh tokens never exposed
```

---

## 5. TOKEN REFRESH SCENARIO

### Automatic Refresh:
```
Scenario: User's access token expired during app usage

1. User clicks "See Leagues" button
2. Frontend calls: GET /api/yahoo/leagues
3. Backend checks: token.expiresAt < now?
4a. YES → Refresh:
   ├─ Call: getValidAccessToken(userId)
   ├─ Use: refresh token to get new access token
   ├─ Store: new token in DB
   ├─ Retry: original Yahoo API call
   └─ Return: fresh data to user (seamless)

4b. NO → Use existing token
   └─ Return: data

User Experience: No delay, no errors (transparent refresh)
```

### Edge Cases:
```
✓ Refresh token also expired
  └─ User must reconnect Yahoo account
  └─ Offer: "Please reconnect your Yahoo account"

✓ Network error during refresh
  └─ Retry logic?
  └─ Or fail gracefully?

✓ Yahoo rejects refresh token
  └─ Invalid token → 400 error
  └─ User must reconnect
```

---

## 6. INTEGRATION TEST CHECKLIST

### Frontend + Backend Flow Tests:

```typescript
[ ] User can signup with valid credentials
    └─ Sent to dashboard, authenticated immediately

[ ] User can login after signup
    └─ Logout, then login again with same credentials

[ ] User cannot login with wrong password
    └─ Shows error message, stays on login page

[ ] Session persists across page reload
    └─ Close browser, reopen app, still logged in

[ ] Logout clears session
    └─ After logout, /api/auth/me returns 401

[ ] Yahoo OAuth flow (happy path)
    ├─ User adds Yahoo credentials
    ├─ User clicks "Connect Yahoo"
    ├─ Authorize on Yahoo (or mock)
    ├─ Callback received
    ├─ Token stored
    └─ User can see leagues

[ ] Yahoo OAuth state validation
    ├─ Old state token rejected
    ├─ Tampered state rejected
    ├─ Same state cannot be reused

[ ] Protected routes require auth
    ├─ /api/yahoo/leagues requires login
    ├─ /api/viz/matchup requires login
    ├─ Returns 401 when not authenticated

[ ] Token refresh happens transparently
    ├─ Mock: token expiry
    ├─ Make API call
    ├─ Token should refresh automatically
    ├─ Original call succeeds

[ ] Invalid/expired Yahoo token
    ├─ User gets error: "Please reconnect Yahoo"
    ├─ User can click to reconnect
```

---

## 7. UI/UX VALIDATION

### Error Messages (User Sees):
```
Signup:
  ✓ "Username already taken" → input validation
  ✓ "Password too short" → input validation
  ✓ "Failed to create account" → server error

Login:
  ✓ "Invalid username or password" → auth failed

Yahoo OAuth:
  ✓ "Please add Yahoo credentials in Settings first"
  ✓ "Yahoo connection successful!"
  ✓ "Please reconnect your Yahoo account"

General:
  ✓ Clear, non-technical language
  ✓ Actionable next steps
```

### Loading States:
```
✓ Login button shows loading spinner during login
✓ Yahoo connect button shows loading spinner
✓ Cannot double-submit forms
✓ Proper error display on failure
```

### Redirects:
```
✓ After login → dashboard (or intended page)
✓ Yahoo OAuth callback → dashboard with ?yahoo_connected=true
✓ After logout → login page
✓ Accessing /api/auth/me while not authenticated → login page
```

---

## 8. TESTING STRATEGY

### Unit Tests (Backend):
```typescript
tests/backend/unit/auth/

[ ] yahoo-auth.ts
    ✓ generateState() creates random state
    ✓ validateState() validates and deletes state
    ✓ State expiry after 10 minutes
    ✓ State cleanup (expired states removed)
    ✓ getAuthorizationUrl() creates correct URL
    ✓ getValidAccessToken() checks expiry
    ✓ Token refresh logic

[ ] auth-routes.ts (signup, login, logout, /api/auth/me)
    ✓ Password hashing
    ✓ User creation
    ✓ Duplicate username check
    ✓ Login validation
    ✓ Session creation
    ✓ Logout clears session
    ✓ Password not sent in response

[ ] auth middleware
    ✓ requireAuth blocks unauthenticated users
    ✓ getAuthenticatedUserId() returns correct ID
```

### Integration Tests (API):
```typescript
tests/backend/integration/api/

[ ] auth-endpoints.test.ts
    ✓ POST /api/auth/signup - happy path
    ✓ POST /api/auth/signup - duplicate user
    ✓ POST /api/auth/signup - invalid input
    ✓ POST /api/auth/login - correct credentials
    ✓ POST /api/auth/login - wrong password
    ✓ POST /api/auth/logout - clears session
    ✓ GET /api/auth/me - authenticated user
    ✓ GET /api/auth/me - unauthenticated user

[ ] yahoo-oauth-endpoints.test.ts
    ✓ GET /api/auth/yahoo/url - requires credentials
    ✓ GET /api/auth/yahoo/url - generates URL with state
    ✓ GET /api/auth/yahoo/callback - validates state
    ✓ GET /api/auth/yahoo/callback - exchanges code
    ✓ GET /api/auth/yahoo/callback - stores token
    ✓ GET /api/auth/yahoo/callback - state reuse blocked
    ✓ GET /api/auth/yahoo/status - returns token status

[ ] credential-endpoints.test.ts
    ✓ POST /api/settings/yahoo-credentials - saves encrypted
    ✓ GET /api/settings/yahoo-credentials - returns status only
    ✓ DELETE /api/settings/yahoo-credentials - removes credentials
    ✓ POST /api/settings/openai-credentials - saves encrypted
```

### Frontend Component Tests:
```typescript
tests/frontend/components/

[ ] LoginForm
    ✓ Renders username/password inputs
    ✓ Validates empty fields
    ✓ Shows error on login failure
    ✓ Shows loading state during submit
    ✓ Calls login() from useAuth on submit

[ ] SignupForm
    ✓ Renders username/password inputs
    ✓ Validates input
    ✓ Shows error on signup failure
    ✓ Auto-logs in on signup success

[ ] AuthContext
    ✓ Fetches current user on mount
    ✓ login() mutation works
    ✓ signup() mutation works
    ✓ logout() mutation works
    ✓ User state updates on success
    ✓ Clears cache on logout
```

### E2E Tests (Playwright):
```typescript
tests/e2e/auth/

[ ] signup-and-login.spec.ts
    ✓ New user signs up
    ✓ Redirected to dashboard
    ✓ Can logout
    ✓ Can login again

[ ] yahoo-oauth.spec.ts
    ✓ Add Yahoo credentials in settings
    ✓ Initiate OAuth (navigate to URL)
    ✓ Mock Yahoo authorization
    ✓ Callback received and processed
    ✓ Token stored, user can see leagues

[ ] session-persistence.spec.ts
    ✓ Login
    ✓ Reload page
    ✓ Still logged in
    ✓ Can access protected routes

[ ] error-scenarios.spec.ts
    ✓ Wrong password on login
    ✓ Duplicate username on signup
    ✓ Access protected route without auth
    ✓ OAuth without credentials
    ✓ Stale OAuth state
```

---

## 9. KNOWN EDGE CASES TO TEST

1. **Concurrent Requests**: User makes 2+ API calls simultaneously
   - Both should not interfere
   - Token refresh shouldn't break concurrent calls

2. **Fast Logout-Login**: User logs out then logs back in quickly
   - Session should be completely fresh
   - No stale data in cache

3. **Multiple Tabs**: User opens app in 2 browser tabs
   - Logout in one tab → other tab should notice
   - Token refresh in one tab → other tab should still work

4. **Network Errors**: Network fails during OAuth callback
   - Should show clear error
   - User can retry

5. **Yahoo API Changes**: Yahoo adds/removes scopes or endpoints
   - Should fail gracefully, not crash app

6. **Very Long Credentials**: User enters extremely long clientSecret
   - Should handle without buffer overflow
   - Encryption/decryption should work

---

## 10. QUICK REFERENCE: EXPECTED API RESPONSES

### Successful Responses:
```
POST /api/auth/signup (201)
{ "user": { "id": "123", "username": "john" } }

POST /api/auth/login (200)
{ "user": { "id": "123", "username": "john" } }

POST /api/auth/logout (200)
{ "success": true }

GET /api/auth/me (200)
{ "user": { "id": "123", "username": "john" } }

GET /api/auth/yahoo/url (200)
{ "authUrl": "https://api.login.yahoo.com/..." }

GET /api/auth/yahoo/status (200)
{ "hasCredentials": true, "connected": true, "hasValidToken": true }
```

### Error Responses:
```
401 Unauthorized
{ "error": "Authentication required" }

400 Bad Request
{ "error": "Yahoo credentials not configured. Please add your Yahoo Client ID and Secret in Settings first." }

400 Bad Request (Validation)
{ "error": "Invalid input", "details": [...] }

500 Server Error
{ "error": "Failed to create account" }
```

---

## 11. RECOMMENDED TESTING ORDER

1. **Start with unit tests** for password hashing, state generation, token validation
2. **Then integration tests** for individual endpoints
3. **Then auth flow tests** for complete signup → login → logout cycle
4. **Then Yahoo OAuth** tests with mocked Yahoo responses
5. **Then session/security** tests
6. **Finally E2E** tests with real browser automation

This ensures foundation is solid before testing complex flows.
