import { customType } from "drizzle-orm/pg-core";

// Case-insensitive text, used for EVM addresses stored lowercase.
export const citext = customType<{ data: string; driverData: string; config: { length?: number } }>(
  {
    dataType(_config) {
      return "citext";
    },
  },
);
