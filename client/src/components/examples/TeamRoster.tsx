import TeamRoster from '../TeamRoster';

export default function TeamRosterExample() {
  const mockPlayers = [
    { name: "Nikola Jokic", position: "C", team: "DEN", status: "active" as const },
    { name: "Luka Doncic", position: "PG", team: "DAL", status: "active" as const },
    { name: "Joel Embiid", position: "C", team: "PHI", status: "injured" as const },
    { name: "Kawhi Leonard", position: "SF", team: "LAC", status: "out" as const },
    { name: "Ja Morant", position: "PG", team: "MEM", status: "active" as const },
  ];

  return (
    <div className="p-6 max-w-sm">
      <TeamRoster players={mockPlayers} />
    </div>
  );
}