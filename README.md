# Vanguard Mobile (`mobile-vanguard`)

Vanguard Security Mobile Application — Built with React Native & Expo SDK 57, delivering Zero-Trust Identity, SSO Application Launchpad, and Authenticator Vault capabilities for iOS, Android, and Web.

> **Note (SCRUM-129):** 1-tap "Sign in with SSO" is temporarily **unavailable**.
> The previous implementation fabricated a local authenticated session for a
> hardcoded identity with no server verification; that bypass has been removed.
> Real mobile SSO (authorization-code + PKCE) is deferred to the mobile
> qualification milestone (C2 / SCRUM-139). Sign in with email + password.

---

## 🛠️ Prerequisites & Requirements

- **Node.js**: `v20.x` or `v22.x`+ (LTS recommended, tested on `v24.19.x`)
- **Package Manager**: `npm` (v10+)
- **Expo CLI**: bundled via `npx expo`
- **Mobile Platforms**:
  - iOS Simulator (macOS + Xcode) or Physical Device via Expo Go
  - Android Emulator (Android Studio SDK) or Physical Device via Expo Go
  - Web Browser (Chrome, Firefox, Safari, Edge)

---

## ⚙️ Environment Configuration

The application is configured to connect directly to the live deployed Vanguard backend API on Render:

| Variable | Description | Production Default |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Vanguard Identity Provider backend URL | `https://backend-vanguard.onrender.com` |

*Note: The mobile application authoritatively connects to `https://backend-vanguard.onrender.com`. All authentication, pairing, and out-of-band push MFA challenges synchronize with this authoritative cloud service.*

---

## 📱 Mobile & Devices Hub & Ecosystem SSO Verification (SCRUM-182)

### 1. Production Authentication & Zero-Hardcoded Policy
- **Authoritative Backend Authentication**: Users authenticate with real credentials against the deployed Vanguard backend (`https://backend-vanguard.onrender.com/auth/login`).
- **Unified Login Credentials**: Simplified single login credential form for all account types. The system automatically identifies company workspaces or personal vaults upon authentication without redundant manual selector tabs.
- **Account Type Architecture**:
  - 🏢 **Company Account**: Enterprise Single Sign-On, workplace applications catalog, employee corporate directory, and device compliance tracking.
  - 👤 **Individual Vault**: Zero-knowledge encrypted personal vault, private 2FA authenticators, personal notes, and bookmarks.
- **Remember Email & Password Security**: Remembers user email securely across launches via `@react-native-async-storage/async-storage` (`vanguard_remembered_email`) with password visibility toggle.

### 2. Testing Environment & Native Mobile Connectivity
- **Native Android / iOS Device or Emulator (Recommended)**: Runs within Expo Go or a native build. Native network runtimes do not send browser `Origin` headers and are not subject to web browser CORS sandbox restrictions, connecting directly to `https://backend-vanguard.onrender.com`.
- **Local Web Browser Preview (`npm run web` / `localhost:8082`)**: When previewing the React Native Web build in a desktop browser, web browsers attach `Origin: http://localhost:8082`. The production backend on Render restricts CORS to production client domains (`https://vanguard-security.pages.dev`). For backend connectivity testing, use Expo Go on a physical phone/emulator or test against the live deployment.

### 3. Mobile & Devices Hub (`src/screens/devices-screen.tsx`, `/devices`)
- **Zero-Trust Hardware Attestation**: Evaluates device platform (`Android` / `iOS`), real biometric sensor availability (`Face ID`, `Touch ID`, `Fingerprint`) via `expo-local-authentication`, and hardware-backed AES-256-GCM Secure Enclave / Keystore integrity.
- **Web Dashboard Pairing (QR Scanner & Pairing Key - SCRUM-185)**:
  - Open Vanguard Web Dashboard (`https://vanguard-security.pages.dev`) -> Navigate to **Account Security** / **Mobile & Devices** -> Click **Pair Vanguard Mobile Authenticator** to display the QR code and Pairing Key (`VG-XXXX-XXXX`).
  - Tap **Scan Mobile Integration QR** (`expo-camera`) on the mobile Devices tab to scan the QR payload (`JSON`, `vanguard-enroll://`, or `VG-XXXX-XXXX` key) or enter the Pairing Key manually.
  - Validates account email alignment, registers device trust (`POST /oauth/devices/pair`), and enables push MFA on the authoritative backend (`POST /oauth/mfa/push/preference`).
- **Real-Time Out-of-Band Push MFA**:
  - Background polling listener (`GET /oauth/mfa/push/pending?email=...`) captures out-of-band SSO verification requests dispatched when signing in from **Acme Dummy Web** (`https://vanguard-dummy-web.pages.dev`).
  - Interactive **2-digit number matching challenge** modal prevents MFA fatigue attacks.
  - Requires biometric approval (Face ID / Fingerprint) before signing and submitting approval (`POST /oauth/mfa/push/respond`).
- **Device Management**: 1-tap "Unlink Companion Device" action safely deregisters the device and clears local session tokens.

### 4. Cross-Platform Application & Authenticator Synchronization (SCRUM-182)
- **Responsive Layout & Overflow Prevention**:
  - Authenticator empty states and action bars utilize vertical flex wrapping (`flexDirection: 'column'`, full-width buttons), eliminating horizontal button clipping and screen overflows on compact mobile screens.
  - The `+ Add Authenticator Token` action features a dedicated full-width responsive row beneath the token rotation progress bar for seamless tap ergonomics.
- **My Applications Feature Parity**:
  - Dual action buttons: `+ Add Application` (Primary for both personal and company workspaces) and `Request Enterprise Access` (Secondary for enterprise catalog access).
  - Add Application modal supports complete credential autofill parameters (Application Name, URL, Category, Icon, Description, Auto-Fill Username/Email, and Auto-Fill Password).
  - Application cards display `✓ Approved`, `⚡ Auto-fill Ready`, and `🔑 Account: <username>` badges with cross-workspace delete capability.
- **Authoritative Identity-Scoped Data Synchronization**:
  - Applications and access requests are strictly scoped per authenticated user email (`@vanguard_personal_apps_<email>`, `@vanguard_enterprise_apps_<email>`, `@vanguard_access_requests_<email>`).
  - Active enterprise apps synchronize against the backend employee launchpad (`GET https://backend-vanguard.onrender.com/apps/my`).
  - Self-service personal applications synchronize bidirectionally across mobile and web via `GET/POST/PATCH/DELETE /apps/personal` (replacing legacy admin-only `/apps` routes).
  - Connected SSO OIDC applications synchronize authoritatively via `GET/DELETE /oauth/connected-apps` using `Authorization: Bearer <token>`.
  - 2FA TOTP Authenticator accounts synchronize bidirectionally with server-side AES-256-GCM encryption via `GET/POST/PATCH/DELETE /totp-accounts` (while remaining cached locally in hardware-backed secure keychain storage for offline access).
  - Automatic background watermark coordinator (`GET /sync/state`, 5s interval + app foreground resume) reconciles additions, updates, and server-authoritative deletions without full payload polling.
  - Access requests automatically sync with backend governance endpoints (`GET /apps/access-requests`, `POST /apps/access-requests`, `DELETE /apps/access-requests/:id`, `POST /apps/access-requests/:id/approve`, `POST /apps/access-requests/:id/reject`).
  - Authenticator vault payloads are scoped to the active user's identity (`@vanguard:encrypted_totp_vault_<email>`), ensuring zero confusion across multiple user accounts and complete alignment with web frontend state.

### 5. Production Cloud Connectivity
- **Deployed Backend Integration**: Every authentication challenge, device pairing verification, and push MFA response is securely submitted to `https://backend-vanguard.onrender.com`.
- **Extended Warm-Up Tolerance**: Network timeout handlers allocate 30 seconds to gracefully accommodate cloud spin-up latency on server cold starts without aborting verification requests prematurely.

### 6. Billing Isolation, Free-Tier Quotas, No-Charge Restore & Receipts (SCRUM-185, SCRUM-189)
- **Bidirectional Subscription Synchronization**:
  - Subscriptions purchased on the Web Dashboard automatically unlock Unlimited Applications and Unlimited 2FA Authenticator accounts on `mobile-vanguard` via `GET /billing/subscription` and `GET /sync/state` (`billingUpdatedAt` watermark + app foreground `AppState` resume).
  - Subscriptions purchased on Mobile via PayMongo (`expo-web-browser`) trigger backend `SyncService` + Supabase Realtime updates so `frontend-vanguard` reflects Paid features without a manual page reload.
- **Identical Free-Tier Quotas & 3-Role Isolation**:
  - Free accounts (`Individual Free Starter` and `Company Free Trial`) enforce max **1 integrated application** and max **3 third-party 2FA accounts**, rolling back `403 billing_limit_reached` server rejections cleanly.
  - **Individual** users see Personal plans (`Free Starter`, `Personal Pro $5/mo`), **Company Admins** see Organization plans (`Company Free Trial`, `Business Pro $29/mo`, `Enterprise $79/mo`), and **Tenant Employees** see a read-only **Managed by Company Administrator** status panel that unlocks automatically when their Admin upgrades.
- **No-Charge Restore & Registered-Email Vanguard Receipts (`POST /billing/resume`, `POST /billing/receipts/resend`, SCRUM-189)**:
  - Downgrading to Free preserves active `paidCredit` until `paidUntil`; re-upgrading to the same or lower paid tier shows **Restore `<Plan>` ($0 — Paid until `<date>`)** without launching PayMongo checkout.
  - **Official Vanguard Purchase Receipts** in `BillingModal` display `VG-RCPT-*` receipt numbers, `Sent to Registered Email` destination, optional separate PayMongo checkout email, and a **Send Receipt to Registered Email** action.

### 7. Native Relying-Party SSO Handoff (`vanguard-auth://oauth/authorize`, SCRUM-188)
- **Incoming Deep-Link Interception**: `RootNavigator` (`src/app/_layout.tsx`) listens for `vanguard-auth://oauth/authorize?...` and `mobilevanguard://oauth/authorize?...` deep links via `expo-linking` (`Linking.getInitialURL` and `Linking.addEventListener('url', ...)`) using `parseOAuthAuthorizeDeepLink` (`src/utils/oauth-deeplink.ts`).
- **Consent & Approval Modal**: `SsoConsentModal` (`src/components/cyber/sso-consent-modal.tsx`) shows the requesting app's name, `client_id`, `redirect_uri`, and scopes. Signed-in users can approve natively (`AuthService.approveOAuthAuthorization` -> `POST /oauth/approve` on `https://backend-vanguard.onrender.com`) and redirect back to the calling app (e.g., `vanguard-dummy://oauth/callback?code=...&state=...`), sign in on mobile first, deny (`error=access_denied`), or continue in the deployed Vanguard Web Portal (`https://vanguard-security.pages.dev/login`).

---

## 📦 Installation & Setup

1. **Navigate to Repository**:
   ```bash
   cd mobile-vanguard
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

   *Core Dependencies included:*
   - `expo`: `~57.0.24`
   - `expo-camera`: `~57.0.6` (Mobile Integration QR pairing scanner)
   - `expo-router`: `~57.0.22`
   - `expo-local-authentication`: `~57.0.2`
   - `expo-secure-store`: `~57.0.4`
   - `expo-web-browser`: `~57.0.3`
   - `expo-linking`: `~57.0.10`
   - `expo-clipboard`: `~57.0.2`
   - `otpauth`: `^9.5.2`
   - `react-native-svg`: `~15.11.2`
   - `@react-native-async-storage/async-storage`: `2.2.0`
   - `react-native`: `0.86.3`
   - `react`: `19.2.3`

---

## 🚀 Running the Application

### Development Server & Bundler
Start the Metro bundler:
```bash
npm start
# or
npx expo start --port 8082
```

### Physical Mobile Device via Expo Go
To test on a physical iOS or Android phone using **Expo Go**:
1. **Install Expo Go** from Google Play Store or Apple App Store.
2. **Connect to Same Network**: Ensure your mobile device is on the same local Wi-Fi network as your workstation (PC IP: `192.168.1.13`).
3. **Launch Bundler**:
   ```bash
   npm start
   ```
4. **Scan QR Code**:
   - **Android**: Scan the terminal QR code using the Expo Go app.
   - **iOS**: Scan the terminal QR code using the default Camera app and tap the Expo Go prompt.

#### 🔧 Troubleshooting Expo Go Connectivity
- **Stuck on Splash Screen Fix**: The application incorporates a dedicated `SplashScreen.hideAsync()` lifecycle in `_layout.tsx` that dismisses the native splash screen immediately when session initialization completes (with a 2.5s failsafe timeout), ensuring the login interface renders on mobile devices.
- **Port Conflict**: The bundler runs on port `8082` (`expo start --port 8082`) to avoid colliding with `dummy-mobile` (:8081).
- **Wi-Fi Isolation / Dynamic IP Fallback (Tunnel Mode)**: If your local Wi-Fi router isolates clients or your PC's IP changed, launch Expo in Tunnel mode to bypass local network restrictions:
  ```bash
  npx expo start --tunnel --port 8082
  ```

### 🌐 Production Deployment (Cloudflare Pages Web & Mobile)

#### 1. Web Version (Cloudflare Pages)
The mobile app can be compiled to an optimized static Progressive Web App and hosted on Cloudflare Pages:
```bash
# 1. Export production static web assets
npm run build:web
# Output generated in ./dist/

# 2. Deploy to Cloudflare Pages (Direct upload or Git integration)
# Build command: npm run build:web
# Build output directory: dist
# Environment variable: EXPO_PUBLIC_API_URL=https://backend-vanguard.onrender.com
npx wrangler pages deploy dist --project-name vanguard-mobile
```

#### 2. Physical Mobile Testing with Production Backend
To test on real iOS/Android devices connected to the live Render backend:
```bash
# Launch Expo Go with Tunnel mode pointing to production Render backend:
EXPO_PUBLIC_API_URL=https://backend-vanguard.onrender.com npx expo start --tunnel --port 8082
```

#### 3. Standalone Android APK Build (`eas build` / `npx expo run:android`)
The application is pre-configured with Android package identifier `com.vanguard.security.mobile`, required permissions (`INTERNET`, `CAMERA`, `USE_BIOMETRIC`, `USE_FINGERPRINT`, plus iOS `NSCameraUsageDescription` and `NSFaceIDUsageDescription`), and URI schemes (`vanguard-auth`, `vanguard-enroll`, `mobilevanguard`):

- **Supabase Redirect URLs (required for Google OAuth in APK):** In Supabase Dashboard → **Authentication** → **URL Configuration** → **Redirect URLs**, ensure `mobilevanguard://login`, `mobilevanguard://**`, and `https://vanguard-security.pages.dev/auth/mobile-callback` are allowlisted so Google Sign-In returns directly to the installed APK instead of falling back to the web portal.

```bash
# 1. Install EAS CLI globally if not already present
npm install -g eas-cli

# 2. Log in to your Expo account
eas login

# 3. Configure and build production Android APK
eas build -p android --profile preview
# Generates a standalone installable .apk file connected to https://backend-vanguard.onrender.com

# Alternatively, for local Android Studio native build:
npx expo run:android --variant release
```

### Platform-Specific Launch Targets
- **Web Preview (Port 8082)**:
  ```bash
  npm run web
  # Launches on http://localhost:8082 to avoid conflicting with dummy-mobile (:8081)
  ```
- **Android Emulator / Device**:
  ```bash
  npm run android
  ```
- **iOS Simulator**:
  ```bash
  npm run ios
  ```

---

## 🧪 Testing & Code Quality

### Automated Test Suites
Run the full automated test suite verifying authentication, OTP/TOTP two-step verification, registration architecture, sign out workflow, data models, UI components, SSO integrations, personal apps, enterprise requests, browser launchers, Authenticator Vault, AES-GCM encryption, hardware keychain storage, offline RFC 6238 TOTP calculation, countdown warning shifts, native biometric authentication, out-of-band push MFA approval with number matching, AppState auto-locking, zero-hardcoded dashboard state, and end-to-end workflows (176 automated tests passing with 0 failures):
```bash
npm test
```

#### Test Suite Breakdown
| Suite File | Scope & Capabilities Verified |
| :--- | :--- |
| `src/__tests__/account-registration-architecture.test.ts` | Personal vs. Company registration enforcement, immutable workspace mode derivation, Company Admin role scoping, employee access request submission with complete dossier metadata, and 1-tap Approve/Reject review workflow (SCRUM-84) |
| `src/__tests__/zero-hardcoded-dashboard.test.ts` | Zero hardcoded dashboard verification, dynamic access request generation without mock identity fallbacks, legacy seed cache auto-purging, and storage integrity (SCRUM-83) |
| `src/__tests__/metadata-name-resolution.test.ts` | Full name derivation from user metadata (`first_name`, `last_name`, `name`, `full_name`, `given_name`, `display_name`) with space-separated title-casing fallback (SCRUM-82) |
| `src/__tests__/push-mfa.test.ts` | Out-of-band push verification modal, rich contextual login metadata (app, IP, location, device, 60s countdown), biometric prompt challenge execution, 2-digit number matching challenge (MFA fatigue protection), deny & fraud reporting, request expiration, live backend polling (`/oauth/mfa/push/pending`), preference sync (`/oauth/mfa/push/preference`), response dispatch (`/oauth/mfa/push/respond`), and offline test harness presets (SCRUM-21 & SCRUM-85) |
| `src/__tests__/biometric-auth.test.ts` | Native biometric authentication (Face ID & Fingerprint) capability detection, biometric prompt challenge execution, device passcode fallback, launch requirement settings persistence, and AppState background/foreground vault auto-locking lifecycle simulation (SCRUM-20) |
| `src/__tests__/offline-totp-generator.test.ts` | Offline RFC 6238 TOTP engine, standard test vector validation against Google Authenticator, circular countdown color shift warnings (Cyan/Amber/Red), Base32 decoding, clock drift tolerance (±1 window), and tap-to-copy code formatting (SCRUM-19) |
| `src/__tests__/secure-vault-keychain.test.ts` | Hardware-backed iOS Keychain & Android Keystore integration (`expo-secure-store`), AES-GCM 256-bit envelope encryption/decryption, zero plaintext secret leakage, mock keychain adapters, and complete CRUD operations (`saveAccount`, `getAccounts`, `getAccountById`, `updateAccount`, `deleteAccount`) (SCRUM-18) |
| `src/__tests__/otp-paste-centering.test.ts` | Digit input horizontal and vertical centering, multi-digit 6-digit/8-digit clipboard paste distribution, and 1-tap clipboard extraction (SCRUM-81) |
| `src/__tests__/authenticator-cyber-theme.test.ts` | Design tokens (`#0a0e17`, `#00e5ff`, `#10b981`, `#6366f1`, glass cards), reusable cyber components, Vault CRUD, RFC 6238 TOTP generation, Base32 validation, and screen navigation transitions (SCRUM-17) |
| `src/__tests__/auth.test.ts` | Supabase database credentials, email/password validation, rejection of unregistered accounts, 2-step MFA challenge |
| `src/__tests__/otp-auth.test.ts` | Email OTP verification, Authenticator TOTP validation, resend cooldown timer, rejection of invalid/bypass codes (SCRUM-79) |
| `src/__tests__/logout-auth.test.ts` | Sign out button touch handling, session clearance, backend `/auth/logout` dispatching, duplicate invocation guards, and unauthenticated root layout gating |
| `src/__tests__/auth-responsiveness.test.ts` | Root layout `isInitializing` isolation preserving MFA submission state, sign out tactile feedback, and splash overlay non-blocking hit testing |
| `src/__tests__/app-navigation.test.ts` | Anchored bottom tab bar layout (`bottom: 0`), pointer pass-through, non-obstructed session header, and Expo Starter banner removal |
| `src/__tests__/apps-data.test.ts` | SaaS app deduplication, connected app deduplication by origin/client ID, category filtering, URL prefix normalization |
| `src/__tests__/apps-ui.test.ts` | Dynamic category counters, vault auto-fill badge computation, live connection indicators, workspace-aware empty states |
| `src/__tests__/connected-apps.test.ts` | Active SSO client discovery, Acme Dummy Web OIDC metadata fixtures, disconnection handling, active client counter badges (SCRUM-64, SCRUM-83) |
| `src/__tests__/personal-app-modal.test.ts` | Quick app presets (Figma, GitHub, Notion, etc.), input validation, protocol formatting, auto-fill domain extraction |
| `src/__tests__/request-app-modal.test.ts` | Enterprise app suggestions, business justification validation, user metadata association, pending request creation |
| `src/__tests__/governance-queue.test.ts` | Zero hardcoded default access requests, governance test fixtures, launch guard enforcement, zero-trust blocked banners (SCRUM-67, SCRUM-83) |
| `src/__tests__/app-launcher.test.ts` | URL normalization, in-app browser dispatching, external linking fallback, personal vault domain matching |
| `src/__tests__/my-apps-screen.test.ts` | Header titles, workspace switching, pull-to-refresh lifecycle, bottom tab navigation triggers |
| `src/__tests__/e2e-workflow.test.ts` | Complete end-to-end user journey across authentication, app addition, enterprise request, SSO launch, and logout |

### Static Analysis & Type Checking
- Run ESLint:
  ```bash
  npm run lint
  ```
- Run TypeScript Type Check:
  ```bash
  npx tsc --noEmit
  ```

---

## 🔒 Zero Hardcoded Dashboard Data Architecture (SCRUM-83)

To ensure strict zero-trust multi-tenant isolation across varying user accounts and prevent mock data contamination on the Mobile Launchpad:

1. **Empty Initial Collections**:
   - `DEFAULT_ENTERPRISE_APPS = []`
   - `DEFAULT_CONNECTED_APPS = []`
   - `DEFAULT_ACCESS_REQUESTS = []`
   - `DEFAULT_VAULT_ITEMS = []`
   - All collections on a fresh profile load completely clean without hardcoded pre-seeded items.
2. **Dynamic Context-Driven Access Requests**:
   - Access request submissions dynamically inject the authenticated user's profile metadata (`currentUser.name`, `currentUser.email`, `currentUser.department`, `currentUser.role`).
   - The user governance queue displays only requests submitted by the logged-in user (`userEmail`).
3. **Legacy Cache Auto-Purge**:
   - `AppsStorageService` automatically filters out legacy demo seed records (such as hardcoded Acme Dummy Web instances, mock requests, or dummy personal vault entries) upon storage read, keeping production devices clean.
4. **Resilient In-Memory Fallback Adapter**:
   - Storage service incorporates an in-memory storage fallback layer, guaranteeing reliable CRUD operations during unit testing and headless execution environments where native storage adapters are unavailable.

---

## 🛡️ Authenticator Vault & Dark Cyber Theme System (SCRUM-17)

The mobile application features a standalone air-gapped **Authenticator Vault** implementing zero-trust local hardware attestation, continuous TOTP code rotation, and a comprehensive cyber dark design system mirroring Vanguard's web identity portal.

### 🎨 Cyber Dark Design Tokens (`src/constants/cyber-theme.ts`)
- **Base Background**: `#0a0e17`
- **Surface Cards**: `#0f172a`, secondary `#131d31`, hover `#1e293b`
- **Cyber Accents**: `#00e5ff` (Cyan), `#10b981` (Emerald), `#6366f1` (Indigo), `#f59e0b` (Amber), `#ef4444` (Red)
- **Glassmorphism**: Translucent card backgrounds (`rgba(15, 23, 42, 0.75)`), subtle borders (`rgba(30, 41, 59, 0.8)`), cyan glows, and layered modals.

### 🧩 Reusable Cyber UI Components (`src/components/cyber/`)
1. **`CyberButton`**: Multi-variant interactive buttons (`primary`, `secondary`, `success`, `danger`, `ghost`, `outline`) with glowing shadows, accessible touch feedback, size presets (`sm`, `md`, `lg`), and loading indicators.
2. **`CyberCard`**: Translucent glassmorphic card containers (`glass`, `default`, `glow`, `accent`, `danger`) with optional header/footer slots and clickability.
3. **`Badge`**: Status and tag badges (`cyan`, `green`, `indigo`, `amber`, `red`, `muted`) with glowing borders and rounded pill geometry.
4. **`StatusIndicator`**: Real-time status LED indicators with pulsating animation loops (`active`, `synced`, `pending`, `offline`, `error`, `warning`).
5. **`ModalHeader`**: Standardized cyber modal and screen header with icon, title, subtitle, status badge, and touchable close trigger.

### 🔑 Authenticator Vault Screens & Navigation
1. **Vault Screen (`src/screens/vault-screen.tsx`)**:
   - Live 6-digit TOTP codes with 30-second rotation countdown bar.
   - One-tap clipboard copy with tactile feedback (`COPIED! ✓`).
   - Real-time search filter by account identifier or service issuer.
   - Quick navigation triggers to Add Account and Security Settings.
2. **Account Detail Screen (`src/screens/account-detail-screen.tsx`)**:
   - Comprehensive token specifications (Algorithm, Digits, Period, Storage).
   - Base32 secret key inspection with toggleable mask (`•••• ••••`) and copy action.
   - Emergency recovery codes preview.
   - Token deletion workflow with confirmation guard.
3. **Add Account Screen (`src/screens/add-account-screen.tsx`)**:
   - **Manual Entry**: Account identifier, issuer, Base32 key validation (RFC 4648), icon selector, and algorithm options (`SHA1`, `SHA256`).
   - **QR Scanner View**: Cyber camera viewfinder simulation with simulated QR barcode decode capability.
4. **Security Settings Screen (`src/screens/security-settings-screen.tsx`)**:
   - Hardware enclave zero-trust attestation diagnostics.
   - Biometrics toggle (Face ID / Touch ID / Fingerprint lock).
   - Inactivity auto-lock selectors (`Instant`, `1 min`, `5 min`, `15 min`).
   - Clipboard auto-clear timeout (`15s`, `30s`, `60s`).
   - Encrypted JSON vault export & emergency factory wipe.
5. **Screen Transitions (`src/screens/authenticator-navigator.tsx`)**:
   - Smooth animated transitions across `VaultScreen` ⇄ `AccountDetailScreen` ⇄ `AddAccountScreen` ⇄ `SecuritySettingsScreen`.

---

## 🔒 Local Secure Vault & Keychain Storage (SCRUM-18)

The Authenticator Vault implements native hardware-backed encrypted storage to secure two-factor TOTP secrets at rest on mobile devices:

### 1. Native Secure Storage & Hardware Protection
- **iOS**: Apple Keychain Services via `expo-secure-store` with hardware security enclave protection.
- **Android**: Android Keystore Provider via `expo-secure-store` with hardware-backed KeyStore encryption (`EncryptedSharedPreferences`).
- **Pluggable Storage Abstraction**: `ISecureStorageProvider` interface with `ExpoSecureStoreAdapter` for native device runtimes and `MockKeychainProvider` for headless unit testing and automated CI verification.

### 2. AES-GCM (256-bit) Encryption Architecture
- **Cipher**: Standard authenticated AES-GCM (`AES-GCM-256`) implemented via `AesGcmService`.
- **Initialization Vector**: Unique cryptographically secure 96-bit (12-byte) IV generated per write via `crypto.getRandomValues()`.
- **Envelope Storage Format**:
  ```json
  {
    "version": "1.0.0",
    "cipher": "AES-GCM-256",
    "iv": "<base64-iv>",
    "ciphertext": "<base64-encrypted-vault-json>",
    "tag": "AES-GCM-AUTH-TAG-VERIFIED",
    "updatedAt": "2026-10-11T23:56:00.000Z"
  }
  ```
- **Zero Plaintext Leaks**: Plaintext secrets and raw master keys are never stored in unencrypted storage (`AsyncStorage`) or emitted to console logs.

### 3. Local Account Schema & CRUD Repository
- **Schema (`TotpAccount`)**:
  - `id`: Unique RFC 4122 UUID v4 identifier.
  - `accountName`: Primary account identifier (e.g. `admin@vanguard.security`).
  - `issuer`: Provider or service name (e.g. `Vanguard`, `GitHub`, `AWS`).
  - `secret`: RFC 4648 Base32-encoded secret key with strict character validation (`[A-Z2-7]`).
  - `algorithm`: Cryptographic hash algorithm (`SHA1`, `SHA256`, or `SHA512`).
  - `digits`: Code length (6 or 8 digits).
  - `period`: Code rotation period (30s).
- **CRUD Operations (`VaultService`)**:
  - `saveAccount(input)`: Generates UUID, validates Base32 secret, and encrypts into hardware vault.
  - `getAccounts()`: Decrypts envelope and returns vaulted TOTP accounts.
  - `getAccountById(id)`: Retrieves a specific vaulted account.
  - `updateAccount(id, updates)`: Updates account metadata or secret with re-encryption.
  - `deleteAccount(id)`: Permanently purges account from encrypted vault.

---

## ⏱️ Offline TOTP Generator Engine & Circular Countdown Visualizer (SCRUM-19)

The Authenticator features an offline RFC 6238 Time-Based One-Time Password (TOTP) generator engine and dynamic circular countdown UI:

### 1. Offline RFC 6238 TOTP Engine (`TotpEngine`)
- **HMAC Algorithms**: Standard RFC 6238 HMAC calculation supporting `SHA1`, `SHA256`, and `SHA512` via `@noble/hashes` (`otpauth`).
- **Standard Test Vectors**: Validated against official RFC 6238 test vectors (e.g. $T=59\text{s} \rightarrow 287082$, $T=1111111109\text{s} \rightarrow 081804$, $T=1234567890\text{s} \rightarrow 005924$) matching standard Google Authenticator and Microsoft Authenticator outputs.
- **Base32 Normalization**: Automatic uppercase conversion, whitespace removal, padding unpadding, and character set validation (`[A-Z2-7]`).
- **Clock Drift Tolerance**: Verification window support ($\pm 1$ step window) guaranteeing seamless code verification during second-boundary rollovers.
- **Zero Latency**: 100% offline generation with zero network requests or external dependencies.

### 2. Animated Circular Countdown Visualizer (`CircularCountdown`)
- **SVG Circular Progress Bar**: Responsive SVG ring rendered via `react-native-svg` counting down clockwise from 30s to 0s based on Unix epoch time steps.
- **Dynamic Color Warning Shift**:
  - `> 10 seconds remaining`: Cyber Cyan (`#00e5ff`)
  - `≤ 10 seconds remaining`: Caution Amber (`#f59e0b`)
  - `≤ 5 seconds remaining`: Urgent Red (`#ef4444`)
- **Tabular Centered Display**: Centered seconds display with tabular numerals (`tabular-nums`) matching warning colors.

### 3. Tap-to-Copy & Toast Notification
- **One-Tap Code Copy**: Tapping the code text or dedicated `COPY 📋` button formats and copies the token directly to the system clipboard via `expo-clipboard` (and Web Clipboard API fallback).
- **Floating Toast Notification**: Dismissable cyber floating toast chip (`"Copied to clipboard"`) with tactile button status update (`COPIED! ✓`).

### 4. Manual Code Entry Modal (`ManualEntryModal`)
- Modal sheet allowing users to input an account identifier, issuer name, and Base32 secret key.
- Dedicated 1-tap **"📋 Paste Key"** button reads clipboard, normalizes characters, and validates Base32 syntax instantly before saving.

---

## 🛡️ Biometric Authentication & App Lock (SCRUM-20)

The Authenticator Vault implements native biometric authentication and automatic screen obscuration to protect confidential TOTP accounts and encryption keys:

### 1. Native Biometric Authentication & Hardware Enclave
- **iOS**: Apple Face ID and Touch ID integrated via `expo-local-authentication`.
- **Android**: Android `BiometricPrompt` supporting fingerprint sensors and facial recognition.
- **Hardware Capability Detection**: Automatically probes hardware support (`hasHardwareAsync`), enrollment state (`isEnrolledAsync`), and sensor modalities (`supportedAuthenticationTypesAsync` mapping to `FACIAL_RECOGNITION`, `FINGERPRINT`, or `IRIS`).
- **Pluggable Architecture**: `IBiometricAuthProvider` abstraction interface implemented by `ExpoBiometricAdapter` for live mobile devices and `MockBiometricProvider` for automated unit testing and headless CI pipelines.

### 2. Device Passcode Fallback
- When biometric sensors fail, are canceled, or are unavailable, the challenge gracefully presents the system passcode fallback prompt (`fallbackLabel: 'Enter Passcode'`).
- Users can also tap **"Use Device Passcode"** on the Vault Lock Screen to trigger the system PIN/passcode prompt.

### 3. App Lifecycle Auto-Lock & Screen Obscuration (`AppState`)
- **Lifecycle Monitoring**: `AppState.addEventListener('change')` monitors app transitions across foreground and background states in `AuthenticatorNavigator`.
- **Automatic Screen Obscuration**: When the app shifts to `background`, the vault locks (`isLocked: true`) and obscures sensitive TOTP tokens and credentials behind `VaultLockScreen`.
- **Automatic Unlock Prompt**: When returning to `active` foreground from background, the app automatically triggers the native biometric challenge if biometrics are required.
- **Biometric Challenge In-Flight Debouncing (SCRUM-85)**: Native OS biometric prompt dialogs (such as Out-of-Band Push MFA approvals) trigger transient OS `inactive`/`background`/`active` lifecycle events. `BiometricAuthService` tracks in-flight challenges (`isAuthenticationInFlight()`) and records verification timestamps (`getLastAuthenticationTimestamp()`) with a post-dismissal settling window, preventing redundant secondary passcode/biometric prompts when approving push logins.

### 4. Security Settings Toggle & Sensor Badge
- **Launch Policy Toggle**: Users can enable/disable "Require Biometrics on Launch" from the Security Settings screen (`SecuritySettingsScreen`), persisting the choice instantly via `BiometricAuthService.setBiometricsRequiredOnLaunch()`.
- **Dynamic Sensor Badge**: Displays a cyber badge reflecting the device's actual hardware modality (`FACEID`, `FINGERPRINT`, or `BIOMETRICS`).

---

## 📲 Out-of-Band Push Notification MFA Approval UI (SCRUM-21)

The application features an out-of-band push authentication verification system providing real-time login authorization with contextual threat intelligence and MFA fatigue protection:

### 1. High-Priority Push Verification Modal (`PushApprovalModal`)
- **Urgent Cyber Styling**: High-priority modal sheet overlay displaying urgent security headers and live pulsing status indicators.
- **Rich Contextual Metadata**:
  - **Target Application**: Icon, application name, category (`Cloud Infrastructure`, `Network Security`, etc.), and zero-trust policy badge.
  - **Approximate Geolocation**: National flag emoji, city, region, and country name.
  - **Originating IP Address**: Formatted monospace IP address.
  - **Client Device & Environment**: Operating system, browser, and client software info (e.g. `Chrome 128 on macOS Sequoia`).
  - **Timestamp**: Exact dispatch time.
  - **Validity Window & Countdown**: 60-second animated validity window with dynamic warning color shift (`>30s` Cyan, `≤30s` Amber, `≤15s` Red) and automatic timeout transition to `EXPIRED`.

### 2. Number Matching Challenge (MFA Fatigue & Push-Bombing Prevention)
- When enabled by corporate access policy, the prompt requires the user to select the authentic 2-digit number (e.g. `74`, `42`) displayed on their browser sign-in screen.
- Presents 3 candidate number options to prevent accidental or blinded approvals.
- Blocks approval with immediate inline error alerting if the user attempts to approve without selecting or with a mismatched code.

### 3. Interactive Actions & Biometric Authorization
- **Approve Login ✓ (Green Button)**:
  - Triggers native biometric authentication challenge (`FaceID`, `Fingerprint`, or device passcode fallback) before authorization.
  - Validates number matching (if required) and records zero-trust verification.
- **Deny & Report Fraud 🚨 (Red Button)**:
  - Immediately refuses access, flags the request as a fraudulent compromise attempt, logs incident data to the security audit trail, and dismisses the prompt.
- **Deny without Reporting**:
  - Allows standard refusal when the request was simply canceled or not needed.

### 4. Air-Gapped Developer Test Harness & Sandbox (`PushTestHarnessScreen`)
- Accessible from `SecuritySettingsScreen` via **"Open Push Sandbox 🚀"**.
- **Pre-Configured One-Tap Scenarios**:
  - `AWS Management Console`: Standard biometric authorization from San Francisco, CA.
  - `Corporate Zero-Trust Gateway`: Mandatory 2-digit number verification (`Code: 74`) from London, UK.
  - `Vanguard Identity Admin Portal`: High-privilege admin console challenge (`Code: 42`) from Frankfurt, Germany.
  - `Suspicious Foreign Login Attempt`: Anomalous connection from TOR exit node to test fraud reporting and threat logging.
  - `Quick Expiration Simulation (10s)`: Short timeout testing validity window expiration.
- **Custom Push Challenge Builder**:
  - Customizable application name, location, originating IP address, number matching toggle, and target 2-digit code.
- **Simulation Audit Trail**:
  - Real-time logging of past challenge resolutions (`APPROVED ✓`, `FRAUD REPORTED 🚨`, `DENIED`, `EXPIRED`), timestamps, and one-tap log purge.

---

## 🔐 Authentication, Authorization & 2-Step Verification (OTP / TOTP)

The application features a complete Zero-Trust continuous authentication architecture mirrored from `frontend-vanguard`, connected directly to `backend-vanguard` and the live Supabase authentication database with mandatory second-factor verification.

### Authentication & MFA Endpoints
| Endpoint | Method | Payload / Contract | Description |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `POST` | `{ email, password }` | Authenticates primary credentials against Supabase Auth; triggers MFA challenge (`requireMfa: true`) |
| `/auth/verify-otp` | `POST` | `{ email, token, type: 'email' }` | Verifies dynamic 8-digit or 6-digit email OTP; issues session JWT |
| `/auth/verify-totp` | `POST` | `{ email, code }` | Verifies 6-digit Authenticator App (Google Authenticator / Microsoft Authenticator) TOTP code |
| `/auth/resend-otp` | `POST` | `{ email, type: 'email' }` | Dispatches fresh verification code with a 45-second cooldown throttle |
| `/auth/logout` | `POST` | `{}` | Revokes active server session and invalidates session token |

### Production Supabase Database Authentication (SCRUM-79)
All simulated quick demo accounts and developer test shortcuts have been removed:
- **Direct Database Authentication**: Users log in using genuine accounts registered or provisioned in the Supabase authentication database.
- **Error Propagation**: Invalid or unregistered credentials return clear backend error alerts directly on the login screen (`⚠️ Invalid login credentials`) without masking errors or advancing to OTP.
- **Mandatory Second Factor**: Users enter the dynamic verification code delivered to their email or generated by their Authenticator app.
- **Two-Step Verification Screen**: Perfect horizontal & vertical digit centering across Web/Android/iOS (`textAlign: 'center'`, `textAlignVertical: 'center'`, reset padding), multi-character paste distribution across all boxes, dedicated 1-tap "📋 Paste from Clipboard" button, auto-advancing digit inputs, backspace navigation, resend timer, and method switcher (Email OTP vs Authenticator TOTP) (SCRUM-81).
- **Pinned User Session Header & Sign Out ⎋**: Pinned outside the scrollable area with dedicated `hitSlop`, `cursor: 'pointer'`, loading spinner, and immediate unauthenticated layout transition back to `LoginScreen`.
- **User-Scoped SSO Integrations**: Active SSO connected applications and OAuth authorizations are dynamically scoped and filtered to the logged-in user account.
- **User Metadata & Full Name Resolution (SCRUM-82)**: Resolves user full names identically to `frontend-vanguard` using top-level properties (`firstName`, `lastName`, `name`) and nested `user_metadata` (`first_name`, `last_name`, `name`, `department`, `role`, `company_name`, `phone`, `account_type`), preventing fallback to email prefix handles.

---

## 🏢 Account Architecture & Company Admin Review Console (SCRUM-84)

Vanguard enforces strict account isolation between **Personal (Individual)** and **Company Organization** accounts across both frontend and mobile platforms.

### 1. Dual Persona Mobile Registration Flow (`src/app/register.tsx`)
- **Persona Selector Tabs**:
  - **👤 Personal Account**: Designed for individual users managing their own credentials and bookmarks in a private Personal Vault. Does not require or prompt for company details.
  - **🏢 Company Org Account**: Designed for organizational employees and administrators. Requires company name, department, and role to identify the organization.
- **Strict Validation**: Validates full names, valid email syntax, minimum 6-character passwords, and mandatory company name for company registrations.
- **Direct OTP Transition**: Initiates registration with the Vanguard backend (or simulated OTP store for offline dev/test) and automatically navigates to `VerifyOtpScreen`.

### 2. Strict Account Immutability (Non-Switchable Workspace Mode)
- **Immutable Workspace Derivation**:
  - Accounts registered with `accountType: 'individual'` are permanently bound to the **Personal Vault** (`isPersonalWorkspace: true`).
  - Accounts registered with `accountType: 'company'` are permanently bound to the **Company Org** (`isPersonalWorkspace: false`).
- **Elimination of Arbitrary Mode Toggle**: The previous interactive mode toggle (`⇄`) has been replaced with an immutable account status badge (`👤 Personal Mode • INDIVIDUAL` or `🏢 Company Org • <COMPANY_NAME>`). Users cannot arbitrarily switch between personal and company modes.

### 3. Dedicated Company Admin Review Console (`CompanyAdminBanner`)
- **Admin Role Scoping**: Automatically activates for Company Admins (`currentUser.accountType === 'company'` and `currentUser.role === 'admin' | 'security_officer'`).
- **Complete Employee Applicant Dossier**: When an employee submits a SaaS access request, the Admin Status Banner renders the complete request profile:
  - **Application Details**: App Name, Protocol (`SAML 2.0`, `OIDC`), Category (`Cloud`, `Developer`, `Collaboration`), and Icon.
  - **Applicant Identity**: Full Name, Work Email, Department, and Role.
  - **Business Justification**: Detailed operational reason provided by the employee.
  - **Audit Timestamp**: Submission date and time.
- **1-Tap Governance Actions**:
  - 🟢 **Approve Access**: Immediately approves the request, registers `reviewedBy: <AdminName>`, and unlocks the application with Launch & Auto-fill for the employee.
  - 🔴 **Reject Access**: Denies access, records audit administrator notes, and activates the Zero-Trust assertion block for the employee.
- **Zero Hardcoded Data & Demo Accounts**:
  - Initialized with zero hardcoded mock requests; access requests are generated and managed dynamically.
  - Pre-configured demo accounts for presentation:
    - **Company Admin**: `admin@vanguard.security` (Security Operations Admin)
    - **Company Admin**: `johnroben.manayon21@gmail.com` (Core Infrastructure Admin)
    - **Company Employee**: `user@company.com` (Engineering Member)
    - **Company Employee**: `ellen.ripley@weyland.corp` (Engineering Member)
    - **Personal Vault Owner**: `personal@vanguard.local` (Private Vault Admin)

---

## 🏛️ Architecture & Modules

- `src/models/auth.models.ts`: TypeScript interfaces for `AuthUser` (with `user_metadata`, `companyName`, `phone`, `accountType`), `SignupPayload`, `SignupResult`, `LoginCredentials`, `LoginResult`, `MfaChallengeResponse`, `VerifyOtpRequest`, `VerifyTotpRequest`, and `AuthResponse`.
- `src/models/apps.models.ts`: Core TypeScript definitions for SaaS applications, connected SSO clients, access requests (`AppAccessRequest`), and personal bookmarks.
- `src/models/vault.models.ts`: TypeScript models for `TotpAccount`, `VaultSecuritySettings`, `AddTotpAccountInput`, `EncryptedVaultEnvelope`, and `ISecureStorageProvider`.
- `src/models/push-mfa.models.ts`: TypeScript definitions for `PushApprovalRequest`, `PushApprovalResult`, `PushGeoLocation`, `NumberMatchingChallenge`, and `PushHarnessPreset`.
- `src/services/totp-engine.service.ts`: Standalone RFC 6238 TOTP calculation engine with Base32 decoding, countdown calculations, warning color shifts, and drift tolerance.
- `src/services/aes-gcm.service.ts`: Authenticated 256-bit AES-GCM encryption/decryption service with 96-bit random IVs and WebCrypto compatibility.
- `src/services/secure-storage.provider.ts`: Pluggable secure storage layer with `ExpoSecureStoreAdapter` (iOS Keychain / Android Keystore) and `MockKeychainProvider`.
- `src/services/biometric-auth.service.ts`: Standalone biometric authentication provider with native hardware abstraction (`ExpoBiometricAdapter`), mock testing adapter (`MockBiometricProvider`), capability queries, and settings persistence.
- `src/services/push-mfa.service.ts`: Reactive out-of-band push verification service with request dispatching, number matching challenge validation, audit history, and offline presets.
- `src/services/vault.service.ts`: Standalone hardware-backed Authenticator Vault service with AES-GCM encryption, full CRUD operations, Base32 validation, and RFC 6238 TOTP computation.
- `src/services/auth.service.ts`: Authentication and registration service supporting local directory fallback, live backend API authentication (`POST /auth/signup`, `POST /auth/login`, `POST /auth/verify-otp`, `POST /auth/verify-totp`, `POST /auth/resend-otp`), SSO federation, user metadata extraction/normalization (`user_metadata`), and AsyncStorage token/user session management with in-memory test fallback.
- `src/services/apps-storage.service.ts`: Offline persistence layer backed by `@react-native-async-storage/async-storage` with zero hardcoded defaults, live backend synchronization (`/oauth/connected-apps`), dynamic access requests, and admin approval/rejection operations (`approveAccessRequest`, `rejectAccessRequest`).
- `src/services/app-launcher.service.ts`: Centralized application launch dispatcher integrating Expo's in-app browser (`expo-web-browser`) and external linking (`expo-linking`) with Cyber Dark theme styling, URL normalization, and personal vault credential matching.
- `src/context/auth-context.tsx`: Reactive authentication provider (`AuthProvider` and `useAuth`) managing session state, registration (`signup`), login, 2-step OTP/TOTP verification, and logout.
- `src/context/apps-context.tsx`: Reactive React Context (`AppsProvider` and `useApps`) providing immutable workspace derivation (`isPersonalWorkspace`), Company Admin detection (`isCompanyAdmin`), pending admin requests queue (`pendingAdminRequests`), approval/rejection handlers, category filtering, and active SSO connected apps management.
- `src/constants/cyber-theme.ts`: Cyber Dark palette design tokens (`#0a0e17`, `#00e5ff`, `#10b981`, `#6366f1`, translucent glass cards, shadows, radius).
- `src/components/cyber/`: Reusable cyber design system UI components (`CyberButton`, `CyberCard`, `Badge`, `StatusIndicator`, `ModalHeader`, `CircularCountdown`, `ManualEntryModal`, `VaultLockScreen`, `PushApprovalModal`).
- `src/components/cyber/vault-lock-screen.tsx`: Full-screen cyber security shield obscuring vaulted credentials with biometric unlock trigger, device passcode fallback, and sensor status indicator.
- `src/components/cyber/push-approval-modal.tsx`: High-priority out-of-band push verification modal with rich contextual metadata, number matching picker, expiration countdown, biometric approval trigger, and fraud denial actions.
- `src/screens/vault-screen.tsx`: Air-gapped TOTP authenticator screen with circular countdown visualizers, tap-to-copy codes, floating toast notifications, and manual entry modal.
- `src/screens/account-detail-screen.tsx`: Authenticator detail screen with secret key inspection and token removal.
- `src/screens/add-account-screen.tsx`: Manual Base32 token entry with 1-tap clipboard paste and simulated camera QR scanner.
- `src/screens/security-settings-screen.tsx`: Biometrics lock toggle with dynamic hardware sensor badge, inactivity timeout, clipboard sanitization, encrypted backup export, and link to Push MFA Sandbox.
- `src/screens/push-test-harness-screen.tsx`: Air-gapped developer test harness screen for offline push MFA presets, custom challenge builder, and real-time audit history log.
- `src/screens/authenticator-navigator.tsx`: Screen coordinator managing clean transitions across vault screens, `AppState` auto-lock lifecycle listeners, biometric lock gating, and global `PushApprovalModal` mounting.
- `src/screens/verify-otp-screen.tsx`: Cyber Dark 2-Step Verification screen with auto-advancing digit inputs, paste support, timer countdown, and test bypass chips.
- `src/app/vault.tsx`: Route mounting `AuthenticatorNavigator`.
- `src/app/verify-otp.tsx`: Route entry point mounting `VerifyOtpScreen`.
- `src/app/login.tsx`: Cyber Dark login screen with email/password validation, show/hide password toggle, and seamless navigation to `RegisterScreen` and `VerifyOtpScreen`.
- `src/app/register.tsx`: Cyber Dark registration screen featuring Personal vs Company persona selection tabs, full validation, and transition to OTP verification.
- `src/app/index.tsx`: Clean route mounting `MyAppsScreen` as the primary launchpad entry point.
- `src/screens/my-apps-screen.tsx`: Unified applications launchpad combining live user session banner, immutable workspace status badge, Company Admin Review Console banner, category navigation, active SSO connected clients, governance requests queue, application cards, and interactive modal sheets.
- `src/components/app-tabs.tsx`: Cyber-styled bottom navigation tab bar mapping Vault, Apps, and Security tabs.
- `src/components/apps/`: Reusable applications directory UI components (`CompanyAdminBanner`, `PulseDot`, `ConnectedAppCard`, `ConnectedAppsSection`, `AddPersonalAppModal`, `RequestAppModal`, `RequestCard`, `RequestedAppsSection`, `CategoryFilterBar`, `AppCard`, `EmptyAppsState`).
- `src/services/otpauth-parser.service.ts`: RFC 6238 KeyUriFormat parser validating `otpauth://totp/...` URIs, extracts label, issuer, secret, algorithm, digits, and period.
- `src/services/clipboard.service.ts`: Secure clipboard manager with automatic expiration wipe timer (TTL) and clipboard ownership check to prevent overwriting third-party clipboard content.
- `src/__tests__/`: Automated unit and integration test specifications (`mobile-security-vault.test.ts`, `account-registration-architecture.test.ts`, `zero-hardcoded-dashboard.test.ts`, `metadata-name-resolution.test.ts`, `push-mfa.test.ts`, `biometric-auth.test.ts`, `offline-totp-generator.test.ts`, `secure-vault-keychain.test.ts`, `otp-paste-centering.test.ts`, `authenticator-cyber-theme.test.ts`, `auth.test.ts`, `otp-auth.test.ts`, `apps-data.test.ts`, `apps-ui.test.ts`, `connected-apps.test.ts`, `personal-app-modal.test.ts`, `request-app-modal.test.ts`, `governance-queue.test.ts`, `app-launcher.test.ts`, `my-apps-screen.test.ts`, `e2e-workflow.test.ts`).

---

## 🔐 Mobile Security Vault & Hardware-Backed Keyring (SCRUM-139 / P1-02 / P1-03)

The Authenticator Vault implements production-grade mobile security standards aligned with RFC 6238, WebCrypto AES-GCM-256, and platform secure enclaves:

1. **Zero-Seeded Clean Boot**: Fresh installs launch completely empty (`0` accounts). Automatic mock seeding in normal builds has been eliminated.
2. **Explicit Secure Storage Exceptions**: `ExpoSecureStoreAdapter` surfaces `SecureStorageError` on platform keychain or Keystore outages; in-memory fallback is restricted to explicit test environments (`MockKeychainProvider`).
3. **Strict RFC 6238 TOTP Engine**: Non-standard polynomial hash fallbacks have been removed in favor of strict RFC 4648 Base32 validation and genuine HMAC-SHA1/256 dynamic truncation tested against RFC 6238 Appendix B test vectors.
4. **Real KeyUriFormat QR Parser (`OtpAuthParser`)**: Parses and validates `otpauth://totp/...` URIs with RFC compliant label, issuer, Base32 secret, algorithm (SHA1, SHA256, SHA512), digits (6 or 8), and period.
5. **Secure Clipboard Expiration (`ClipboardService`)**: Copies sensitive TOTP codes with a configurable TTL (default 30 seconds), automatically clearing the clipboard only if it still owns the copied code.
6. **Inactivity Auto-Lock & Genuine Wipe**:
   - In-memory vault cache is wiped when locked; credentials cannot be read without biometric/passcode unlock.
   - `wipeVault({ confirmed: true })` permanently destroys keychain master keys and ciphertext envelopes without reseeding mock data.
7. **PBKDF2-SHA256 + AES-GCM Encrypted Backups**:
   - Passphrase-protected export derives a 256-bit encryption key using PBKDF2 (100,000 iterations, random salt) and encrypts the backup with AES-GCM-256.
   - Plaintext secrets are never exported unencrypted.
8. **Device-Bound Push MFA Approvals**:
   - Background polling requires authenticated user email identity (`GET /oauth/mfa/push/pending?email=...`), preventing anonymous challenge enumeration.
9. **Real Dashboard Pairing & Test Push Sync (SCRUM-183 & SCRUM-180)**:
   - `DevicesScreen` and `PushMfaService` connect directly to the backend pairing APIs (`POST /oauth/devices/pair`, `GET /oauth/devices`, `DELETE /oauth/devices/:deviceId`, `POST /oauth/mfa/push/test`) scoped per signed-in user email and authenticated with `Authorization: Bearer <token>`.
   - QR scans and manual pairing reject mismatched accounts immediately (displaying an Alert dialog + inline error on QR mismatch and enforcing `401`/`403` verification on the backend), unlinking removes the device from the backend directory, and test pushes dispatch real number-matching challenges only when the phone is paired.




