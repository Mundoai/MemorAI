"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  Search,
  LayoutGrid,
  Settings,
  Shield,
  BookMarked,
  Kanban,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "Memories", href: "/memories", icon: Brain },
  { name: "Search", href: "/search", icon: Search },
  { name: "Spaces", href: "/spaces", icon: LayoutGrid },
  { name: "Bookmarks", href: "/memories?bookmarked=true", icon: BookMarked },
  { name: "Kanban", href: "/spaces?tab=kanban", icon: Kanban },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Admin", href: "/admin", icon: Shield },
];

interface SidebarProps {
  userRole?: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Brain className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold text-foreground">MemorAI</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href.split("?")[0]));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}

        {/* Admin section */}
        {userRole === "superadmin" && (
          <>
            <div className="my-3 border-t border-border" />
            {adminNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className="text-xs text-muted-foreground text-center">
          MemorAI v0.2.0
        </div>
      </div>
    </aside>
  );
}
