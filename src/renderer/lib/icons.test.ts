import { describe, expect, it } from "vitest";
import { iconStyle, icons, type IconName } from "./icons";

describe("iconStyle", () => {
  it("produces CSS strings without escapes", () => {
    for (const name of Object.keys(icons) as IconName[]) {
      const url = iconStyle(name).slice('--icon: url("'.length, -'")'.length);
      expect(url, name).toMatch(/^data:image\/svg\+xml,/);
      expect(url, name).not.toMatch(/[\\"\n]/);
    }
  });
});
