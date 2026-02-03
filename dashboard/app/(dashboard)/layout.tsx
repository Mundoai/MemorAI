import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar userRole={(session.user as { role?: string }).role} />
      <div className="flex flex-1 flex-col pl-64">
        <Header user={session.user} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
