import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { Link, useNavigate } from "react-router-dom";
import { DrawnIcon } from "@/components/DrawnIcon";
import { BrandLogo } from "@/components/BrandLogo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { MaintenanceDrawer } from "@/components/MaintenanceDrawer";
import { Pressable } from "@/components/motion/Motion";
import { spring } from "@/components/motion/presets";
import { initialsOf, useAuth, type User } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";

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
  const [serviceOpen, setServiceOpen] = useState(false);
  const navigate = useNavigate();
  const { user, openAuthModal, logout } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();

  const handleSignOut = () => {
    logout();
    setIsMenuOpen(false);
    toast({ title: t("auth.signedOut") });
  };

  const openService = () => {
    setIsMenuOpen(false);
    setServiceOpen(true);
  };

  return (
    <motion.header
      initial={{ y: -64, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link to="/" className="flex items-center transition-opacity hover:opacity-90" aria-label="Barkha.Ai home">
            <BrandLogo tagline />
          </Link>

          {/* Order: Start Assessment, Maintenance & Installation, account, language */}
          <div className="hidden items-center gap-2 lg:flex">
            <Pressable>
              <Button size="sm" variant="ocean" asChild>
                <Link to="/assess">{t("nav.startAssessment")}</Link>
              </Button>
            </Pressable>
            <Pressable>
              <Button size="sm" variant="outline" onClick={openService} className="border-primary/40 text-primary">
                {t("nav.service")}
              </Button>
            </Pressable>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center gap-2 rounded-full p-0.5 pe-3 transition-colors hover:bg-muted/50"
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
                    <DrawnIcon name="cog" className="me-2 h-4 w-4" />
                    {t("nav.settings")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => navigate("/settings?tab=history")}>
                    <DrawnIcon name="document" className="me-2 h-4 w-4" />
                    {t("auth.myAssessments")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleSignOut}>
                    <LogOut className="me-2 h-4 w-4" />
                    {t("auth.signOut")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Pressable>
                <Button size="sm" variant="outline" onClick={openAuthModal}>
                  <LogIn className="me-2 h-4 w-4" />
                  {t("auth.signIn")}
                </Button>
              </Pressable>
            )}
            <LanguageSwitcher iconOnly />
          </div>

          {/* Mobile */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSwitcher iconOnly />
            <motion.button
              whileTap={{ scale: 0.9 }}
              transition={spring}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="rounded-lg p-2 transition-colors hover:bg-muted/50"
              aria-label={t("nav.toggleMenu")}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </motion.button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isMenuOpen && (
            <motion.div
              key="mobile-menu"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="overflow-hidden lg:hidden"
            >
              <div className="mb-3 mt-2 space-y-2 rounded-lg border border-border/40 bg-card/50 p-3 backdrop-blur-sm">
                {user && (
                  <div className="flex items-center gap-3 border-b border-border/40 px-1 pb-3">
                    <UserAvatar user={user} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                )}
                <Button size="sm" variant="ocean" className="w-full" asChild>
                  <Link to="/assess" onClick={() => setIsMenuOpen(false)}>
                    {t("nav.startAssessment")}
                  </Link>
                </Button>
                <Button size="sm" variant="outline" className="w-full border-primary/40 text-primary" onClick={openService}>
                  {t("nav.service")}
                </Button>
                {user ? (
                  <Button size="sm" variant="outline" className="w-full" onClick={handleSignOut}>
                    <LogOut className="me-2 h-4 w-4" />
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
                    <LogIn className="me-2 h-4 w-4" />
                    {t("auth.signIn")}
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <MaintenanceDrawer open={serviceOpen} onOpenChange={setServiceOpen} />
    </motion.header>
  );
};
