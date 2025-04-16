export function ScrollArea({ children }: { children: React.ReactNode }) {
  return <div style={{ maxHeight: '100%', overflowY: 'auto', paddingRight: '6px' }}>{children}</div>;
}
