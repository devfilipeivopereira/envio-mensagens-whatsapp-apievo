import { describe, expect, it } from "vitest";
import { isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

describe("phone utils", () => {
  it("normalizes by keeping only digits", () => {
    expect(normalizePhoneNumber("+55 (11) 99999-9999")).toBe("5511999999999");
  });

  it("validates length between 10 and 15", () => {
    expect(isValidPhoneNumber("5511999999999")).toBe(true);
    expect(isValidPhoneNumber("12345")).toBe(false);
    expect(isValidPhoneNumber("1234567890123456")).toBe(false);
  });
});
