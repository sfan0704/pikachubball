import ComparisonTable from '../ComparisonTable';

export default function ComparisonTableExample() {
  const mockData = [
    { player: "Nikola Jokic", stats: { PPG: "26.4", RPG: "12.4", APG: "9.0" } },
    { player: "Joel Embiid", stats: { PPG: "33.1", RPG: "10.2", APG: "4.2" } },
    { player: "Giannis", stats: { PPG: "31.1", RPG: "11.8", APG: "5.7" } },
  ];

  return (
    <div className="p-6 max-w-2xl">
      <ComparisonTable
        title="Top Centers Comparison"
        columns={["PPG", "RPG", "APG"]}
        data={mockData}
      />
    </div>
  );
}