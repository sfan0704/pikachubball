import PlayerStatCard from '../PlayerStatCard';

export default function PlayerStatCardExample() {
  return (
    <div className="grid grid-cols-2 gap-4 p-6">
      <PlayerStatCard
        name="Nikola Jokic"
        position="C"
        team="DEN"
        stats={[
          { label: "PPG", value: "26.4" },
          { label: "RPG", value: "12.4" },
          { label: "APG", value: "9.0" },
          { label: "FG%", value: "58.3" }
        ]}
        trend="up"
      />
      <PlayerStatCard
        name="Luka Doncic"
        position="PG"
        team="DAL"
        stats={[
          { label: "PPG", value: "28.8" },
          { label: "RPG", value: "8.7" },
          { label: "APG", value: "8.1" },
          { label: "FG%", value: "47.2" }
        ]}
        trend="neutral"
      />
    </div>
  );
}