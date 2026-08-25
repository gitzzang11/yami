import { describe, expect, it } from "vitest";
import { classifyScheduleEventType, extractGradeTarget } from "@/services/neis";
import type { NeisSchoolScheduleRow } from "@/types";

describe("NEIS School Schedule Parser Tests", () => {
  it("should classify exam events properly", () => {
    expect(classifyScheduleEventType("1학기 중간고사", "")).toBe("exam");
    expect(classifyScheduleEventType("2학기 1차 지필평가", "")).toBe("exam");
    expect(classifyScheduleEventType("전국연합학력평가", "")).toBe("exam");
    expect(classifyScheduleEventType("수행평가 주간", "")).toBe("exam");
  });

  it("should classify vacation events properly", () => {
    expect(classifyScheduleEventType("여름방학식", "방학")).toBe("vacation");
    expect(classifyScheduleEventType("겨울방학개학", "")).toBe("vacation");
    expect(classifyScheduleEventType("봄방학", "")).toBe("vacation");
  });

  it("should classify holiday events properly", () => {
    expect(classifyScheduleEventType("개교기념일", "휴업일")).toBe("holiday");
    expect(classifyScheduleEventType("재량휴업일", "휴업일")).toBe("holiday");
    expect(classifyScheduleEventType("추석연휴", "공휴일")).toBe("holiday");
  });

  it("should classify festival events properly", () => {
    expect(classifyScheduleEventType("가을 한마당 체육대회", "")).toBe("festival");
    expect(classifyScheduleEventType("1학년 현장체험학습", "")).toBe("festival");
    expect(classifyScheduleEventType("백마제 축제", "")).toBe("festival");
    expect(classifyScheduleEventType("수학여행", "")).toBe("festival");
  });

  it("should fallback to general for other academic events", () => {
    expect(classifyScheduleEventType("신입생 입학식", "")).toBe("general");
    expect(classifyScheduleEventType("학부모 총회", "")).toBe("general");
    expect(classifyScheduleEventType("동아리 활동", "")).toBe("general");
  });

  it("should correctly extract target grades from grade flags", () => {
    const allGradeRow: NeisSchoolScheduleRow = {
      ATPT_OFCDC_SC_CODE: "B10",
      SD_SCHUL_CODE: "7010057",
      AA_YMD: "20260825",
      EVENT_NM: "개학식",
      ONE_GRADE_EVENT_YN: "Y",
      TW_GRADE_EVENT_YN: "Y",
      THREE_GRADE_EVENT_YN: "Y",
    };
    expect(extractGradeTarget(allGradeRow)).toBe("전학년");

    const partialGradeRow: NeisSchoolScheduleRow = {
      ATPT_OFCDC_SC_CODE: "B10",
      SD_SCHUL_CODE: "7010057",
      AA_YMD: "20260825",
      EVENT_NM: "3학년 모의고사",
      ONE_GRADE_EVENT_YN: "N",
      TW_GRADE_EVENT_YN: "N",
      THREE_GRADE_EVENT_YN: "Y",
    };
    expect(extractGradeTarget(partialGradeRow)).toBe("3학년");

    const twoGradesRow: NeisSchoolScheduleRow = {
      ATPT_OFCDC_SC_CODE: "B10",
      SD_SCHUL_CODE: "7010057",
      AA_YMD: "20260825",
      EVENT_NM: "1,2학년 수련회",
      ONE_GRADE_EVENT_YN: "Y",
      TW_GRADE_EVENT_YN: "Y",
      THREE_GRADE_EVENT_YN: "N",
    };
    expect(extractGradeTarget(twoGradesRow)).toBe("1, 2학년");
  });
});
