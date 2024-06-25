import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema(
  {
    contacts: defineTable({
      givenName: v.string(),
      surname: v.string(),
      phone: v.string(),
    }).index("name", ["surname", "givenName"]),
    contactCount: defineTable({
      count: v.number(),
    }),
  },
);
