import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { faker } from '@faker-js/faker';
import { getPage } from "convex-helpers/server/pagination";
import schema from "./schema";


export const makeRandomContact = mutation({
  args: {},
  handler: async (ctx) => {
    faker.seed();
    await ctx.db.insert("contacts", {
      givenName: faker.person.firstName(),
      surname: faker.person.lastName(),
      phone: faker.phone.number(),
    });
    const countDoc = await ctx.db.query("contactCount").unique();
    if (!countDoc) {
      await ctx.db.insert("contactCount", { count: (await (ctx.db.query("contacts") as any).count()) });
    } else {
      await ctx.db.patch(countDoc._id, { count: countDoc.count + 1 });
    }
  },
});

export const contactCount = query({
  args: {},
  handler: async (ctx) => {
    const countDoc = await ctx.db.query("contactCount").unique();
    return countDoc?.count;
  },
});

export const allContacts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("contacts").withIndex("name").collect();
  },
});

export const contactsPage = query({
  args: {
    startIndexKey: v.optional(v.array(v.any())),
    endIndexKey: v.optional(v.array(v.any())),
    startInclusive: v.optional(v.boolean()),
    endInclusive: v.optional(v.boolean()),
    order: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    console.log(`getPage ${JSON.stringify(args)}`);
    return await getPage(ctx, {
      table: "contacts",
      index: "name",
      schema,
      targetMaxRows: 10,
      ...args,
    });
  },
});

