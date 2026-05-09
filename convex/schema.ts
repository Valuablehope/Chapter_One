import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * schemaValidation: false — disables document-level field validation so
 * existing CFMS documents aren't rejected. Indexes are still enforced and
 * managed by this schema definition.
 */
export default defineSchema(
  {
    // ── Chapter One POS license tables ────────────────────────────────────
    chapterone_licenses: defineTable({
      licenseHash:               v.string(),
      licensePrefix:             v.string(),
      plan:                      v.string(),
      validityDays:              v.number(),
      status: v.union(
        v.literal("active"),
        v.literal("consumed"),
        v.literal("revoked"),
        v.literal("suspended")
      ),
      product:                   v.optional(v.string()),
      customerName:              v.optional(v.string()),
      customerEmail:             v.optional(v.string()),
      companyName:               v.optional(v.string()),
      storeName:                 v.optional(v.string()),
      createdBy:                 v.optional(v.string()),
      issuedAt:                  v.optional(v.number()),
      createdAt:                 v.optional(v.number()),
      consumedAt:                v.optional(v.number()),
      consumedByStoreId:         v.optional(v.string()),
      consumedByDeviceId:        v.optional(v.string()),
      consumedByInstallationId:  v.optional(v.string()),
      updatedAt:                 v.number(),
    })
      .index("by_licenseHash",         ["licenseHash"])
      .index("by_status",              ["status"])
      .index("by_plan",                ["plan"])
      .index("by_customerEmail",       ["customerEmail"])
      .index("by_consumedByStoreId",   ["consumedByStoreId"])
      .index("by_consumedByDeviceId",  ["consumedByDeviceId"]),

    chapterone_pos_subscriptions: defineTable({
      storeId:          v.string(),
      plan:             v.string(),
      validFrom:        v.number(),
      validUntil:       v.number(),
      convexLicenseId:  v.id("chapterone_licenses"),
      licensePrefix:    v.string(),
      deviceId:         v.optional(v.string()),
      installationId:   v.optional(v.string()),
      customerName:     v.optional(v.string()),
      customerEmail:    v.optional(v.string()),
      companyName:      v.optional(v.string()),
      storeName:        v.optional(v.string()),
      updatedAt:        v.number(),
      createdAt:        v.number(),
    }).index("by_storeId", ["storeId"]),

    // ── CFMS tables — indexes restored ────────────────────────────────────
    expenses: defineTable({
      vendorId:  v.optional(v.string()),
      category:  v.optional(v.string()),
    })
      .index("by_vendor",   ["vendorId"])
      .index("by_category", ["category"]),

    invoices: defineTable({
      status:    v.optional(v.string()),
      clientId:  v.optional(v.string()),
      projectId: v.optional(v.string()),
    })
      .index("by_status",  ["status"])
      .index("by_client",  ["clientId"])
      .index("by_project", ["projectId"]),

    payments: defineTable({
      invoiceId: v.optional(v.string()),
    }).index("by_invoice", ["invoiceId"]),

    clientSubscriptions: defineTable({
      clientId: v.optional(v.string()),
    }).index("by_client", ["clientId"]),

    products: defineTable({
      status: v.optional(v.string()),
    }).index("by_status", ["status"]),

    contracts: defineTable({
      clientId:  v.optional(v.string()),
      projectId: v.optional(v.string()),
    })
      .index("by_client",  ["clientId"])
      .index("by_project", ["projectId"]),

    projects: defineTable({
      clientId: v.optional(v.string()),
    }).index("by_client", ["clientId"]),

    subscriptions: defineTable({
      status: v.optional(v.string()),
    }).index("by_status", ["status"]),
  },
  { schemaValidation: false }
);
