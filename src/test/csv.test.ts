import { describe, expect, it } from "vitest";
import { parsePhoneCsv } from "@/lib/csv";

describe("parsePhoneCsv", () => {
  it("imports valid numbers, drops duplicates and invalid values", () => {
    const csv = [
      "numero",
      "5511999999999",
      "55 11 99999-9999",
      "abc",
      "5511988887777",
    ].join("\n");

    const result = parsePhoneCsv(csv);

    expect(result.imported).toEqual(["5511999999999", "5511988887777"]);
    expect(result.duplicates).toEqual(["5511999999999"]);
    expect(result.invalid).toContain("abc");
  });

  it("supports semicolon delimiter", () => {
    const csv = ["numero;nome", "5511999999999;A", "5511988887777;B"].join("\n");
    const result = parsePhoneCsv(csv);

    expect(result.imported).toEqual(["5511999999999", "5511988887777"]);
  });
});
