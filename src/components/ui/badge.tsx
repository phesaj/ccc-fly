export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        padding: '4px 10px',
        background: 'linear-gradient(to right, #00c6ff, #0072ff)',
        borderRadius: '9999px',
        fontSize: '0.8rem',
        fontWeight: 'bold',
        color: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        letterSpacing: '0.5px',
      }}
    >
      {children}
    </span>
  );
}
