import { describe, expect, it } from "vitest";

import { parseTopportBox } from "./topport.js";
import { topportBoxSchema } from "./types/topport.js";

const BOX_258 = {
  id: 258,
  title: { en: "2026 Season 3", ko: "" },
  rarityLevel: 3,
  boxContractAddress: "0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884",
  chainId: 84358,
  totalAmount: 10000,
  usedAmount: 0,
  mysteryboxItems: [
    {
      no: 1,
      name: "BOME #022",
      originalImage: "https://topport.s3.ap-northeast-2.amazonaws.com/item/BOME%20%23022.png",
      itemImage:
        "https://topport.s3.ap-northeast-2.amazonaws.com/item/thumbnail/BOME%20%23022.jpeg",
      imageLink: "https://gateway.pinata.cloud/ipfs/bafyimg258",
      metaLink: "https://gateway.pinata.cloud/ipfs/Qmmeta258",
    },
  ],
};

describe("topportBoxSchema", () => {
  it("leniently parses a detail with unknown extra fields", () => {
    const box = topportBoxSchema.parse({ ...BOX_258, someFutureField: true });
    expect(box.boxContractAddress).toBe("0x2E0D21DD8dF92e0a1594DaE25d83696ea8BA7884");
    expect(box.rarityLevel).toBe(3);
  });

  it("types symbol, price, and releaseDatetime", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      symbol: "AtHeart",
      price: 20,
      releaseDatetime: "2026-06-30T14:00:00.000Z",
    });
    expect(box.symbol).toBe("AtHeart");
    expect(box.price).toBe(20);
    expect(box.releaseDatetime).toBe("2026-06-30T14:00:00.000Z");
  });
});

describe("parseTopportBox", () => {
  it("maps a box to a ParsedTopportDesign", () => {
    const box = topportBoxSchema.parse(BOX_258);
    const d = parseTopportBox(box, "2026 Season 3 (fallback)");
    expect(d.contractAddress).toBe("0x2e0d21dd8df92e0a1594dae25d83696ea8ba7884");
    expect(d.member).toBe("Bome");
    expect(d.designNumber).toBe(22);
    expect(d.rarity).toBe(3); // no item.rarity here -> falls back to box.rarityLevel
    expect(d.classLetter).toBe("S");
    expect(d.edition).toBe("2026 Season 3");
    expect(d.imageUrl).toContain("topport.s3");
    expect(d.thumbnailUrl).toContain("topport");
    expect(d.mediaType).toBe("png");
    expect(d.isHidden).toBe(false);
  });

  it("uses the item's rarity (not box rarityLevel) for the class and derives the letter", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258, // box.rarityLevel = 3
      mysteryboxItems: [{ ...BOX_258.mysteryboxItems[0], rarity: 2 }],
    });
    const d = parseTopportBox(box, "2026 Season 3");
    expect(d.rarity).toBe(2); // item.rarity wins over box.rarityLevel (3)
    expect(d.classLetter).toBe("A");
  });

  it("falls back to the provided edition when title is empty", () => {
    const box = topportBoxSchema.parse({ ...BOX_258, title: { en: "" } });
    const d = parseTopportBox(box, "Welcome");
    expect(d.edition).toBe("Welcome");
  });

  it("returns nulls for member/design when the item name is non-standard and has no properties", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      mysteryboxItems: [{ name: "Welcome to 2GATHR", imageLink: "https://x/y.png" }],
    });
    const d = parseTopportBox(box, "Welcome");
    expect(d.member).toBeNull();
    expect(d.designNumber).toBeNull();
  });

  it("takes member from item properties when the name doesn't encode it", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      mysteryboxItems: [
        {
          name: "KEKE (for KATELYN)",
          imageLink: "https://x/y.png",
          properties: [
            { type: "Artist", name: "AtHeart" },
            { type: "Member", name: "Katelyn" },
            { type: "Type", name: "3D" },
          ],
        },
      ],
    });
    const d = parseTopportBox(box, "Welcome");
    expect(d.member).toBe("Katelyn"); // from the Member property, not the puppy display name
    expect(d.designNumber).toBeNull(); // name has no #NNN
  });

  it("reads isHidden from the Hidden property", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      mysteryboxItems: [
        {
          name: "BOME (Hidden) #001",
          properties: [
            { type: "Member", name: "Bome" },
            { type: "Hidden", name: "True" },
          ],
        },
      ],
    });
    const d = parseTopportBox(box, "Hidden Piece");
    expect(d.member).toBe("Bome");
    expect(d.isHidden).toBe(true);
  });

  it("leaves member null when properties have no Member (genuine group piece)", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      mysteryboxItems: [
        {
          name: "Welcome to 2GATHR",
          properties: [
            { type: "Artist", name: "AtHeart" },
            { type: "Series", name: "2GATHR" },
          ],
        },
      ],
    });
    const d = parseTopportBox(box, "Welcome");
    expect(d.member).toBeNull();
  });

  it("extracts artist, series, type, serial, topportId, releaseDatetime, and price", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      symbol: "AtHeart",
      price: 20,
      releaseDatetime: "2026-06-30T14:00:00.000Z",
      mysteryboxItems: [
        {
          ...BOX_258.mysteryboxItems[0],
          properties: [
            { type: "Artist", name: "AtHeart" },
            { type: "Series", name: "AtHeart" },
            { type: "Type", name: "Image" },
            { type: "Serial", name: "22" },
            { type: "Member", name: "Bome" },
          ],
        },
      ],
    });
    const d = parseTopportBox(box, "2026 Season 3");
    expect(d.artist).toBe("AtHeart");
    expect(d.series).toBe("AtHeart");
    expect(d.type).toBe("Image");
    expect(d.serial).toBe(22);
    expect(d.topportId).toBe(258);
    expect(d.releaseDatetime).toBe("2026-06-30T14:00:00.000Z");
    expect(d.price).toBe(20);
  });

  it("falls back to box.symbol for series when the Series property is absent", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      symbol: "Puppy AtHeart",
      mysteryboxItems: [
        {
          ...BOX_258.mysteryboxItems[0],
          properties: [{ type: "Artist", name: "AtHeart" }],
        },
      ],
    });
    const d = parseTopportBox(box, "Welcome");
    expect(d.series).toBe("Puppy AtHeart");
  });

  it("reads serial=0 from a Hidden piece while design_number stays name-derived", () => {
    const box = topportBoxSchema.parse({
      ...BOX_258,
      mysteryboxItems: [
        {
          name: "BOME (Hidden) #001",
          properties: [
            { type: "Member", name: "Bome" },
            { type: "Serial", name: "0" },
            { type: "Hidden", name: "True" },
          ],
        },
      ],
    });
    const d = parseTopportBox(box, "Hidden Piece");
    expect(d.serial).toBe(0);
    expect(d.designNumber).toBe(1); // parsed from the name "#001"
  });

  it("leaves the new fields null when the box/item lack them", () => {
    const box = topportBoxSchema.parse({
      id: 999,
      title: { en: "Welcome" },
      mysteryboxItems: [{ name: "Welcome to 2GATHR", imageLink: "https://x/y.png" }],
    });
    const d = parseTopportBox(box, "Welcome");
    expect(d.artist).toBeNull();
    expect(d.series).toBeNull();
    expect(d.type).toBeNull();
    expect(d.serial).toBeNull();
    expect(d.price).toBeNull();
    expect(d.releaseDatetime).toBeNull();
    expect(d.topportId).toBe(999); // id is required by the schema
  });
});
