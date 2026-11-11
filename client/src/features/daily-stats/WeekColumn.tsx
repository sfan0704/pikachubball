import { orderWeekPlayers, type CategoryKey } from "@shared/domain";
import { CATEGORY_LABELS } from "@/features/league/categories";
import { shortName } from "./matchup-board";
import { weekMetaText, weekShotsText, weekValueText, type WeekCard } from "./week-board";

/** One side of the Week board: a team's label and its players' weeks. */
export interface WeekColumn {
  readonly teamKey: string;
  readonly label: string;
  readonly cards: readonly WeekCard[];
}

function WeekPlayerCard({ card, category }: { card: WeekCard; category: CategoryKey }) {
  const value = weekValueText(card, category);
  const shots = weekShotsText(card, category);
  const meta = weekMetaText(card);
  const injury = card.player.injuryToday;
  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-0.5 rounded-[10px] border p-2"
      data-testid={`week-card-${card.player.playerKey}`}
      aria-label={`${card.player.name}, ${CATEGORY_LABELS[category]} ${value}, ${meta}`}
    >
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate text-xs font-bold">{shortName(card.player.name)}</span>
        {card.group === "out" && injury && (
          <span className="shrink-0 rounded-md border border-red-700/40 px-1 text-[0.625rem] font-bold text-red-700 dark:border-red-400/40 dark:text-red-400">
            {injury.designation}
          </span>
        )}
      </span>
      <span
        className={
          value === "–"
            ? "text-right text-xs font-semibold italic text-muted-foreground"
            : "text-right text-base font-extrabold tabular-nums"
        }
        data-testid="card-value"
      >
        {value}
      </span>
      <span
        className="col-span-2 truncate text-[0.6875rem] text-muted-foreground"
        data-testid="card-meta"
      >
        {meta}
      </span>
      {shots && (
        <span className="col-span-2 truncate text-[0.6875rem] text-muted-foreground">{shots}</span>
      )}
    </li>
  );
}

function Group({
  title,
  testId,
  cards,
  category,
}: {
  title: string | null;
  testId: string;
  cards: readonly WeekCard[];
  category: CategoryKey;
}) {
  if (cards.length === 0) {
    return null;
  }
  return (
    <>
      {title && (
        <h4 className="border-t border-dashed pt-1.5 text-[0.625rem] font-bold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
      )}
      <ul className="space-y-1.5" data-testid={testId}>
        {orderWeekPlayers(cards, category).map((card) => (
          <WeekPlayerCard key={card.player.playerKey} card={card} category={category} />
        ))}
      </ul>
    </>
  );
}

/**
 * One team's week: everyone on the roster together, since a week has no
 * bench; then players out right now; then dropped players whose games counted.
 */
export function WeekColumnView({
  column,
  category,
}: {
  column: WeekColumn;
  category: CategoryKey;
}) {
  const inGroup = (group: WeekCard["group"]) => column.cards.filter((card) => card.group === group);
  return (
    <section
      aria-label={column.label}
      className="min-w-0 space-y-1.5"
      data-testid={`column-${column.teamKey}`}
    >
      <h3 className="truncate text-xs font-semibold">{column.label}</h3>
      <Group title={null} testId="week-roster" cards={inGroup("roster")} category={category} />
      <Group title="Out" testId="week-out" cards={inGroup("out")} category={category} />
      <Group
        title="Dropped"
        testId="week-dropped"
        cards={inGroup("dropped").filter((card) => card.countedGames > 0)}
        category={category}
      />
    </section>
  );
}
