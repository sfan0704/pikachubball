import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/** A sheet that slides up from the bottom of the screen; a modal dialog underneath. Its className styles the scrolling body. */
const Sheet = DialogPrimitive.Root;

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight", className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border bg-background shadow-lg",
        "data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
      )}
      {...props}
    >
      {/* Only the body scrolls, so the close button stays in view on a long sheet. */}
      <div
        data-sheet-body=""
        // Focusable so a keyboard can scroll a long body.
        tabIndex={0}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        {children}
      </div>
      <DialogPrimitive.Close
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-background text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close"
      >
        <X className="h-5 w-5" aria-hidden />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = DialogPrimitive.Content.displayName;

export { Sheet, SheetContent, SheetTitle, SheetDescription };
