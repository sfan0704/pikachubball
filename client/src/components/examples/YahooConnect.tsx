import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import YahooConnect from '../YahooConnect';

const mockQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export default function YahooConnectExample() {
  return (
    <QueryClientProvider client={mockQueryClient}>
      <div className="p-6 max-w-sm">
        <YahooConnect />
      </div>
    </QueryClientProvider>
  );
}