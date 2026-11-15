import { describe, expect, it } from "vitest";
import { bare, blankLetter, contractShadda, expandShadda, lamType, letterPositions, noTatweel, taaForm, words } from "../../src/arabic/text";

// Words below are copied from «أحب لغتي» 2، الفصل الأول، الجزء 1 (2026), lesson «لُعْبَتي», pp. 44–47.
describe("Arabic text rules", () => {
  it("strips diacritics and tatweel", () => {
    expect(bare("الدُّمْيَةُ")).toBe("الدمية");
    expect(noTatweel("ـمِيـ")).toBe("مِي");
  });

  it("classifies the lām of the article (p. 46)", () => {
    expect(lamType("السّابِعَةِ")).toBe("sun");
    expect(lamType("السُّلَّمَ")).toBe("sun");
    expect(lamType("الدُّمْيَةُ")).toBe("sun");
    expect(lamType("الْغِبْطَةِ")).toBe("moon");
    expect(lamType("الْماءُ")).toBe("moon");
    expect(lamType("الْفَلَجِ")).toBe("moon");
    expect(lamType("الْقَنْطَرَةِ")).toBe("moon");
    // Not the article: hamzated alif or no ال at all.
    expect(lamType("أَلْعَبُ")).toBeNull();
    expect(lamType("بَيْتٌ")).toBeNull();
  });

  it("splits a printed sentence into words (p. 44: 4 words)", () => {
    expect(words("انْفَلَتَتِ الدُّمْيَةُ مِنْ يَدَيْها.")).toEqual(["انْفَلَتَتِ", "الدُّمْيَةُ", "مِنْ", "يَدَيْها"]);
    expect(words("– رَكَضَتْ بِأَقْدامِها الصَّغيرَةِ حافِيَةً.")).toHaveLength(4);
    expect(words("أَلْعَبُ بِأَلْعابي، ثُمَّ أُرَتِّبُها.")).toHaveLength(4);
  });

  it("finds letter positions in the skeleton (p. 47 words)", () => {
    expect(letterPositions("بَيْتٌ", "ب")).toEqual(["start"]);
    expect(letterPositions("بَيْتٌ", "ت")).toEqual(["end"]);
    expect(letterPositions("كَبُرَتْ", "ب")).toEqual(["middle"]);
    expect(letterPositions("اخْتَفَتْ", "ت")).toEqual(["middle", "end"]);
    expect(letterPositions("ثَوْبٌ", "ث")).toEqual(["start"]);
  });

  it("hides one letter together with its diacritics", () => {
    expect(blankLetter("ثَوْبٌ", "ث")).toEqual({ shown: "؟وْبٌ", index: 0 });
    expect(blankLetter("بَيْتٌ", "ت")?.shown).toBe("بَيْ؟");
    expect(blankLetter("بَيْتٌ", "ث")).toBeNull();
  });

  it("expands a shadda the way the syllable cards split it (p. 44 «عَمُّها»)", () => {
    expect(expandShadda("عَمُّها")).toBe("عَمْمُها");
    expect(expandShadda("عَمُّها")).toBe(expandShadda("عَمّ" + "ُها")); // shadda/vowel in either order
    expect(contractShadda("عَمْمُها")).toBe("عَمّ" + "ُها");
    expect(expandShadda("بَيْتٌ")).toBe("بَيْتٌ");
  });

  it("classifies the final taa as in the axis-review table (p. 94)", () => {
    expect(taaForm("مُعَلِّماتٌ")).toBe("open");
    expect(taaForm("اشْتَدَّتْ")).toBe("open");
    expect(taaForm("مَدْرَسَةٌ")).toBe("tied-joined");
    expect(taaForm("الْمُعَلِّمَةُ")).toBe("tied-joined");
    expect(taaForm("قِراءَةٌ")).toBe("tied-alone");
    expect(taaForm("سورَة")).toBe("tied-alone");
    expect(taaForm("جائِزَةٌ")).toBe("tied-alone");
    expect(taaForm("حَقَّهُ")).toBeNull();
  });
});
