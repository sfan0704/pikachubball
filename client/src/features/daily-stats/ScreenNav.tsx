import { SCREEN_LABELS, type Screen } from "@/features/league/screens";
import { selectionPath, type Selection } from "@/features/league/selection";
import { LinkBar } from "./LinkBar";

/** Matchup, Players and League, for the screens the server has wired. */
export function ScreenNav({
  selection,
  screens,
}: {
  selection: Selection;
  screens: readonly Screen[];
}) {
  return (
    <LinkBar
      label="Screens"
      testId="screen-nav"
      items={screens.map((screen) => ({
        key: screen,
        label: SCREEN_LABELS[screen],
        href: selectionPath({ ...selection, screen }),
        current: selection.screen === screen,
      }))}
    />
  );
}
