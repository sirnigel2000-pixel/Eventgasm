# Eventgasm Development Rules

## 🔴 CRITICAL: WEB + MOBILE = ONE CODEBASE

**The mobile app IS the web app.** They share the same React code.

### When making ANY UI changes:
1. All screens/components are in `mobile/src/`
2. They work on BOTH mobile AND web automatically
3. Test both: `expo start --ios` AND `expo start --web`

### Platform-Specific Code:
- Use `src/utils/platform.js` to detect platform
- Use `src/utils/haptics.js` for haptic feedback (no-op on web)
- Use `src/components/CrossPlatformMap.js` for maps

### Building for Production:
```bash
# Mobile
cd mobile && eas build --platform ios

# Web (static export)
cd mobile && npx expo export --platform web

# Deploy web to Render
# Copy mobile/dist/* to public/ folder
```

### Files to NEVER import directly on web:
- `react-native-maps` → use `CrossPlatformMap`
- `expo-haptics` → use `utils/haptics`
- `expo-location` → wrap in try/catch

## API (Backend)
The API at `src/` serves both mobile and web.
All features should have API endpoints, not just mobile-specific logic.

## Rule: Test Both Platforms!
Before pushing any frontend change:
- [ ] Works on iOS simulator
- [ ] Works in web browser
