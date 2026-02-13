import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface TutorialStep {
  targetId?: string; // ID of the element to highlight (optional, defaults to center screen)
  targets?: string[]; // Multiple targets (optional, overrides targetId if present)
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'; // Preferred position
}

export interface Tutorial {
  id: string;
  title: string;
  steps: TutorialStep[];
}

interface TutorialContextType {
  activeTutorial: Tutorial | null;
  currentStepIndex: number;
  startTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  endTutorial: () => void;
  hasSeenTutorial: (tutorialId: string) => boolean;
  resetTutorialHistory: () => void;
}

const TutorialContext = createContext<TutorialContextType | undefined>(undefined);

// Define Tutorials Here
export const ALL_TUTORIALS: Record<string, Tutorial> = {
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard Tour',
    steps: [
      {
        title: 'Welcome to CoC.M',
        content: "Welcome to your new Church Management System! Let's take a quick tour of the dashboard.",
        position: 'center'
      },
      {
        targetId: 'dashboard-stats',
        title: 'Key Statistics',
        content: 'Here you can see real-time updates on members, attendance, and giving.',
        position: 'bottom'
      },
      {
        targetId: 'dashboard-quick-actions',
        title: 'Quick Actions',
        content: 'Fast access to common tasks like adding members or recording attendance.',
        position: 'top'
      },
      {
        // Support multiple targets for mobile vs desktop
        targets: ['sidebar-nav', 'mobile-menu-btn', 'mobile-fab-nav'],
        title: 'Navigation',
        content: 'Use the sidebar (or menu button on mobile) to access all modules like Members, Giving, and Reports.',
        position: 'right'
      },
      {
        title: 'You are ready!',
        content: 'Explore the system and check the Help section if you need more details.',
        position: 'center'
      }
    ]
  },
  members: {
    id: 'members',
    title: 'Members Directory',
    steps: [
        {
            title: 'Members Directory',
            content: 'Manage all church members, search, filter, and view profiles.',
            position: 'center'
        },
        {
            targetId: 'members-search',
            title: 'Search & Filter',
            content: 'Find members by name, phone, or filter by status and zone.',
            position: 'bottom'
        },
        {
            targetId: 'members-add-btn',
            title: 'Add Member',
            content: 'Register new members or visitors here.',
            position: 'left'
        }
    ]
  }
};

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [seenTutorials, setSeenTutorials] = useState<string[]>([]);
  const { user } = useAuth();

  // Load seen tutorials from localStorage on mount
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(`tutorials_seen_${user.id}`);
      if (stored) {
        setSeenTutorials(JSON.parse(stored));
      }
    }
  }, [user]);

  // Save seen tutorials when changed
  useEffect(() => {
    if (user) {
      localStorage.setItem(`tutorials_seen_${user.id}`, JSON.stringify(seenTutorials));
    }
  }, [seenTutorials, user]);

  const startTutorial = (tutorialId: string) => {
    const tutorial = ALL_TUTORIALS[tutorialId];
    if (tutorial) {
      setActiveTutorial(tutorial);
      setCurrentStepIndex(0);
    }
  };

  const nextStep = () => {
    if (!activeTutorial) return;
    if (currentStepIndex < activeTutorial.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      endTutorial();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const endTutorial = () => {
    if (activeTutorial) {
      if (!seenTutorials.includes(activeTutorial.id)) {
        setSeenTutorials(prev => [...prev, activeTutorial.id]);
      }
      setActiveTutorial(null);
      setCurrentStepIndex(0);
    }
  };

  const hasSeenTutorial = (tutorialId: string) => {
    return seenTutorials.includes(tutorialId);
  };

  const resetTutorialHistory = () => {
    setSeenTutorials([]);
  };

  return (
    <TutorialContext.Provider value={{
      activeTutorial,
      currentStepIndex,
      startTutorial,
      nextStep,
      prevStep,
      endTutorial,
      hasSeenTutorial,
      resetTutorialHistory
    }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
