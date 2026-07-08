import { describe, expect, it } from "vitest";

import { pickMediaSource } from "./media";

describe("pickMediaSource", () => {
  it("prefers the animation, with the original image as poster", () => {
    expect(
      pickMediaSource({
        animationUrl: "https://cdn.example/a.mp4",
        imageUrl: "https://cdn.example/a.png",
      }),
    ).toEqual({
      kind: "video",
      src: "https://cdn.example/a.mp4",
      poster: "https://cdn.example/a.png",
    });
  });

  it("uses the original image when there is no animation", () => {
    expect(pickMediaSource({ animationUrl: null, imageUrl: "https://cdn.example/a.png" })).toEqual({
      kind: "image",
      src: "https://cdn.example/a.png",
    });
  });

  it("returns none when there is no media at all", () => {
    expect(pickMediaSource({ animationUrl: null, imageUrl: null })).toEqual({ kind: "none" });
  });

  it("plays the animation even without a poster image", () => {
    expect(pickMediaSource({ animationUrl: "https://cdn.example/a.mp4", imageUrl: null })).toEqual({
      kind: "video",
      src: "https://cdn.example/a.mp4",
      poster: null,
    });
  });
});
