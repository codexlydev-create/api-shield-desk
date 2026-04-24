export function CodexlyFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-6 text-center text-xs text-muted-foreground sm:px-6 ${className}`}
    >
      A product of{" "}
      <a
        href="https://codexly.lovable.app/"
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-gradient-sunset underline-offset-4 hover:underline"
      >
        Codexly
      </a>
    </footer>
  );
}
