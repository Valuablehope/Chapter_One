import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { HttpRouter } from "convex/server";

const http = new HttpRouter();

http.route({
  path: "/activatelicense",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify(false), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const licenseKey = body?.license;
    if (!licenseKey || typeof licenseKey !== "string") {
      return new Response(JSON.stringify(false), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Stored hash was computed from the 4-segment key (XXXX-XXXX-XXXX-XXXX).
    // Strip the "CH1-" product prefix before hashing so both old and new keys match.
    const normalized = licenseKey.trim().toUpperCase();
    const toHash = normalized.startsWith("CH1-") ? normalized.slice(4) : normalized;
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(toHash)
    );
    const licenseHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const result = await ctx.runMutation(
      internal.chapteroneActivation.consumeLicenseByHash,
      { licenseHash }
    );

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
