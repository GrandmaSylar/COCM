# **Church Management System (CMS) - Technical Documentation**

---

## **1. Overview**
The **Church Management System (CMS)** is a **Minimal Viable Product (MVP)** built using **TypeScript, React, Supabase, and Tailwind CSS**. It is designed to manage church members, children, visitors, and other administrative tasks.

### **Key Features**
- **Member Management**: Add, edit, and view church members.
- **Child Member Management**: Track children, their parents, and visitors.
- **Authentication**: Secure user authentication via Supabase.
- **Responsive UI**: Built with **Radix UI** and **Tailwind CSS** for a polished interface.
- **Offline Support**: Progressive Web App (PWA) capabilities for offline use.
- **Supabase Integration**: Database, Auth, and Realtime features.

---

## **2. Tech Stack**
| Category       | Technology/Framework          | Purpose                                                                 |
|----------------|-------------------------------|-------------------------------------------------------------------------|
| **Language**   | TypeScript                    | Strongly typed JavaScript for better maintainability.                   |
| **Frontend**   | React (Vite)                  | Dynamic UI rendering.                                                    |
| **Styling**    | Tailwind CSS                  | Utility-first CSS framework for rapid UI development.                    |
| **UI Library** | Radix UI                      | Accessible, unstyled React primitives for interactive components.        |
| **Database**   | Supabase (PostgreSQL)         | Serverless database, authentication, and realtime features.             |
| **State Mgmt** | React Hooks (useState, useEffect)| Local state management for components.                                |
| **Build Tool** | Vite                          | Fast development server and bundling.                                   |
| **PWA**        | Vite PWA Plugin               | Offline support and service worker for progressive web app features.    |
| **Error Tracking** | Sentry                     | Error monitoring and reporting.                                         |

---

## **3. Project Structure**
```
CMS-demo/
├── .gitignore
├── .npmrc
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── vercel.json
├── src/
│   ├── components/          # Reusable UI components (e.g., AddChildMember.tsx)
│   ├── services/            # API and utility services (e.g., api.ts)
│   ├── styles/              # Global styles (if any)
│   ├── types/               # TypeScript interfaces and types
│   ├── main.tsx             # Entry point for React app
│   └── ...
└── node_modules/            # Dependencies
```

---

## **4. Setup & Installation**
### **Prerequisites**
- **Node.js** (v18+ recommended)
- **npm** or **yarn** (v7+ recommended)
- **Supabase Account** (for database and auth)

### **Steps to Run Locally**
1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd CMS-demo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   *(Note: `.npmrc` includes `legacy-peer-deps=true` to handle peer dependency conflicts.)*

3. **Set up Supabase**:
   - Create a Supabase project at [supabase.com](https://supabase.com/).
   - Add environment variables (`.env`):
     ```
     VITE_SUPABASE_URL=your-supabase-url
     VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
     ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```
   - The app will open at `http://localhost:8080` (configured in `vite.config.ts`).

5. **Build for production**:
   ```bash
   npm run build
   ```
   - Outputs to the `build/` directory.

---

## **5. Key Files & Configuration**
### **`vite.config.ts`**
- Configures **Vite** for development and production builds.
- Enables **PWA** support with `VitePWA`.
- Sets up **React** and **TypeScript** plugins.
- Configures **server port (8080)** and **auto-open browser**.

### **`tailwind.config.js`**
- Defines **Tailwind CSS** theming, including:
  - Dark mode support (`darkMode: ["class"]`).
  - Custom font families (`Inter` and `Plus Jakarta Sans`).
  - Color palette (primary, secondary, destructive, etc.).

### **`tsconfig.json`**
- TypeScript configuration:
  - Targets **ES2020**.
  - Uses **React JSX** (`jsx: "react-jsx"`).
  - Enables **strict type-checking** (`strict: true`).

### **`package.json`**
- **Dependencies**:
  - **Radix UI** (for interactive components like dialogs, menus, etc.).
  - **Supabase** (database, auth, and realtime).
  - **Hono** (lightweight web framework for potential backend use).
  - **Sentry** (error tracking).
  - **Vercel Speed Insights** (performance monitoring).

---

## **6. Database Schema (Supabase)**
The system uses **Supabase PostgreSQL** for data storage. Key tables include:
- **`members`**: Stores church member details.
- **`children`**: Tracks child members.
- **`parents`**: Links children to their parents.
- **`visitors`**: Records visitor information.

### **Example Query (Supabase)**
```typescript
// Fetch all members
const { data: members, error } = await supabase
  .from('members')
  .select('*');
```

---

## **7. API & Services**
### **`src/services/api.ts`**
- Centralized API calls using **Supabase Client**.
- Example:
  ```typescript
  import { createClient } from '@supabase/supabase-js';

  const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  export const api = {
    fetchMembers: async () => {
      const { data, error } = await supabase.from('members').select('*');
      if (error) throw error;
      return data;
    },
  };
  ```

### **Authentication Flow**
1. **Sign Up / Sign In**: Uses Supabase Auth.
2. **Session Management**: Tokens are stored in **Supabase JWT**.
3. **Protected Routes**: Middleware can enforce auth checks.

---

## **8. Component Deep Dive**
### **`AddChildMember.tsx`**
- **Purpose**: Adds/edits child members with parent and visitor associations.
- **Key Features**:
  - **Form Validation**: Ensures required fields (e.g., age, gender).
  - **Parent Search**: Auto-completes parent names from the database.
  - **Alert Dialogs**: Confirms critical actions (e.g., removing parents).
  - **State Management**: Uses `useState` for form data and loading states.

#### **Code Snippet (Key Logic)**
```typescript
const [parents, setParents] = useState<Member[]>([]);
const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);

const removeParent = (id: string) => {
  const parentToRemove = parents.find(p => p.id === id);
  if (parentToRemove?.isLinked) {
    setPendingRemovalId(id); // Show confirmation dialog
    return;
  }
  setParents(parents.filter(p => p.id !== id));
};
```

---

## **9. Development Guidelines**
### **Best Practices**
1. **Type Safety**:
   - Use **TypeScript interfaces** for all data models (e.g., `ChildMember`, `Member`).
   - Example:
     ```typescript
     interface ChildMember {
       id: string;
       firstName: string;
       lastName: string;
       age: number;
       gender: 'male' | 'female';
       status: 'new' | 'active' | 'inactive';
       parents: ChildParent[];
       visitors: ChildVisitor[];
     }
     ```

2. **Error Handling**:
   - Use **Supabase error handling** for API calls.
   - Example:
     ```typescript
     const { data, error } = await supabase.from('children').insert(childData);
     if (error) {
       console.error("Insertion failed:", error);
       // Show user-friendly error (e.g., toast notification).
     }
     ```

3. **Testing**:
   - Write **unit tests** for critical components (e.g., `AddChildMember`).
   - Use **Vitest** (configured in `vite.config.ts`).

4. **Performance**:
   - Optimize **React memoization** (`useMemo`, `useCallback`).
   - Avoid unnecessary re-renders with `React.memo`.

5. **Accessibility**:
   - Follow **WCAG guidelines** (Radix UI components are accessible by default).
   - Use `aria-*` attributes where needed.

---

## **10. Deployment**
### **Vercel Deployment**
1. Push code to a Git repository (e.g., GitHub).
2. Connect to **Vercel** and deploy:
   ```bash
   vercel --prod
   ```
   - Uses `vercel.json` for build settings (`buildCommand`, `outputDirectory`).

### **Supabase Configuration**
- Set up **row-level security (RLS)** in Supabase for data protection.
- Configure **environment variables** in Vercel/Supabase.

### **PWA Deployment**
- The app is already configured as a **PWA** (via `VitePWA`).
- Users can install it like a native app.

---

## **11. Debugging & Troubleshooting**
### **Common Issues**
| Issue                          | Solution                                                                 |
|--------------------------------|-------------------------------------------------------------------------|
| **Supabase connection errors** | Verify `.env` variables and Supabase project settings.                  |
| **TypeScript errors**          | Check `tsconfig.json` and ensure all types are defined.                 |
| **Vite build failures**        | Clear cache (`npm run clean`) and check `vite.config.ts` for misconfigs. |
| **Radix UI component issues**  | Ensure all required dependencies are installed (`@radix-ui/*`).        |

### **Debugging Tools**
- **Vite DevTools**: Inspect bundle and performance.
- **Sentry**: Monitor errors in production.
- **Supabase Dashboard**: Query database directly.

---

## **12. Future Enhancements**
1. **Admin Dashboard**: Add analytics for member growth.
2. **Event Management**: Schedule church events and attendance tracking.
3. **Mobile App**: Convert to a **React Native** app.
4. **Multi-Language Support**: Localize UI strings.
5. **Advanced Search**: Full-text search for members.

---

## **13. Contributing**
1. **Fork the repository**.
2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature
   ```
3. **Commit changes**:
   ```bash
   git commit -m "Add: new feature"
   ```
4. **Push to branch**:
   ```bash
   git push origin feature/your-feature
   ```
5. **Open a Pull Request**.

---

## **14. License**
This project is **open-source** under the **MIT License**. See `LICENSE` for details.

---
**End of Documentation** 🚀
For further questions, refer to the [Supabase Docs](https://supabase.com/docs) or open an issue in the repository.