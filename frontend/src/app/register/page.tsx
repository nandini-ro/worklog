import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { PageLoader } from "@/components/ui";

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
