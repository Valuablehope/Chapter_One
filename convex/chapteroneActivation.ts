/**
 * Chapter One POS — License Activation Mutation
 *
 * Add this file to your CFMS Convex project.
 * Also add the following tables to your convex/schema.ts:
 *
 *   chapterone_licenses: defineTable({
 *     licenseHash:               v.string(),
 *     licensePrefix:             v.string(),
 *     plan:                      v.string(),
 *     validityDays:              v.number(),
 *     status:                    v.union(
 *                                  v.literal("active"),
 *                                  v.literal("consumed"),
 *                                  v.literal("revoked"),
 *                                  v.literal("suspended")
 *                                ),
 *     customerName:              v.optional(v.string()),
 *     customerEmail:             v.optional(v.string()),
 *     companyName:               v.optional(v.string()),
 *     storeName:                 v.optional(v.string()),
 *     consumedAt:                v.optional(v.number()),
 *     consumedByStoreId:         v.optional(v.string()),
 *     consumedByDeviceId:        v.optional(v.string()),
 *     consumedByInstallationId:  v.optional(v.string()),
 *     updatedAt:                 v.number(),
 *     createdAt:                 v.number(),
 *   }).index("by_licenseHash", ["licenseHash"]),
 *
 *   chapterone_pos_subscriptions: defineTable({
 *     storeId:          v.string(),
 *     plan:             v.string(),
 *     validFrom:        v.number(),
 *     validUntil:       v.number(),
 *     convexLicenseId:  v.id("chapterone_licenses"),
 *     licensePrefix:    v.string(),
 *     deviceId:         v.optional(v.string()),
 *     installationId:   v.optional(v.string()),
 *     customerName:     v.optional(v.string()),
 *     customerEmail:    v.optional(v.string()),
 *     companyName:      v.optional(v.string()),
 *     storeName:        v.optional(v.string()),
 *     updatedAt:        v.number(),
 *     createdAt:        v.number(),
 *   }).index("by_storeId", ["storeId"]),
 */

import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

// Called from the HTTP action — atomically validates and consumes a license by its hash.
export const consumeLicenseByHash = internalMutation({
  args: { licenseHash: v.string() },
  handler: async (ctx, { licenseHash }) => {
    const license = await ctx.db
      .query("chapterone_licenses")
      .withIndex("by_licenseHash", (q) => q.eq("licenseHash", licenseHash))
      .first();

    if (!license || license.status !== "active") return false;

    await ctx.db.patch(license._id, {
      status:    "consumed",
      consumedAt: Date.now(),
      updatedAt:  Date.now(),
    });

    return true;
  },
});

export const activateLicense = mutation({
  args: {
    licenseKey:      v.string(),
    storeId:         v.string(),
    deviceId:        v.optional(v.string()),
    installationId:  v.optional(v.string()),
    customerName:    v.optional(v.string()),
    customerEmail:   v.optional(v.string()),
    companyName:     v.optional(v.string()),
    storeName:       v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Normalize and hash the license key
    const normalized = args.licenseKey.trim().toUpperCase();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(normalized)
    );
    const licenseHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Lookup by hash
    const license = await ctx.db
      .query("chapterone_licenses")
      .withIndex("by_licenseHash", (q) => q.eq("licenseHash", licenseHash))
      .first();

    if (!license) {
      return { success: false as const, reason: "LICENSE_NOT_FOUND" };
    }

    switch (license.status) {
      case "consumed":
        return { success: false as const, reason: "LICENSE_ALREADY_CONSUMED" };
      case "revoked":
        return { success: false as const, reason: "LICENSE_REVOKED" };
      case "suspended":
        return { success: false as const, reason: "LICENSE_SUSPENDED" };
      default:
        if (license.status !== "active") {
          return { success: false as const, reason: "LICENSE_NOT_ACTIVE" };
        }
    }

    const validityMs = license.validityDays * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Extend existing subscription or create a new one
    const existing = await ctx.db
      .query("chapterone_pos_subscriptions")
      .withIndex("by_storeId", (q) => q.eq("storeId", args.storeId))
      .first();

    const newValidFrom =
      existing && existing.validUntil > now ? existing.validFrom : now;
    const newValidUntil =
      existing && existing.validUntil > now
        ? existing.validUntil + validityMs
        : now + validityMs;

    const resolvedCustomerName  = args.customerName  ?? license.customerName;
    const resolvedCustomerEmail = args.customerEmail ?? license.customerEmail;
    const resolvedCompanyName   = args.companyName   ?? license.companyName;
    const resolvedStoreName     = args.storeName     ?? license.storeName;

    let subscriptionId: string;

    if (existing) {
      await ctx.db.patch(existing._id, {
        plan:             license.plan,
        validFrom:        newValidFrom,
        validUntil:       newValidUntil,
        convexLicenseId:  license._id,
        licensePrefix:    license.licensePrefix,
        deviceId:         args.deviceId,
        installationId:   args.installationId,
        customerName:     resolvedCustomerName,
        customerEmail:    resolvedCustomerEmail,
        companyName:      resolvedCompanyName,
        storeName:        resolvedStoreName,
        updatedAt:        now,
      });
      subscriptionId = existing._id.toString();
    } else {
      const newId = await ctx.db.insert("chapterone_pos_subscriptions", {
        storeId:          args.storeId,
        plan:             license.plan,
        validFrom:        newValidFrom,
        validUntil:       newValidUntil,
        convexLicenseId:  license._id,
        licensePrefix:    license.licensePrefix,
        deviceId:         args.deviceId,
        installationId:   args.installationId,
        customerName:     resolvedCustomerName,
        customerEmail:    resolvedCustomerEmail,
        companyName:      resolvedCompanyName,
        storeName:        resolvedStoreName,
        updatedAt:        now,
        createdAt:        now,
      });
      subscriptionId = newId.toString();
    }

    // Mark license as consumed — atomic within this mutation
    await ctx.db.patch(license._id, {
      status:                   "consumed",
      consumedAt:               now,
      consumedByStoreId:        args.storeId,
      consumedByDeviceId:       args.deviceId,
      consumedByInstallationId: args.installationId,
      updatedAt:                now,
    });

    return {
      success:        true as const,
      reason:         "LICENSE_ACTIVATED",
      plan:           license.plan,
      validityDays:   license.validityDays,
      validFrom:      newValidFrom,
      validUntil:     newValidUntil,
      storeId:        args.storeId,
      deviceId:       args.deviceId,
      installationId: args.installationId,
      subscriptionId,
      licenseId:      license._id.toString(),
      licensePrefix:  license.licensePrefix,
      customerName:   resolvedCustomerName,
      customerEmail:  resolvedCustomerEmail,
      companyName:    resolvedCompanyName,
      storeName:      resolvedStoreName,
    };
  },
});
