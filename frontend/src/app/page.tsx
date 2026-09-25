"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PageLoader } from "@/components/ui";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return <PageLoader />;
}
