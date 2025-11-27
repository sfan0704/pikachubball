import { Loader2 } from "lucide-react";

interface LoadingIndicatorProps {
  message?: string;
}

export default function LoadingIndicator({ message = "Analyzing data..." }: LoadingIndicatorProps) {
  return (
    <div className="flex items-center gap-3 p-4" data-testid="loading-indicator">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}