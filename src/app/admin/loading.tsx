export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  );
}
