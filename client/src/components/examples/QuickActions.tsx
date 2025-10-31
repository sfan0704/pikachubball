import QuickActions from '../QuickActions';

export default function QuickActionsExample() {
  return (
    <div className="h-24">
      <QuickActions onActionClick={(action) => console.log('Action clicked:', action)} />
    </div>
  );
}