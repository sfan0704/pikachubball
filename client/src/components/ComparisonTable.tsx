import { Card } from "@/components/ui/card";

interface ComparisonData {
  player: string;
  stats: { [key: string]: string | number };
}

interface ComparisonTableProps {
  title: string;
  columns: string[];
  data: ComparisonData[];
}

export default function ComparisonTable({ title, columns, data }: ComparisonTableProps) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-base mb-4" data-testid="heading-comparison">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 font-semibold">Player</th>
              {columns.map((col, idx) => (
                <th key={idx} className="text-right py-2 font-semibold">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className="border-b border-border last:border-0"
                data-testid={`row-comparison-${idx}`}
              >
                <td className="py-3 font-medium">{row.player}</td>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="py-3 text-right font-mono">
                    {row.stats[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}