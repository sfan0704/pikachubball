import ChatMessage from '../ChatMessage';

export default function ChatMessageExample() {
  return (
    <div className="space-y-4 p-6">
      <ChatMessage
        role="user"
        content="Should I start Jalen Brunson or Tyrese Maxey tonight?"
        timestamp="2:34 PM"
      />
      <ChatMessage
        role="assistant"
        content="Based on tonight's matchups, I'd recommend starting Jalen Brunson. He's facing the Wizards who rank 28th in defensive rating, while Maxey faces the Celtics with a top-5 defense. Brunson is averaging 28.5 PPG in his last 3 games."
        sources={["BALLDONTLIE", "Reddit"]}
        timestamp="2:34 PM"
      />
    </div>
  );
}