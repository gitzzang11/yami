import { describe, expect, it } from "vitest";
import { CRITIC_PERSONAS } from "@/services/gemini";
import type { AiReview, CriticPersonaId } from "@/types";

describe("Gemini AI Critic Personas Tests", () => {
  const personas: CriticPersonaId[] = [
    "student",
    "paik",
    "ramsay",
    "dietitian",
    "king",
    "robot",
  ];

  it("should have all 6 defined personas configured", () => {
    personas.forEach((id) => {
      const persona = CRITIC_PERSONAS[id];
      expect(persona).toBeDefined();
      expect(persona.name).toBeTruthy();
      expect(persona.icon).toBeTruthy();
      expect(persona.badge).toBeTruthy();
      expect(persona.shortDesc).toBeTruthy();
      expect(persona.systemPrompt("고등학교")).toBeTruthy();
      expect(persona.sampleQuote).toBeTruthy();
    });
  });

  it("should have distinctive persona system prompts", () => {
    expect(CRITIC_PERSONAS.paik.systemPrompt()).toContain("백종원");
    expect(CRITIC_PERSONAS.ramsay.systemPrompt()).toContain("고든 램지");
    expect(CRITIC_PERSONAS.king.systemPrompt()).toContain("임금");
    expect(CRITIC_PERSONAS.dietitian.systemPrompt()).toContain("영양사");
    expect(CRITIC_PERSONAS.robot.systemPrompt()).toContain("AI");
  });

  it("should support multiple persona reviews per meal with chronological sorting", () => {
    const mockReviews: AiReview[] = [
      {
        id: "meal-1-1000",
        mealId: "meal-1",
        schoolCode: "7010578",
        date: "20260827",
        mealKind: "lunch",
        model: "gemini-2.5-flash",
        persona: "student",
        personaName: "솔직한 학생",
        totalScore: 90,
        oneLine: "대존맛",
        detail: "굿",
        scores: [],
        createdAt: 1000,
      },
      {
        id: "meal-1-2000",
        mealId: "meal-1",
        schoolCode: "7010578",
        date: "20260827",
        mealKind: "lunch",
        model: "gemini-2.5-flash",
        persona: "paik",
        personaName: "백종원 셰프",
        totalScore: 88,
        oneLine: "재밌네유",
        detail: "굿",
        scores: [],
        createdAt: 2000,
      },
      {
        id: "meal-1-3000",
        mealId: "meal-1",
        schoolCode: "7010578",
        date: "20260827",
        mealKind: "lunch",
        model: "gemini-2.5-flash",
        persona: "ramsay",
        personaName: "고든 램지",
        totalScore: 55,
        oneLine: "Disaster",
        detail: "Raw",
        scores: [],
        createdAt: 3000,
      },
    ];

    // Sorted newest first
    const sorted = [...mockReviews].sort((a, b) => b.createdAt - a.createdAt);
    expect(sorted[0].persona).toBe("ramsay");
    expect(sorted[1].persona).toBe("paik");
    expect(sorted[2].persona).toBe("student");
    expect(sorted.length).toBe(3);
  });
});
