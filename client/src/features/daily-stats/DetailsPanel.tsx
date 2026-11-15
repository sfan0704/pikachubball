import { createContext, useContext, useId, type ReactNode } from "react";
import { DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * The id of the panel heading the details are in, or null inside a sheet, drawer
 * or dialog: there the dialog's own title and description name it.
 */
const PanelTitleId = createContext<string | null>(null);

/** The details' title: the dialog's title in a sheet, drawer or dialog; the region's heading in a panel. */
export function DetailsTitle({ className, children }: { className: string; children: ReactNode }) {
  const panelTitleId = useContext(PanelTitleId);
  if (panelTitleId === null) {
    return <DialogTitle className={className}>{children}</DialogTitle>;
  }
  return (
    <h2 id={panelTitleId} className={className}>
      {children}
    </h2>
  );
}

/** The line under the details' title; the dialog's description in a sheet, drawer or dialog. */
export function DetailsDescription({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const panelTitleId = useContext(PanelTitleId);
  if (panelTitleId === null) {
    return <DialogDescription className={className}>{children}</DialogDescription>;
  }
  return <p className={className}>{children}</p>;
}

/**
 * Details as a card that stays open on the page: a region named by the details'
 * title. Not a dialog, so no focus trap, scrim or close button.
 */
export function DetailsPanel({ testId, children }: { testId: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <PanelTitleId.Provider value={titleId}>
      <section
        aria-labelledby={titleId}
        data-testid={testId}
        className="min-w-0 rounded-2xl border border-[#E2E5EA] bg-white p-5 dark:border-border dark:bg-card"
      >
        {children}
      </section>
    </PanelTitleId.Provider>
  );
}
