import { Suspense } from "react";
import { UnlockForm } from "@/components/auth-form";
import { PageLoader } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <UnlockForm />
    </Suspense>
  );
}
