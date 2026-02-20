import { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in",
        className
      )}
    >
      {Icon && (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted/50 mb-6 group hover:bg-muted/80 transition-colors duration-300">
          <Icon className="h-10 w-10 text-muted-foreground/50 group-hover:text-primary/60 group-hover:scale-110 transition-all duration-300" />
        </div>
      )}
      <h3 className="text-lg font-semibold tracking-tight mb-2 text-foreground">
        {title}
      </h3>
      <p className="text-muted-foreground max-w-sm mb-6 text-sm">
        {description}
      </p>
      {action && (
        <Button onClick={action.onClick} variant="default" className="shadow-lg shadow-primary/20">
          {action.label}
        </Button>
      )}
    </div>
  );
}
