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

## 📦 Installation & Setup

1. **Clone & Navigate**:
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
Run the test suite verifying data models, deduplication logic, and storage services:
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

## 🏛️ Architecture & Modules

- `src/models/apps.models.ts`: Core TypeScript definitions for SaaS applications, connected SSO clients, access requests, and personal bookmarks.
- `src/services/apps-storage.service.ts`: Offline persistence layer backed by `@react-native-async-storage/async-storage` with seed data and deduplication safeguards.
- `src/context/apps-context.tsx`: Reactive React Context (`AppsProvider` and `useApps`) providing workspace mode switching (Personal vs. Enterprise), category filtering, and request queueing.
- `src/constants/cyber-theme.ts`: Cyber Dark palette design tokens (`#0a0e17`, `#00e5ff`, `#10b981`, `#6366f1`, translucent glass cards).
- `src/components/apps/`: Reusable applications directory UI components:
  - `CategoryFilterBar`: Horizontal category scroll bar with active cyber glow and count indicators.
  - `AppCard`: Translucent cyber card with icon box, group badges, auto-fill indicator, live connected pill, and launch action.
  - `EmptyAppsState`: Contextual empty state with workspace-aware messaging and call-to-action buttons.
- `src/__tests__/`: Automated unit and integration test specifications.
