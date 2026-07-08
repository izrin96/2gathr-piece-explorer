import { describe, expect, it } from "vitest";

import { parsePieceMetadata } from "./metadata.js";

const NAHYUN = {
  name: "NAHYUN #001",
  description: "Take a look at the photo of the lovely AtHeart member NAHYUN !",
  image: "https://gateway.pinata.cloud/ipfs/bafyimg",
  extension: "png",
  alt_url: "https://topport.s3.ap-northeast-2.amazonaws.com/item/thumbnail/x_NAHYUN%20%23001.jpeg",
  animation_url: "",
  rarity: 1,
  attributes: [
    { trait_type: "Artist", value: "AtHeart" },
    { trait_type: "Member", value: "Nahyun" },
    { trait_type: "Serial", value: "1" },
    { trait_type: "Type", value: "Image" },
  ],
};

const ANIMATED = {
  name: "NAHYUN #002",
  image: "https://gateway.pinata.cloud/ipfs/bafyimg2",
  extension: "mp4",
  alt_url: "",
  animation_url: "https://gateway.pinata.cloud/ipfs/bafyanim",
  rarity: 1,
  attributes: [{ trait_type: "Member", value: "Nahyun" }],
};

const NO_MEMBER_ATTR = {
  name: "ARIN #002",
  image: "https://gateway.pinata.cloud/ipfs/bafyimg3",
  extension: "png",
  alt_url: "",
  animation_url: "",
  rarity: 1,
  attributes: [{ trait_type: "Serial", value: "2" }],
};

const HIDDEN = {
  name: "SEOHYEON (Hidden) #001",
  image: "https://gateway.pinata.cloud/ipfs/bafyhidden",
  extension: "png",
  alt_url: "https://topport.s3.ap-northeast-2.amazonaws.com/item/thumbnail/y_seohyeon.jpeg",
  rarity: 1,
  attributes: [
    { trait_type: "Member", value: "Seohyeon" },
    { trait_type: "Hidden", value: "True" },
  ],
};

describe("parsePieceMetadata", () => {
  it("parses a standard piece, preferring the Member attribute", () => {
    const r = parsePieceMetadata(NAHYUN);
    expect(r.member).toBe("Nahyun");
    expect(r.designNumber).toBe(1);
    expect(r.rarity).toBe(1);
    expect(r.mediaType).toBe("png");
    expect(r.isHidden).toBe(false);
    expect(r.imageUrl).toContain("ipfs/bafyimg");
    expect(r.thumbnailUrl).toContain("topport");
    expect(r.animationUrl).toBeNull();
  });

  it("detects a hidden piece from attributes", () => {
    const r = parsePieceMetadata(HIDDEN);
    expect(r.member).toBe("Seohyeon");
    expect(r.isHidden).toBe(true);
  });

  it("normalizes member casing from the name-fallback path when no Member attribute is present", () => {
    const r = parsePieceMetadata(NO_MEMBER_ATTR);
    expect(r.member).toBe("Arin");
    expect(r.designNumber).toBe(2);
  });

  it("maps empty alt_url to null thumbnailUrl and passes through a populated animation_url", () => {
    const r = parsePieceMetadata(ANIMATED);
    expect(r.thumbnailUrl).toBeNull();
    expect(r.animationUrl).toBe("https://gateway.pinata.cloud/ipfs/bafyanim");
  });

  it("throws on malformed metadata", () => {
    expect(() => parsePieceMetadata({ foo: "bar" })).toThrow();
  });
});
