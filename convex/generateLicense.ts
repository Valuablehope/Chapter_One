import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Characters used in license keys — no ambiguous chars (0/O, 1/I/L)
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function buildLicenseKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes)
    .map((b) => CHARSET[b % CHARSET.length])
    .join("");
  // Returns full format: CH1-XXXX-XXXX-XXXX-XXXX
  return [
    "CH1",
    chars.slice(0, 4),
    chars.slice(4, 8),
    chars.slice(8, 12),
    chars.slice(12, 16),
  ].join("-");
}

async function hashKey(licenseKey: string): Promise<string> {
  // Hash only the 4-segment part (strip CH1- prefix) so the HTTP endpoint
  // and generator stay in sync even when the prefix changes.
  const normalized = licenseKey.trim().toUpperCase();
  const toHash = normalized.startsWith("CH1-") ? normalized.slice(4) : normalized;
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(toHash)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a new license key and store only its hash in Convex.
 * The raw key is returned ONCE — save it and hand it to the customer.
 * It is never stored in plaintext; the hash is what Convex holds.
 */
export const generateLicense = mutation({
  args: {
    plan:          v.string(),
    validityDays:  v.number(),
    customerName:  v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    companyName:   v.optional(v.string()),
    storeName:     v.optional(v.string()),
    product:       v.optional(v.string()),
    createdBy:     v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate key + hash, retry on the (astronomically unlikely) collision
    let licenseKey: string;
    let licenseHash: string;
    let attempts = 0;

    do {
      licenseKey  = buildLicenseKey();
      licenseHash = await hashKey(licenseKey);
      const collision = await ctx.db
        .query("chapterone_licenses")
        .withIndex("by_licenseHash", (q) => q.eq("licenseHash", licenseHash))
        .first();
      if (!collision) break;
      attempts++;
    } while (attempts < 5);

    if (attempts >= 5) {
      throw new Error("Could not generate a unique license key. Please retry.");
    }

    // Prefix: first 3 segments  e.g. "CH1-ABCD-EFGH"
    const parts         = licenseKey.split("-");
    const licensePrefix = parts.slice(0, 3).join("-");
    const now           = Date.now();

    const licenseId = await ctx.db.insert("chapterone_licenses", {
      licenseHash,
      licensePrefix,
      plan:          args.plan,
      validityDays:  args.validityDays,
      status:        "active",
      product:       args.product       ?? "chapterone_pos",
      customerName:  args.customerName,
      customerEmail: args.customerEmail,
      companyName:   args.companyName,
      storeName:     args.storeName,
      createdBy:     args.createdBy     ?? "system",
      issuedAt:      now,
      updatedAt:     now,
    });

    // ⚠ This is the ONLY moment the raw key is available.
    // It is never stored in Convex — only the SHA-256 hash is persisted.
    return {
      licenseKey,             // e.g. "ABCD-EFGH-JKMN-PQRS"  ← give this to the customer
      licensePrefix,          // e.g. "CH1-ABCD-EFGH"
      licenseId:  licenseId.toString(),
      plan:       args.plan,
      validityDays: args.validityDays,
      issuedAt:   now,
    };
  },
});

/**
 * List all licenses (without exposing hashes or raw keys).
 * Optionally filter by status or plan.
 */
export const listLicenses = query({
  args: {
    status: v.optional(v.string()),
    plan:   v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("chapterone_licenses");

    const rows = await (
      args.status
        ? q.withIndex("by_status", (i) => i.eq("status", args.status!))
        : args.plan
        ? q.withIndex("by_plan",   (i) => i.eq("plan",   args.plan!))
        : q
    ).collect();

    // Strip the hash — never expose it over the wire
    return rows.map(({ licenseHash: _h, ...safe }) => safe);
  },
});

/**
 * Revoke a license so it can never be activated.
 */
export const revokeLicense = mutation({
  args: {
    licenseId: v.id("chapterone_licenses"),
    revokedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const license = await ctx.db.get(args.licenseId);
    if (!license) throw new Error("License not found");
    if (license.status === "consumed") {
      throw new Error("License has already been consumed and cannot be revoked");
    }
    await ctx.db.patch(args.licenseId, {
      status:    "revoked",
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
