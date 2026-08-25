import { describe, expect, it } from "vitest";
import { CRITIC_PERSONAS } from "@/services/gemini";
import type { CriticPersonaId } from "@/types";

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
});
