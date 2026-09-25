import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { PageLoader } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthForm mode="login" />
    </Suspense>
  );
}
