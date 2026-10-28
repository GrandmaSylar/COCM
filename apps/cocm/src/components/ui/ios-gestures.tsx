// Touch gestures in the iOS style: swipe actions on a row and pull to refresh.
// Both track the finger 1:1, resist at the edge, and settle with the iOS ease curve.
// Neither does anything for a mouse, so desktop text selection and clicks are untouched.
import * as React from "react";
import { Loader2, ArrowDown } from "lucide-react";

import { cn } from "./utils";

type IconType = React.ComponentType<{ className?: string }>;

const SETTLE = "transform 350ms var(--ease-ios)";

/** The further past a bound you pull, the less the content follows. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

export interface SwipeAction {
  label: string;
  icon?: IconType;
  onClick: () => void;
  tone?: "primary" | "destructive" | "neutral" | "info" | "warning" | "success";
}

const ACTION_TONE: Record<NonNullable<SwipeAction["tone"]>, string> = {
  primary: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  neutral: "bg-fill-strong text-foreground",
  info: "bg-info-solid text-white",
  warning: "bg-warning-solid text-white",
  success: "bg-success-solid text-white",
};

const ACTION_WIDTH = 76;

/**
 * A row that reveals trailing actions when swiped left with a finger or pen.
 * Releasing past halfway, or flicking, opens it; tapping the row or an action closes it.
 */
export function SwipeRow({ actions, children, className }: { actions: SwipeAction[]; children: React.ReactNode; className?: string }) {
  const full = actions.length * ACTION_WIDTH;
  const content = React.useRef<HTMLDivElement>(null);
  const tray = React.useRef<HTMLDivElement>(null);
  const state = React.useRef({ startX: 0, startY: 0, base: 0, x: 0, active: false, decided: false, t: 0, v: 0, lastX: 0 });
  const [open, setOpen] = React.useState(false);

  const place = (x: number, animate: boolean) => {
    const el = content.current;
    if (!el) return;
    el.style.transition = animate ? SETTLE : "none";
    el.style.transform = `translate3d(${x}px,0,0)`;
    state.current.x = x;
    // The action tray is only visible while the row is displaced, so no colour bleeds at rest.
    if (x < 0 && tray.current) tray.current.style.visibility = "visible";
  };

  const settle = (isOpen: boolean) => {
    setOpen(isOpen);
    place(isOpen ? -full : 0, true);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    const s = state.current;
    s.startX = e.clientX;
    s.startY = e.clientY;
    s.base = open ? -full : 0;
    s.active = true;
    s.decided = false;
    s.t = e.timeStamp;
    s.lastX = e.clientX;
    s.v = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.active) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    if (!s.decided) {
      // Wait for ~10px of movement, then commit to a direction.
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        s.active = false;
        return;
      }
      s.decided = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    const dt = Math.max(1, e.timeStamp - s.t);
    s.v = (e.clientX - s.lastX) / dt; // px per ms
    s.lastX = e.clientX;
    s.t = e.timeStamp;
    let x = s.base + dx;
    if (x > 0) x = rubberband(x, 120);
    else if (x < -full) x = -full - rubberband(-full - x, 120);
    place(x, false);
  };

  const onPointerUp = () => {
    const s = state.current;
    if (!s.active) return;
    s.active = false;
    if (!s.decided) return;
    // Project where the flick is heading, then choose the nearer resting place.
    const projected = s.x + s.v * 200;
    settle(projected < -full / 2);
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <div ref={tray} className="absolute inset-y-0 right-0 flex" style={{ width: full, visibility: "hidden" }} aria-hidden={!open}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              tabIndex={open ? 0 : -1}
              onClick={() => {
                settle(false);
                action.onClick();
              }}
              className={cn("flex flex-1 flex-col items-center justify-center gap-1 text-[13px] font-medium active:opacity-80", ACTION_TONE[action.tone ?? "neutral"])}
            >
              {Icon ? <Icon className="size-5" /> : null}
              {action.label}
            </button>
          );
        })}
      </div>
      <div
        ref={content}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTransitionEnd={() => {
          if (state.current.x === 0 && tray.current) tray.current.style.visibility = "hidden";
        }}
        onClickCapture={(e) => {
          // A tap on an open row closes it instead of activating the row.
          if (open) {
            e.stopPropagation();
            e.preventDefault();
            settle(false);
          }
        }}
        className="relative bg-card"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
}

const THRESHOLD = 64;

/**
 * Pull down at the top of the page to refresh. Shows a spinner while `onRefresh` runs.
 * Touch only, and only when the page is scrolled to the top.
 */
export function PullToRefresh({ onRefresh, children, className }: { onRefresh: () => Promise<unknown> | unknown; children: React.ReactNode; className?: string }) {
  const root = React.useRef<HTMLDivElement>(null);
  const body = React.useRef<HTMLDivElement>(null);
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const refresh = React.useRef(onRefresh);
  refresh.current = onRefresh;
  const busy = React.useRef(false);

  React.useEffect(() => {
    const el = root.current;
    if (!el) return;
    let startY = 0;
    let tracking = false;
    let dist = 0;

    const set = (d: number, animate: boolean) => {
      dist = d;
      if (body.current) {
        body.current.style.transition = animate ? SETTLE : "none";
        body.current.style.transform = d ? `translate3d(0,${d}px,0)` : "";
      }
      setPull(d);
    };

    const start = (e: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || e.touches.length !== 1) return;
      startY = e.touches[0].clientY;
      tracking = true;
      dist = 0;
    };
    const move = (e: TouchEvent) => {
      if (!tracking) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) {
        if (dist) set(0, false);
        return;
      }
      if (window.scrollY > 0) {
        tracking = false;
        return;
      }
      if (e.cancelable) e.preventDefault();
      set(rubberband(dy, 300), false);
    };
    const end = async () => {
      if (!tracking) return;
      tracking = false;
      if (dist >= THRESHOLD) {
        busy.current = true;
        setRefreshing(true);
        set(THRESHOLD, true);
        try {
          await refresh.current();
        } finally {
          busy.current = false;
          setRefreshing(false);
          set(0, true);
        }
      } else {
        set(0, true);
      }
    };

    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, []);

  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <div ref={root} className={cn("relative", className)}>
      <div
        className="pointer-events-none absolute inset-x-0 -top-10 flex h-10 items-center justify-center text-muted-foreground"
        style={{ opacity: refreshing ? 1 : progress }}
        aria-hidden
      >
        {refreshing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <ArrowDown className="size-5 transition-transform" style={{ transform: `rotate(${progress >= 1 ? 180 : 0}deg)` }} />
        )}
      </div>
      <div ref={body}>{children}</div>
    </div>
  );
}
