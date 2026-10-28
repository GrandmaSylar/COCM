// Reusable iOS building blocks: inset grouped lists, settings-style icon tiles,
// large titles and a status notice. Built on the design tokens in globals.css.
import * as React from "react";
import { ChevronRight, Search, X } from "lucide-react";

import { cn } from "./utils";

type IconType = React.ComponentType<{ className?: string }>;

/** Rounded-square icon tile, like the colored icons in iOS Settings. */
const TILE: Record<string, string> = {
  primary: "bg-primary text-primary-foreground",
  gray: "bg-fill-strong text-foreground",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  info: "bg-info text-white",
};

function IconTile({ icon: Icon, tone = "gray", className }: { icon: IconType; tone?: keyof typeof TILE; className?: string }) {
  return (
    <span className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-[7px]", TILE[tone], className)}>
      <Icon className="size-[17px]" />
    </span>
  );
}

/** An inset grouped list: a titled, rounded surface whose rows are divided by inset hairlines. */
function Group({
  title,
  footer,
  children,
  className,
}: {
  title?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      {title ? <h3 className="px-4 text-[13px] font-normal uppercase tracking-wide text-muted-foreground">{title}</h3> : null}
      <div className="overflow-hidden rounded-xl bg-card">{children}</div>
      {footer ? <p className="px-4 text-[13px] text-muted-foreground">{footer}</p> : null}
    </section>
  );
}

interface GroupRowProps {
  icon?: IconType;
  iconTone?: keyof typeof TILE;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Secondary text on the right (a value, a count). */
  value?: React.ReactNode;
  /** Custom right-side content (a switch, a badge). */
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** Defaults to true for tappable rows without trailing content. */
  chevron?: boolean;
  selected?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

/** One row of a Group: 44 px tall, divided from the next by a hairline that starts after the icon. */
function GroupRow({ icon, iconTone, title, subtitle, value, trailing, onClick, chevron, selected, destructive, disabled, className, id }: GroupRowProps) {
  const showChevron = chevron ?? (!!onClick && !trailing);
  const body = (
    <>
      {icon ? <IconTile icon={icon} tone={iconTone} /> : null}
      <span className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-[17px] leading-snug lg:text-[15px]", destructive && "text-destructive", selected && "font-medium")}>{title}</span>
        {subtitle ? <span className="block truncate text-[13px] text-muted-foreground">{subtitle}</span> : null}
      </span>
      {value ? <span className="shrink-0 text-[17px] text-muted-foreground lg:text-[15px]">{value}</span> : null}
      {trailing}
      {showChevron ? <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" /> : null}
    </>
  );
  const classes = cn(
    "relative flex min-h-11 w-full items-center gap-3 px-4 py-2 lg:min-h-10",
    // Hairline between rows, inset past the icon when there is one.
    "after:absolute after:bottom-0 after:right-0 after:h-px after:bg-separator last:after:hidden",
    icon ? "after:left-[3.25rem]" : "after:left-4",
    className,
  );
  return onClick ? (
    <button id={id} type="button" onClick={onClick} disabled={disabled} className={cn(classes, "transition-colors active:bg-accent hover:bg-accent/60 disabled:opacity-50")}>
      {body}
    </button>
  ) : (
    <div id={id} className={classes}>
      {body}
    </div>
  );
}

/** A page title in the iOS large-title style, with optional actions on the right. */
function LargeTitle({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[28px] font-bold leading-tight lg:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[15px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

const NOTICE: Record<string, string> = {
  info: "bg-info-soft text-info-text",
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-foreground",
};

/** A single inline status message: tinted, compact, with an optional action and dismiss button. */
function StatusNotice({
  tone = "neutral",
  icon: Icon,
  children,
  action,
  onDismiss,
  className,
}: {
  tone?: keyof typeof NOTICE;
  icon?: IconType;
  children: React.ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div role="status" className={cn("no-print flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug", NOTICE[tone], className)}>
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {action ? (
        <button type="button" onClick={action.onClick} className="shrink-0 font-semibold underline-offset-2 hover:underline active:opacity-70">
          {action.label}
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="-mr-1 shrink-0 rounded-full p-1 opacity-70 hover:opacity-100 active:opacity-50">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** A rounded, filled search field with a clear button, in the iOS style. */
function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-9 w-full rounded-[10px] bg-fill pl-8 pr-8 text-[17px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40 lg:text-[15px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground active:opacity-60">
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** What a list shows when there is nothing to list: an icon, a short title, one line of help, and an action. */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: IconType;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {Icon ? (
        <span className="mb-4 flex size-14 items-center justify-center rounded-full bg-fill text-muted-foreground">
          <Icon className="size-7" />
        </span>
      ) : null}
      <h3 className="text-[20px] font-semibold leading-tight">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-[15px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export { EmptyState, Group, GroupRow, IconTile, LargeTitle, SearchField, StatusNotice };
