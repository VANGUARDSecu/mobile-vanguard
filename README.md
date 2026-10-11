# Vanguard Mobile (`mobile-vanguard`)

Vanguard Security Mobile Application — Built with React Native & Expo SDK 57, delivering Zero-Trust Identity, SSO Application Launchpad, and Authenticator Vault capabilities for iOS, Android, and Web.

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

The application works out-of-the-box with offline local storage and pre-seeded enterprise/connected SSO applications. To connect to a live Vanguard backend server (for live SSO session synchronization and OAuth connected app inspection):

| Variable | Description | Default |
| :--- | :--- | :--- |
| `EXPO_PUBLIC_API_URL` | Vanguard Identity Provider backend URL | `http://localhost:3000` |

*Note for physical devices or Android emulators: Set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:3000` (or `http://10.0.2.2:3000` on Android emulator).*

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
   - `expo-router`: `~57.0.22`
   - `expo-web-browser`: `~57.0.3`
   - `expo-linking`: `~57.0.10`
   - `expo-clipboard`: `~57.0.2`
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
npx expo start
```

### Platform-Specific Launch Targets
- **Web Preview**:
  ```bash
  npm run web
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

### Automated Unit Test Suite
Run the test suite verifying data models, connected SSO apps, deduplication logic, and storage services:
```bash
npm test
```

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

## 🔐 Authentication & Zero-Trust Demo Accounts

The application features a built-in Zero-Trust authentication layer (`AuthProvider`, `AuthService`, and Cyber Dark `LoginScreen`) with session persistence across app restarts.

### Pre-Configured Demo Accounts
| Account | Email | Password | Role / Department | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Ellen Ripley** | `ellen.ripley@weyland.corp` | `Password123!` | User / Engineering | Connected to Acme Dummy Web SSO portal |
| **John Manayon** | `user@company.com` | `Password123!` | User / Engineering | Standard corporate user profile |
| **SecOps Admin** | `admin@vanguard.security` | `Password123!` | Admin / Security Operations | Privileged administrative credentials |

- **1-Tap SSO Federation**: Tap **Sign In with Vanguard SSO** on the login screen for instant continuous authentication.
- **Quick Demo Account Selector**: Tap any demo user chip on the login card to auto-fill credentials.
- **Live User Session Header**: Displays current account identity, role badge, and a **Sign Out ⎋** button in the top navigation bar.
- **User-Scoped SSO Integrations**: Active SSO connected applications and OAuth authorizations are dynamically scoped and filtered to the logged-in user account.

---

## 🏛️ Architecture & Modules

- `src/models/auth.models.ts`: TypeScript interfaces for `AuthUser`, `LoginCredentials`, and `AuthResponse`.
- `src/models/apps.models.ts`: Core TypeScript definitions for SaaS applications, connected SSO clients, access requests, and personal bookmarks.
- `src/services/auth.service.ts`: Authentication service supporting local directory fallback, live backend API authentication (`POST /auth/login`), SSO federation, and AsyncStorage token/user session management.
- `src/services/apps-storage.service.ts`: Offline persistence layer backed by `@react-native-async-storage/async-storage` with seed data, live backend synchronization (`/oauth/connected-apps`), and deduplication safeguards.
- `src/context/auth-context.tsx`: Reactive authentication provider (`AuthProvider` and `useAuth`) managing session state, login, SSO, and logout.
- `src/context/apps-context.tsx`: Reactive React Context (`AppsProvider` and `useApps`) providing workspace mode switching (Personal vs. Enterprise), category filtering, active SSO connected apps management, and request queueing scoped to current user.
- `src/app/login.tsx`: Cyber Dark login screen with email/password validation, show/hide password toggle, Vanguard SSO button, and quick demo account selector.
- `src/app/index.tsx`: Main application launchpad with authentication guard, active user status bar, workspace switcher, and connected apps section.
- `src/constants/cyber-theme.ts`: Cyber Dark palette design tokens (`#0a0e17`, `#00e5ff`, `#10b981`, `#6366f1`, translucent glass cards).
- `src/components/apps/`: Reusable applications directory UI components:
  - `PulseDot`: Animated pulsing green status LED indicator.
  - `ConnectedAppCard`: Active SSO integration card displaying live connection pill, protocol tag, client ID with copy action, redirect URI, authorized scopes chips, last active timestamp, and launch/disconnect actions.
  - `ConnectedAppsSection`: Header banner with pulsing active count badge (`X Active Connection(s)`), live sync button, and responsive connected client card list.
  - `AddPersonalAppModal`: Slide-up cyber bottom sheet modal for personal application creation with quick presets (Figma, Facebook, GitHub, Notion, Google, Custom), URL format normalization, category selector, and error alerts.
  - `CategoryFilterBar`: Horizontal category scroll bar with active cyber glow and count indicators.
  - `AppCard`: Translucent cyber card with icon box, group badges, auto-fill indicator, live connected pill, and launch action.
  - `EmptyAppsState`: Contextual empty state with workspace-aware messaging and call-to-action buttons.
- `src/__tests__/`: Automated unit and integration test specifications (`auth.test.ts`, `apps-data.test.ts`, `apps-ui.test.ts`, `connected-apps.test.ts`, `personal-app-modal.test.ts`).
