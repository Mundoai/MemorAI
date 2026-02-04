import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "./signout-button";

interface HeaderProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div />
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name ?? ""}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
              <User className="h-4 w-4" />
            </div>
          )}
          <span className="text-sm text-muted-foreground">
            {user?.name ?? user?.email}
          </span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
