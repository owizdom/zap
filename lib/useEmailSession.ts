"use client";

import { useSession } from "next-auth/react";

/** Returns the signed-in user's email and session status. */
export function useEmailSession() {
  const { data: session, status } = useSession();
  return {
    email: session?.user?.email ?? "",
    name: session?.user?.name ?? "",
    image: session?.user?.image ?? "",
    isSignedIn: status === "authenticated",
    isLoading: status === "loading",
  };
}
