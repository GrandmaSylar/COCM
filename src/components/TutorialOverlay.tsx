import React, { useState, useEffect, useRef } from 'react';
import { useTutorial, TutorialStep, Tutorial } from './TutorialContext';
import { Button } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from './ui/card';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { cn } from './ui/utils';

interface Position {
    top: number;
    left: number;
    width: number;
    height: number;
    id: string; // To track which element this is
}

function TutorialOverlayContent({ activeTutorial }: { activeTutorial: Tutorial }) {
  const { currentStepIndex, nextStep, prevStep, endTutorial } = useTutorial();
  const [positions, setPositions] = useState<Position[]>([]);
  const [primaryPosition, setPrimaryPosition] = useState<Position | null>(null);

  const currentStep = activeTutorial.steps[currentStepIndex];
  const isLastStep = currentStepIndex === activeTutorial.steps.length - 1;

  // Calculate positions based on targetId AND targets
  useEffect(() => {
    const updatePosition = () => {
      const foundPositions: Position[] = [];

      // Helper to try adding an element
      const tryAdd = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
          const rect = element.getBoundingClientRect();
          // Only add if visible (width/height > 0)
          if (rect.width > 0 && rect.height > 0) {
             foundPositions.push({
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                id: id
             });
          }
        }
      };

      // Check single targetId
      if (currentStep.targetId) {
        tryAdd(currentStep.targetId);
      }

      // Check multiple targets
      if (currentStep.targets) {
        currentStep.targets.forEach(id => tryAdd(id));
      }

      setPositions(foundPositions);
      
      // Determine "primary" position for card anchoring
      // If we have multiple, prioritize the first one in the list (or just the first found)
      if (foundPositions.length > 0) {
         setPrimaryPosition(foundPositions[0]);
      } else {
         setPrimaryPosition(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true); // Capture scroll

    // Poll for element existence (in case of dynamic loading)
    const interval = setInterval(updatePosition, 500);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      clearInterval(interval);
    };
  }, [currentStep.targetId, currentStep.targets, activeTutorial]);

  // Determine card style based on position
  const getCardStyle = () => {
    // Base styles for transition
    const baseStyle = {
      position: 'fixed' as const,
      zIndex: 100,
      width: '320px',
      // Fluid transitions for movement
      transition: 'top 0.4s cubic-bezier(0.25, 1, 0.5, 1), left 0.4s cubic-bezier(0.25, 1, 0.5, 1)',
    };

    if (!primaryPosition) {
      // Center of screen
      return {
        ...baseStyle,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // Position relative to PRIMARY target
    const position = primaryPosition;
    const gap = 16;
    let top = 0;
    let left = 0;
    let transform = '';

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const cardW = 320;
    const cardHEst = 200; // Estimated height, used for initial checks

    // Helper to check if a rect is on screen
    const isOnScreen = (t: number, l: number, w: number, h: number) => {
        return t >= 10 && l >= 10 && (t + h) <= viewportH - 10 && (l + w) <= viewportW - 10;
    };

    // calculate coords for preferences
    // Top
    const calcTop = () => ({
        top: position.top - gap,
        left: position.left + position.width / 2,
        transform: 'translate(-50%, -100%)' // Shift up by 100% of own height and center horizontally
    });

    // Bottom
    const calcBottom = () => ({
        top: position.top + position.height + gap,
        left: position.left + position.width / 2,
        transform: 'translate(-50%, 0)'
    });

    // Left
    const calcLeft = () => ({
        top: position.top + position.height / 2, // Center vertically relative to target
        left: position.left - gap,
        transform: 'translate(-100%, -50%)' // Shift left by 100% of width and center vertically
    });

    // Right
    const calcRight = () => ({
        top: position.top + position.height / 2,
        left: position.left + position.width + gap,
        transform: 'translate(0, -50%)'
    });

    let chosenPos = { top: 0, left: 0, transform: '' };

    // Try preferred position first
    if (currentStep.position === 'top') chosenPos = calcTop();
    else if (currentStep.position === 'left') chosenPos = calcLeft();
    else if (currentStep.position === 'right') chosenPos = calcRight();
    else chosenPos = calcBottom(); // Default to bottom

    // Simple boundary check/flip logic
    // Note: We can't perfectly check "bottom" boundary without knowing real height, 
    // but we can check "top" boundary easily.
    
    // Check Top boundary
    if (currentStep.position === 'top' && chosenPos.top < 10) {
        chosenPos = calcBottom(); // Flip to bottom
    }
    // Check Bottom boundary (estimated)
    else if (currentStep.position === 'bottom' && (chosenPos.top + cardHEst) > viewportH) {
        chosenPos = calcTop(); // Flip to top
    }
    // Check Left boundary (using card width)
    else if (currentStep.position === 'left' && (position.left - gap - cardW) < 10) {
        chosenPos = calcRight(); // Flip to right
    }
    // Check Right boundary
    else if (currentStep.position === 'right' && (position.left + position.width + gap + cardW) > viewportW) {
        chosenPos = calcLeft(); // Flip to left
    }

    // Final Safety Clamp (keep card on screen horizontally)
    // We need to account for the transforms. 
    // This is tricky with transforms. Let's simplify:
    // If it's top/bottom, we are centering via transform(-50%).
    // So real left edge is left - cardW/2.
    if (currentStep.position === 'top' || currentStep.position === 'bottom' || !currentStep.position) {
        const realLeft = chosenPos.left - cardW / 2;
        const realRight = chosenPos.left + cardW / 2;
        
        if (realLeft < 10) {
            // Shift right
            chosenPos.left += (10 - realLeft);
        } else if (realRight > viewportW - 10) {
            // Shift left
            chosenPos.left -= (realRight - (viewportW - 10));
        }
    }

    return {
      ...baseStyle,
      top: `${chosenPos.top}px`,
      left: `${chosenPos.left}px`,
      transform: chosenPos.transform
    };
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[99] transition-opacity duration-500 ease-in-out" 
        onClick={endTutorial}
      />
      
      {/* Highlight/Focus Borders */}
      {positions.map((pos) => (
        <div 
            key={pos.id}
            className="fixed z-[99] border-2 border-primary rounded-md pointer-events-none"
            style={{
                top: pos.top - 4,
                left: pos.left - 4,
                width: pos.width + 8,
                height: pos.height + 8,
                // Add smooth transition for the highlight box too!
                transition: 'all 0.4s cubic-bezier(0.25, 1, 0.5, 1)'
            }}
        />
      ))}

      {/* Tutorial Card */}
      <Card 
        className={cn("shadow-2xl border-primary/20")}
        style={getCardStyle()}
      >
        <div className="absolute top-2 right-2">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={endTutorial}>
                <X className="h-4 w-4" />
            </Button>
        </div>
        
        <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{activeTutorial.title}</CardTitle>
                <span className="text-xs text-muted-foreground mr-6">
                    {currentStepIndex + 1} / {activeTutorial.steps.length}
                </span>
            </div>
            <CardDescription className="text-base font-medium text-foreground">
                {currentStep.title}
            </CardDescription>
        </CardHeader>
        
        <CardContent className="pb-4">
            <p className="text-sm text-muted-foreground">
                {currentStep.content}
            </p>
        </CardContent>
        
        <CardFooter className="flex justify-between pt-0">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={prevStep} 
                disabled={currentStepIndex === 0}
            >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            
            <Button size="sm" onClick={nextStep}>
                {isLastStep ? (
                    <>Finish <Check className="h-4 w-4 ml-1" /></>
                ) : (
                    <>Next <ChevronRight className="h-4 w-4 ml-1" /></>
                )}
            </Button>
        </CardFooter>
      </Card>
    </>
  );
}

export function TutorialOverlay() {
  const { activeTutorial } = useTutorial();

  if (!activeTutorial) {
    return null;
  }

  return <TutorialOverlayContent activeTutorial={activeTutorial} />;
}
