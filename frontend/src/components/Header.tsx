import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Icon3D } from "@/components/Icon3D";
import { DrawnIcon, type DrawnIconName } from "@/components/DrawnIcon";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { initialsOf, useAuth, type User } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import type { TranslationKey } from "@/lib/i18n";

const navigation: { label: TranslationKey; href: string; icon: DrawnIconName }[] = [
  { label: "nav.dashboard", href: "/", icon: "chart" },
  { label: "nav.newAssessment", href: "/assess", icon: "droplet" },
  { label: "nav.settings", href: "/settings", icon: "cog" },
];

export const UserAvatar = ({ user, className = "h-9 w-9 text-sm" }: { user: User; className?: string }) => (
  <span
    className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-ocean font-semibold text-white shadow-water ${className}`}
    aria-hidden="true"
  >
    {initialsOf(user.name)}
  </span>
);

export const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, openAuthModal, logout } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = () => {
    logout();
    setIsMenuOpen(false);
    toast({ title: t("auth.signedOut") });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* Logo */}
          <Link to="/" className="flex items-center transition-opacity hover:opacity-90" aria-label="Barkha.Ai home">
            <BrandLogo tagline />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navigation.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                  isActive(item.href)
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <DrawnIcon name={item.icon} className="h-5 w-5" />
                <span>{t(item.label)}</span>
              </Link>
            ))}
          </nav>

          {/* Language, account and CTA */}
          <div className="hidden lg:flex items-center gap-2">
            <LanguageSwitcher compact />
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full p-0.5 pe-3 hover:bg-muted/50 transition-colors"
                    aria-label={user.name}
                  >
                    <UserAvatar user={user} />
                    <span className="max-w-[8rem] truncate text-sm font-medium">{user.name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <p className="truncate">{user.name}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/settings")}>
                    <DrawnIcon name="cog" className="h-4 w-4 me-2" />
                    {t("nav.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/settings?tab=history")}>
                    <DrawnIcon name="document" className="h-4 w-4 me-2" />
                    {t("auth.myAssessments")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleSignOut}>
                    <LogOut className="h-4 w-4 me-2" />
                    {t("auth.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button size="sm" variant="outline" onClick={openAuthModal}>
                <LogIn className="h-4 w-4 me-2" />
                {t("auth.signIn")}
              </Button>
            )}
            <Button size="sm" variant="ocean" className="hidden xl:inline-flex" asChild>
              <Link to="/assess">{t("nav.startAssessment")}</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <LanguageSwitcher compact />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label={t("nav.toggleMenu")}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="lg:hidden pb-3">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-card/50 backdrop-blur-sm rounded-lg mt-2 border border-border/40">
              {user && (
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 mb-1">
                  <UserAvatar user={user} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              )}
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <DrawnIcon name={item.icon} className="h-6 w-6" />
                  <span>{t(item.label)}</span>
                </Link>
              ))}
              <div className="pt-2 grid gap-2">
                {user ? (
                  <Button size="sm" variant="outline" className="w-full" onClick={handleSignOut}>
                    <LogOut className="h-4 w-4 me-2" />
                    {t("auth.signOut")}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsMenuOpen(false);
                      openAuthModal();
                    }}
                  >
                    <LogIn className="h-4 w-4 me-2" />
                    {t("auth.signIn")}
                  </Button>
                )}
                <Button size="sm" variant="ocean" className="w-full" asChild>
                  <Link to="/assess" onClick={() => setIsMenuOpen(false)}>
                    {t("nav.startAssessment")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
