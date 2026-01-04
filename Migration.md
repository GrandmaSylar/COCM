# Migration Guide - New Laptop Setup

This document contains **everything** you need to install and configure on a new laptop to continue development on this Church Management System and future React Native applications.

---

## 📋 Table of Contents
- [Core Development Tools](#core-development-tools)
- [Code Editors & IDEs](#code-editors--ides)
- [React & React Native Development](#react--react-native-development)
- [Mobile Development Tools](#mobile-development-tools)
- [Backend & Database](#backend--database)
- [Version Control](#version-control)
- [Terminal & Shell](#terminal--shell)
- [Browser & Extensions](#browser--extensions)
- [Testing & Quality Tools](#testing--quality-tools)
- [Design & Prototyping](#design--prototyping)
- [Environment Variables](#environment-variables)
- [Project Setup](#project-setup)
- [Optional but Recommended](#optional-but-recommended)

---

## Core Development Tools

### 1. Node.js & npm
**Current Version:** Node.js 20.x LTS
- Download: https://nodejs.org/
- Choose: LTS (Long Term Support) version
- Includes: npm (Node Package Manager)
- Verify installation:
  ```bash
  node --version
  npm --version
  ```

### 2. Git
**Version:** Latest
- Windows: https://git-scm.com/download/win
- Mac: `brew install git` or Xcode Command Line Tools
- Linux: `sudo apt install git` or `sudo yum install git`
- Verify:
  ```bash
  git --version
  ```

### 3. Python
**Version:** 3.x (needed for some Node.js native modules)
- Download: https://www.python.org/downloads/
- **Important:** Check "Add Python to PATH" during installation
- Verify:
  ```bash
  python --version
  ```

---

## Code Editors & IDEs

### 1. Visual Studio Code (Recommended)
- Download: https://code.visualstudio.com/
- **Essential Extensions:**
  - ES7+ React/Redux/React-Native snippets
  - ESLint
  - Prettier - Code formatter
  - Tailwind CSS IntelliSense
  - Auto Rename Tag
  - Bracket Pair Colorizer 2
  - GitLens
  - React Native Tools
  - Expo Tools
  - Thunder Client (API testing)
  - Error Lens
  - Path Intellisense
  - npm Intellisense
  - TypeScript Import Sorter
  - Code Spell Checker

### 2. Alternative IDEs (Optional)
- **WebStorm:** https://www.jetbrains.com/webstorm/
- **Android Studio:** Required for React Native Android development (see below)
- **Xcode:** Required for React Native iOS development (Mac only)

---

## React & React Native Development

### 1. React Native CLI
```bash
npm install -g react-native-cli
```

### 2. Expo CLI (Recommended for React Native)
```bash
npm install -g expo-cli
```

### 3. Yarn (Alternative Package Manager)
```bash
npm install -g yarn
```

### 4. TypeScript
```bash
npm install -g typescript
```

### 5. EAS CLI (Expo Application Services)
For building and deploying React Native apps:
```bash
npm install -g eas-cli
```

### 6. React DevTools
```bash
npm install -g react-devtools
```

---

## Mobile Development Tools

### For Android Development

#### 1. Android Studio
- Download: https://developer.android.com/studio
- **Required Components:**
  - Android SDK
  - Android SDK Platform
  - Android Virtual Device (AVD)
  - SDK Build-Tools
  - SDK Platform-Tools
  - SDK Tools

#### 2. Java Development Kit (JDK)
- Version: JDK 17 or 11
- Download: https://adoptium.net/
- Set JAVA_HOME environment variable

#### 3. Android Environment Variables
Add to system PATH:
```
ANDROID_HOME = C:\Users\YourName\AppData\Local\Android\Sdk
Path += %ANDROID_HOME%\platform-tools
Path += %ANDROID_HOME%\tools
Path += %ANDROID_HOME%\tools\bin
Path += %ANDROID_HOME%\emulator
```

#### 4. Watchman (for file watching)
- Windows: Install via Chocolatey `choco install watchman`
- Mac: `brew install watchman`

### For iOS Development (Mac Only)

#### 1. Xcode
- Download from Mac App Store
- **Required:**
  - Xcode Command Line Tools
  - iOS Simulator
  - CocoaPods: `sudo gem install cocoapods`

#### 2. Xcode Command Line Tools
```bash
xcode-select --install
```

---

## Backend & Database

### 1. Supabase CLI
**Current Version:** 2.67.1
```bash
npm install -g supabase
```
- Verify: `supabase --version`

### 2. Docker Desktop
**Required for local Supabase development**
- Windows/Mac: https://www.docker.com/products/docker-desktop/
- Linux: https://docs.docker.com/engine/install/
- **Note:** May have issues on Windows, consider cloud-only development

### 3. PostgreSQL (Optional)
For local database testing:
- Download: https://www.postgresql.org/download/

### 4. Deno
For Supabase Edge Functions:
```bash
# Windows (PowerShell)
irm https://deno.land/install.ps1 | iex

# Mac/Linux
curl -fsSL https://deno.land/install.sh | sh
```

---

## Version Control

### 1. Git Configuration
After installing Git, configure your identity:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 2. GitHub CLI (Optional but recommended)
```bash
# Windows (via winget)
winget install GitHub.cli

# Mac
brew install gh

# Authenticate
gh auth login
```

### 3. SSH Keys for GitHub
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "your.email@example.com"

# Add to ssh-agent
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519

# Copy public key and add to GitHub
cat ~/.ssh/id_ed25519.pub
```

---

## Terminal & Shell

### Windows

#### 1. Windows Terminal (Recommended)
- Install from Microsoft Store
- Or: https://aka.ms/terminal

#### 2. Git Bash
- Included with Git for Windows

#### 3. PowerShell 7+ (Optional)
```bash
winget install Microsoft.PowerShell
```

### Mac/Linux

#### 1. Oh My Zsh (Optional)
```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

#### 2. Homebrew (Mac)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## Browser & Extensions

### Browsers
- **Google Chrome:** https://www.google.com/chrome/
- **Microsoft Edge:** Pre-installed on Windows
- **Firefox Developer Edition:** https://www.mozilla.org/firefox/developer/

### Essential Browser Extensions

#### Chrome/Edge Extensions:
1. **React Developer Tools**
   - Chrome: https://chrome.google.com/webstore/detail/react-developer-tools/

2. **Redux DevTools** (if using Redux)
   - Chrome: https://chrome.google.com/webstore/detail/redux-devtools/

3. **JSON Viewer**
   - For viewing API responses

4. **Lighthouse** (Built into Chrome DevTools)
   - For performance auditing

5. **Wappalyzer**
   - Identify technologies used on websites

6. **ColorZilla**
   - Color picker and eyedropper

---

## Testing & Quality Tools

### 1. Postman or Insomnia
For API testing:
- **Postman:** https://www.postman.com/downloads/
- **Insomnia:** https://insomnia.rest/download
- **Alternative:** Thunder Client (VS Code extension)

### 2. ESLint
```bash
npm install -g eslint
```

### 3. Prettier
```bash
npm install -g prettier
```

---

## Design & Prototyping

### 1. Figma Desktop App
- Download: https://www.figma.com/downloads/

### 2. Adobe XD (Alternative)
- Download: https://www.adobe.com/products/xd.html

---

## Environment Variables

### Current Project (.env file)
Create `.env` file in project root:
```env
# Frontend
VITE_SUPABASE_URL=https://szligatlxwpcknwkhdyp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# For local development
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=[local-anon-key]
```

### Supabase Edge Functions (.env file)
Create `supabase/functions/server/.env`:
```env
# Cloud
SUPABASE_URL=https://szligatlxwpcknwkhdyp.supabase.co
SUPABASE_ANON_KEY=[your-cloud-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-cloud-service-role-key]

# Local
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=[local-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[local-service-role-key]
```

---

## Project Setup

### 1. Clone Repository
```bash
git clone [your-repo-url]
cd back
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Link Supabase Project
```bash
supabase link --project-ref szligatlxwpcknwkhdyp
```

### 4. Start Local Supabase (Optional)
```bash
supabase start
```

### 5. Run Development Server
```bash
npm run dev
```

### 6. Deploy Edge Functions (if needed)
```bash
supabase functions deploy server --no-verify-jwt
```

---

## Optional but Recommended

### 1. nvm (Node Version Manager)
Manage multiple Node.js versions:
- **Windows:** https://github.com/coreybutler/nvm-windows
- **Mac/Linux:** https://github.com/nvm-sh/nvm

### 2. Chocolatey (Windows Package Manager)
```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### 3. scrcpy (Android Screen Mirroring)
View/control Android device from PC:
```bash
# Windows
choco install scrcpy

# Mac
brew install scrcpy
```

### 4. Flipper (React Native Debugging)
- Download: https://fbflipper.com/

### 5. Reactotron (React/React Native Debugging)
- Download: https://github.com/infinitered/reactotron/releases

### 6. ngrok (Expose localhost to internet)
For testing on physical devices:
- Download: https://ngrok.com/download

### 7. ImageMagick (Image processing)
```bash
# Windows
choco install imagemagick

# Mac
brew install imagemagick
```

---

## Additional Tools for React Native

### 1. Fastlane (App Deployment Automation)
```bash
# Mac/Linux
sudo gem install fastlane

# Windows
gem install fastlane
```

### 2. App Center CLI (Microsoft)
```bash
npm install -g appcenter-cli
```

### 3. Firebase CLI (if using Firebase)
```bash
npm install -g firebase-tools
```

---

## System Requirements

### Minimum Specifications
- **RAM:** 8GB (16GB recommended for React Native development)
- **Storage:** 20GB free space (50GB+ recommended with Android Studio)
- **CPU:** Multi-core processor (i5/Ryzen 5 or better)
- **OS:**
  - Windows 10/11 (64-bit)
  - macOS 12+ (for iOS development)
  - Linux (Ubuntu 20.04+ or equivalent)

---

## Migration Checklist

### Before Migration
- [ ] Export browser bookmarks
- [ ] Backup SSH keys from `~/.ssh/`
- [ ] Backup Git config: `git config --list --show-origin`
- [ ] Export VS Code settings and extensions list
- [ ] Backup `.env` files (securely!)
- [ ] Document any custom PATH variables
- [ ] Export npm global packages: `npm list -g --depth=0`
- [ ] Backup project databases (if any)

### After Setting Up New Laptop
- [ ] Install Node.js
- [ ] Install Git
- [ ] Configure Git (user.name, user.email)
- [ ] Install VS Code + extensions
- [ ] Install Supabase CLI
- [ ] Install React Native CLI
- [ ] Install Expo CLI
- [ ] Install Android Studio (for Android dev)
- [ ] Install Xcode (Mac only, for iOS dev)
- [ ] Install Docker Desktop
- [ ] Setup SSH keys for GitHub
- [ ] Clone repositories
- [ ] Install project dependencies
- [ ] Configure environment variables
- [ ] Test local development server
- [ ] Test Supabase connection
- [ ] Test mobile emulators/simulators

---

## Quick Reference Commands

```bash
# Check versions
node --version
npm --version
git --version
supabase --version
react-native --version
expo --version

# Global npm packages
npm list -g --depth=0

# Project setup
npm install
npm run dev

# Supabase
supabase start
supabase stop
supabase status
supabase db reset
supabase functions deploy server

# React Native
npx react-native init MyApp
npx react-native run-android
npx react-native run-ios

# Expo
npx create-expo-app MyApp
npx expo start
eas build --platform android
eas build --platform ios
```

---

## Important Notes

1. **Supabase Project ID:** `szligatlxwpcknwkhdyp`
2. **Project Repository:** Store this in a private GitHub repository
3. **Secrets Management:** Never commit `.env` files to Git
4. **Docker on Windows:** May have issues, consider cloud-only Supabase development
5. **iOS Development:** Only possible on macOS with Xcode
6. **Android Emulator:** Requires virtualization enabled in BIOS

---

## Support Resources

- **React Documentation:** https://react.dev/
- **React Native Documentation:** https://reactnative.dev/
- **Expo Documentation:** https://docs.expo.dev/
- **Supabase Documentation:** https://supabase.com/docs
- **Vite Documentation:** https://vite.dev/
- **Tailwind CSS Documentation:** https://tailwindcss.com/docs
- **TypeScript Documentation:** https://www.typescriptlang.org/docs/

---

**Last Updated:** January 4, 2026
**Project:** Church Management System (CoC.M)
**Technology Stack:** React, TypeScript, Vite, Supabase, Tailwind CSS
