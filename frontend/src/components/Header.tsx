import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: "Overview", href: "/" },
    { name: "Assessment", href: "/assess" },
    { name: "Satellite Analysis", href: "/satellite" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="w-full">
      {/* Announcement bar — the only dark surface on the page */}
      <div className="bg-obsidian text-paper-white">
        <div className="mx-auto flex h-10 max-w-page items-center justify-center gap-2 px-6 text-xs">
          <span className="status-dot" aria-hidden="true" />
          <span className="text-paper-white/80">Satellite rooftop analysis is now live.</span>
          <Link to="/satellite" className="text-paper-white underline underline-offset-4 hover:opacity-80">
            Try it
          </Link>
        </div>
      </div>

      {/* Primary navigation — no border, no shadow, not sticky */}
      <div className="bg-background">
        <div className="mx-auto flex h-16 max-w-page items-center justify-between px-6">
          <Link to="/" className="text-base font-medium uppercase text-foreground" style={{ letterSpacing: "0.12em" }}>
            Barkha<span className="text-muted-foreground">.ai</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(item.href)
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-slate"
                }`}
              >
                {item.name}
              </Link>
            ))}
            <Button size="sm" className="ml-3" asChild>
              <Link to="/assess">Start assessment</Link>
            </Button>
          </nav>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="rounded-lg p-2 text-slate transition-colors hover:bg-secondary md:hidden"
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="border-t border-border px-6 pb-4 md:hidden">
            <nav className="flex flex-col pt-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`rounded-lg px-3 py-3 text-sm transition-colors ${
                    isActive(item.href) ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <Button className="mt-3 w-full" asChild>
                <Link to="/assess" onClick={() => setIsMenuOpen(false)}>Start assessment</Link>
              </Button>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
