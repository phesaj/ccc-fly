export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid #ccc',
        borderRadius: '12px',
        background: '#f9f9f9',
        marginBottom: '12px',
        boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
        transition: 'transform 0.2s ease',
      }}
    >
      {children}
    </div>
  );
}
export function CardContent({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '0.95rem',
        lineHeight: '1.4',
      }}
    >
      {children}
    </div>
  );
}
