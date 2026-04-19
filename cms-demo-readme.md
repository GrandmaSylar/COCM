```markdown
# Church Management System MVP

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

**A comprehensive Church Management System for modern congregations**

---

## 🚀 Overview

The Church Management System MVP is a modern, full-featured web application designed to help churches manage member information, attendance, ministries, and more. Built with TypeScript, React, and Supabase, this system provides a robust foundation for church administration with a focus on usability and extensibility.

### Key Features
✅ **Member Management** – Add, edit, and track church members with detailed profiles
✅ **Attendance Tracking** – Record and analyze church attendance
✅ **Ministry Integration** – Manage participation in various church ministries
✅ **Family Relationships** – Track family connections and relationships
✅ **Visitor Management** – Welcome and track visitors to your church
✅ **Responsive UI** – Works seamlessly on all devices
✅ **Offline Support** – Built-in offline capabilities for reliable operation
✅ **Export Functionality** – Generate reports and export data to Excel

### Who This Is For
- Church administrators and staff
- Ministry leaders
- Volunteer coordinators
- Church office managers
- Pastors and church leaders

---

## ✨ Features

### Core Functionality
- **Comprehensive Member Profiles**: Store detailed information about church members including contact details, family relationships, and ministry involvement
- **Attendance Tracking**: Record weekly attendance with calendar integration
- **Family Management**: Track family units and relationships between members
- **Visitor System**: Welcome and track visitors with optional follow-up
- **Ministry Assignment**: Assign members to various church ministries

### Technical Features
- **TypeScript**: Full type safety throughout the application
- **React**: Modern component-based architecture
- **Supabase**: Secure, real-time database and authentication
- **Tailwind CSS**: Customizable, responsive styling
- **Offline Support**: Works without internet connection
- **Export Capabilities**: Generate Excel reports and PDFs

### UI Components
- **Radix UI**: Accessible and customizable UI components
- **Form Validation**: Comprehensive form handling with React Hook Form
- **Dark Mode**: Built-in dark/light theme support
- **Responsive Design**: Works on all device sizes

---

## 🛠️ Tech Stack

### Primary Technologies
- **Language**: TypeScript
- **Frontend Framework**: React 18
- **Styling**: Tailwind CSS
- **State Management**: React Context + Custom Hooks
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Build Tool**: Vite
- **Testing**: Vitest + React Testing Library

### Key Libraries
- **UI Components**: Radix UI, Shadcn UI
- **Form Handling**: React Hook Form
- **Date Picking**: React Day Picker
- **Charts**: Recharts
- **PDF Generation**: jsPDF
- **File Export**: XLSX
- **Offline Support**: IndexedDB
- **Error Tracking**: Sentry

### System Requirements
- Node.js 18+
- npm or yarn
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Supabase account (for production use)

---

## 📦 Installation

### Prerequisites
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A modern web browser

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/CMS-demo.git
   cd CMS-demo
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open in your browser**:
   The application will be available at `http://localhost:8080`

### Alternative Installation Methods

#### Using Docker (Optional)
If you prefer using Docker, you can set up the project with:

```bash
docker-compose up --build
```

This will automatically install dependencies and start the development server.

#### Development Setup
For a full development environment with testing and linting:

```bash
npm install --global typescript @types/node
npm run setup
```

---

## 🎯 Usage

### Basic Usage

#### Adding a New Member
```typescript
// Example of how to use the AddMember component
import { AddMember } from '@/components/AddMember';

function MemberForm() {
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (memberData: Member) => {
    try {
      await api.addMember(memberData);
      alert('Member added successfully!');
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={() => setIsOpen(true)}
        className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Add New Member
      </button>

      <AddMember
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

#### Tracking Attendance
```typescript
// Example attendance tracking with date picker
import { useState } from 'react';
import { Calendar } from 'react-day-picker';
import { api } from '@/services/api';

function AttendanceTracker() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [attendanceData, setAttendanceData] = useState<Member[]>([]);

  const handleDateChange = async (date: Date) => {
    setSelectedDate(date);
    try {
      const data = await api.getAttendance(date);
      setAttendanceData(data);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  return (
    <div className="p-4">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={handleDateChange}
        className="my-4"
      />

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="py-2 px-4 border">Name</th>
              <th className="py-2 px-4 border">Status</th>
              <th className="py-2 px-4 border">Ministry</th>
            </tr>
          </thead>
          <tbody>
            {attendanceData.map(member => (
              <tr key={member.id}>
                <td className="py-2 px-4 border">{member.firstName} {member.lastName}</td>
                <td className="py-2 px-4 border">
                  <span className={`px-2 py-1 rounded-full text-xs ${member.attended ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {member.attended ? 'Attended' : 'Absent'}
                  </span>
                </td>
                <td className="py-2 px-4 border">{member.ministry || 'None'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Advanced Usage

#### Customizing the UI
The application uses Tailwind CSS for styling. You can customize the theme by modifying the `tailwind.config.js` file:

```javascript
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      colors: {
        // Add or modify your custom colors here
        church: {
          primary: "#2563eb",
          secondary: "#1e40af",
          accent: "#3b82f6",
        },
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
};
```

#### Database Schema Customization
The application uses Supabase with a PostgreSQL database. You can extend the database schema by adding new tables and relationships in your Supabase dashboard or by running migrations:

```typescript
// Example migration file
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('church_ministries', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('description');
    table.string('leader_id').references('id').inTable('members');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('church_ministries');
}
```

---

## 📁 Project Structure

```
CMS-demo/
├── public/                  # Static files
│   ├── favicon.ico
│   ├── manifest.json
│   └── icon-192.png
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── AddMember.tsx
│   │   ├── MemberList.tsx
│   │   ├── AttendanceTracker.tsx
│   │   ├── ui/               # Radix UI components
│   │   └── ...
│   ├── hooks/               # Custom hooks
│   │   ├── useMember.ts
│   │   ├── useAttendance.ts
│   │   └── ...
│   ├── services/            # API services
│   │   ├── api.ts
│   │   └── supabase.ts
│   ├── types/               # TypeScript types
│   │   ├── member.d.ts
│   │   ├── attendance.d.ts
│   │   └── ...
│   ├── utils/               # Utility functions
│   │   ├── date.ts
│   │   ├── export.ts
│   │   └── ...
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Entry point
│   └── vite-env.d.ts        # Vite environment types
├── tests/                   # Test files
├── .env                     # Environment variables
├── .env.example             # Example environment variables
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md                # This file
```

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Application Settings
APP_NAME=Church Management System
APP_VERSION=0.1.0
```

### Configuration Files

- **`vite.config.ts`**: Vite configuration for the build process
- **`tailwind.config.js`**: Tailwind CSS configuration
- **`tsconfig.json`**: TypeScript configuration

### Customization Options

1. **Theme Customization**: Modify colors in `tailwind.config.js`
2. **Database Schema**: Extend the Supabase schema as needed
3. **Features**: Enable/disable features in the `package.json` scripts
4. **API Endpoints**: Configure API routes in `src/services/api.ts`

---

## 🤝 Contributing

We welcome contributions from the community! Here's how you can help:

### How to Contribute

1. **Fork the repository** and create your branch from `main`.
2. **Write tests** for your changes.
3. **Make your changes** and ensure they follow the project's coding standards.
4. **Submit a pull request** with a clear description of your changes.

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/CMS-demo.git
   cd CMS-demo
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   ```bash
   cp .env.example .env
   # Edit the .env file with your Supabase credentials
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Code Style Guidelines

- Use **TypeScript** for all code
- Follow **React best practices** (hooks, component structure)
- Use **Tailwind CSS** for styling (prefer utility classes over custom CSS)
- Write **comprehensive tests** for new features
- Keep **commit messages** clear and descriptive

### Pull Request Process

1. Ensure your code follows the project's style guidelines.
2. Write tests for your changes.
3. Submit a pull request with a clear title and description.
4. Be responsive to feedback and make necessary changes.

---

## 📝 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

---

## 👥 Authors & Contributors

### Maintainers
- [Your Name](https://github.com/yourusername) - Initial work

### Contributors
- [Contributor Name](https://github.com/contributorusername) - Feature X
- [Contributor Name](https://github.com/contributorusername) - Bug fix Y

---

## 🐛 Issues & Support

### Reporting Issues

If you encounter any problems or have feature requests, please open an issue on the GitHub repository. When reporting a bug, please include:

- Your operating system and browser
- Steps to reproduce the issue
- Any error messages
- Screenshots or code snippets

### Getting Help

- **GitHub Discussions**: For general questions and discussions
- **Community Slack**: Join our community channel for real-time help
- **Email**: For urgent support, contact the maintainers directly

### FAQ

**Q: Can I use this for my church?**
A: Yes! This is designed to be a flexible foundation for church management systems. You may need to customize it to fit your specific needs.

**Q: How do I deploy this?**
A: You can deploy to Vercel, Netlify, or any other Node.js hosting provider. The application is configured for easy deployment.

**Q: Can I add more features?**
A: Absolutely! The codebase is designed to be extensible. Check out the `src/services/api.ts` and `src/types/` directories for ideas on how to add new functionality.

---

## 🗺️ Roadmap

### Planned Features

1. **Mobile App**: Create a companion mobile application
2. **Reporting Dashboard**: Advanced analytics and reporting
3. **Integration API**: Allow integration with other church software
4. **Giving Module**: Track donations and financial contributions
5. **Event Management**: Plan and manage church events
6. **Member Portal**: Self-service portal for members

### Known Issues

- [#123] Offline mode needs more robust testing
- [#456] Some form validation messages could be more user-friendly
- [#789] Mobile responsiveness could be improved for certain components

### Future Improvements

- Add more comprehensive testing coverage
- Implement a more sophisticated permission system
- Add support for multiple church locations
- Improve performance for large member databases

---

## 🚀 Getting Started

Ready to get started? Follow these simple steps:

1. **Fork the repository** to your GitHub account
2. **Clone your fork** to your local machine
3. **Install dependencies** with `npm install`
4. **Set up your environment** with `.env` file
5. **Start the development server** with `npm run dev`
6. **Begin customizing** the application for your church's needs

Join our community and help us build the best church management system available!

---

## 🎉 Show Your Support

If you find this project helpful, please consider giving it a star ⭐ on GitHub. Your support helps us continue to improve and maintain this application.

---

## 📢 Join the Community

Connect with other users and developers:

- [GitHub Discussions](https://github.com/yourusername/CMS-demo/discussions)
- [Community Slack Channel](https://yourcommunity.slack.com)
- [Twitter](https://twitter.com/yourhandle)

---

Thank you for using the Church Management System! We hope it helps streamline your church's operations and allows you to focus more on ministry.
```

This README.md provides a comprehensive, engaging, and professional overview of your Church Management System MVP repository. It follows GitHub best practices and is designed to attract contributors while providing clear instructions for users and developers.