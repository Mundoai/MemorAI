import { Brain } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "./signin-form";

export default function LoginPage() {
  // Check env vars at RUNTIME (inside component), not build time (module scope).
  // Docker builds don't have env vars, so module-scope checks always return false.
  const hasGitHub =
    !!process.env.AUTH_GITHUB_ID && !!process.env.AUTH_GITHUB_SECRET;
  const hasGoogle =
    !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Welcome to MemorAI</CardTitle>
          <CardDescription>
            Sign in to manage your AI agent memories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm hasGoogle={hasGoogle} hasGitHub={hasGitHub} />
        </CardContent>
      </Card>
    </div>
  );
}
