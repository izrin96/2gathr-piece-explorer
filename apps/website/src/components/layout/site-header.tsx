import { Link } from "@tanstack/react-router";

import { ThemeToggle } from "@/components/layout/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link to="/" className="text-sm font-semibold">
          2GATHR Piece Explorer
        </Link>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
