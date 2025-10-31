import LoadingIndicator from '../LoadingIndicator';

export default function LoadingIndicatorExample() {
  return (
    <div className="space-y-4 p-6">
      <LoadingIndicator message="Fetching Reddit discussions..." />
      <LoadingIndicator message="Analyzing YouTube transcripts..." />
      <LoadingIndicator message="Querying BALLDONTLIE API..." />
    </div>
  );
}