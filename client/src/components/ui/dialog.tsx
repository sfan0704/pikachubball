import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** A modal dialog; Radix keeps focus inside it and closes it on Escape. */
const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogTitle = DialogPrimitive.Title;

const DialogDescription = DialogPrimitive.Description;

/**
 * The dialog's panel over a dimmed page: a sheet from the bottom on a phone,
 * a centred card on wider screens. The panel never grows past the visible
 * screen; its content (styled by className) scrolls inside it so the close button
 * always stays in view.
 */
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // dvh, not vh: a phone browser's toolbars cover part of 100vh, which pushed the top off screen.
        "fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-2xl border bg-background shadow-lg",
        "md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl"
      )}
      {...props}
    >
      <div
        data-dialog-body=""
        // Focusable so a keyboard can scroll a long body.
        tabIndex={0}
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        {children}
      </div>
      <DialogPrimitive.Close
        className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

export { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger };
