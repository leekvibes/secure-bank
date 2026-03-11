export default function FraudLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-xl" />
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-48 bg-muted rounded-xl" />
      ))}
    </div>
  );
}
