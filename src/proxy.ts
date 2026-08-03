import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/session";

export default async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /**
     * Every path except static assets and image files. Auth cookies are
     * irrelevant to those, and running on them would waste an auth-server
     * round trip per asset.
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
