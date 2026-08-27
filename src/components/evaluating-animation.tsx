"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Utensils } from "lucide-react";
import { CRITIC_PERSONAS } from "@/services/gemini";
import type { CriticPersonaId } from "@/types";

type Props = {
  persona?: CriticPersonaId;
  compact?: boolean;
};

const WITTY_MESSAGES: Record<CriticPersonaId, string[]> = {
  student: [
    "숟가락 들고 급식실 전력 질주 중... 🏃💨",
    "돈까스 크기랑 튀김 바삭함 자로 재는 중 📐🥩",
    "국물 한 입 후루룩... 매점 갈지 각 재는 중 🤔",
    "친구들이랑 반찬 물물교환 협상 테이블 구성 중 🤝",
    "오늘 식단이면 야자 10시까지 버틸 수 있는지 계산 중 🔋",
    "영양사 선생님께 마음속으로 넙죽 절 올리는 중 🙇‍♂️",
  ],
  paik: [
    "어디 냄새 한번 슥~ 맡아보는 중이쥬 👃",
    "이야~ 요거 양념에 불맛이 들어갔나 확인 중이쥬! 🔥",
    "밥 두 공기 비빌 각인지 침 꼴깍 삼키는 중이쥬 🍚🍚",
    "재료 조화가 기가 막힌지 혀끝으로 시식 중이쥬 👅",
    "솔루션 나갈 생각에 입이 근질근질하네유 🤭",
    "요거 아주 재밌는 메뉴 구성이네유~ 👨‍🍳",
  ],
  ramsay: [
    "식판 스캔 중... (이게 진정 21세기 급식인가?) 🧐",
    "고기가 덜 익었는지 돋보기로 뚫어지게 보는 중! 🔥🥩",
    "Stunning인지 Disaster인지 혀끝으로 판정 중! 👅",
    "주방으로 쳐들어가서 소리지를 준비 중... ⏱️💥",
    "플레이팅 밸런스에 경악하는 중 (혹은 감탄 중?) 🤯",
    "영양의 조화가 완벽하지 않으면 용서하지 않는다! ⚡",
  ],
  dietitian: [
    "칼로리 계산기 뚜닥뚜닥 두드리는 중 🧮",
    "탄단지 황금 비율 삼각함수로 정밀 계산 중 ⚖️",
    "우리 학생들 골고루 잘 먹을 수 있는지 식판 검사 중 📝",
    "오늘 비타민과 무기질 권장량 충족 여부 체크 중 🍋",
    "편식 방지용 비밀 레시피가 통했는지 관찰 중 🔍",
    "정성 가득 한 끼에 사랑을 듬뿍 담아 채점 중 ❤️",
  ],
  king: [
    "기미상궁이 먼저 수라를 조심스레 맛보는 중이니라 🥢",
    "수라상에 육류 반찬이 몇 첩인지 엄히 세는 중 🍱",
    "과인의 백성들이 먹는 급식을 친히 음미하는 중이니라 👑",
    "국물의 간이 과인의 옥체에 알맞은지 헤아리는 중 🍲",
    "상궁에게 칭찬의 어명을 내릴지 고민하는 중 📜",
    "수라간 최고 상궁의 솜씨를 판별하겠노라! 👑✨",
  ],
  robot: [
    "[SYSTEM] 식단 분자 구조 데이터 렌더링 중... 010101 💾",
    "[ALGORITHM] 스코빌 맵기 지수 및 단짠 밸런스 연산 중 ⚡",
    "[ANALYSIS] 학생 만족도 수렴 확률 99.84% 시뮬레이션 중 📊",
    "[SCAN] 영양소 매크로 데이터베이스와 정밀 대조 중 🛰️",
    "[OUTPUT] 미식 신경망 텐서 연산 최종 채점 임박 🤖",
    "[LOG] 급식 평론 평가 패킷 생성 완료 99% ... 🚀",
  ],
};

const FLOATING_FOODS = ["🍱", "🍗", "🍲", "🥩", "🍕", "🍚", "🥗", "✨"];

export function EvaluatingAnimation({ persona = "student", compact = false }: Props) {
  const [messageIndex, setMessageIndex] = useState(0);
  const personaConfig = CRITIC_PERSONAS[persona] || CRITIC_PERSONAS.student;
  const messages = WITTY_MESSAGES[persona] || WITTY_MESSAGES.student;

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [messages.length]);

  const currentMessage = messages[messageIndex];

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="flex items-center gap-3 rounded-2xl bg-zinc-100/90 p-3.5 dark:bg-white/10 border border-zinc-200/60 dark:border-white/10 overflow-hidden relative"
      >
        <div className="relative flex items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full bg-[var(--theme)] opacity-30"
            animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          />
          <span className="text-2xl relative z-10">{personaConfig.icon}</span>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between text-2xs font-bold text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 animate-spin text-[var(--theme)]" />
              {personaConfig.name} 시식 중
            </span>
            <span className="font-mono text-[10px] text-[var(--theme)] animate-pulse">평가 연산 중</span>
          </div>

          <div className="h-4 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.p
                key={messageIndex}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="text-xs font-black truncate text-zinc-900 dark:text-zinc-100"
              >
                {currentMessage}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-white/95 via-amber-50/30 to-orange-50/20 p-5 shadow-xl dark:border-white/10 dark:from-zinc-900/90 dark:via-zinc-900/60 dark:to-black/80 space-y-4"
    >
      {/* 배경 은은한 빛나는 원 */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--theme)] opacity-10 blur-2xl" />
      <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-amber-500 opacity-10 blur-2xl" />

      {/* 상단 캐릭터 & 둥둥 떠다니는 음식 애니메이션 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* 캐릭터 아바타 & 펄스 링 */}
          <div className="relative flex h-14 w-14 items-center justify-center">
            {/* 증기 올라가는 파티클 */}
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute -top-3 text-xs opacity-70 select-none pointer-events-none"
                style={{ left: `${20 + i * 25}%` }}
                animate={{
                  y: [-2, -14, -22],
                  opacity: [0, 0.85, 0],
                  scale: [0.7, 1.2, 0.5],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.35,
                  ease: "easeOut",
                }}
              >
                ♨️
              </motion.span>
            ))}

            {/* 원형 펄스 */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-[var(--theme)] opacity-20"
              animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.5, 0.2] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            />

            <motion.div
              className="grid h-12 w-12 place-items-center rounded-2xl bg-white shadow-md ring-2 ring-zinc-200/80 dark:bg-zinc-800 dark:ring-white/10 text-2xl relative z-10"
              animate={{ y: [0, -4, 0], rotate: [0, -3, 3, 0] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
            >
              {personaConfig.icon}
            </motion.div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-2xs font-black text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30 whitespace-nowrap shrink-0">
                <Utensils className="h-3 w-3" />
                {personaConfig.name}
              </span>
              <span className="text-2xs font-bold text-zinc-400 dark:text-zinc-500 whitespace-nowrap">실시간 급식 시식 중</span>
            </div>
            <h4 className="mt-1 text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
              <span>{personaConfig.title}</span>
              <Sparkles className="h-3.5 w-3.5 animate-spin text-[var(--theme)] shrink-0" />
            </h4>
          </div>
        </div>

        {/* 둥둥 떠다니는 미식 이모지 */}
        <div className="flex items-center gap-1 shrink-0">
          {FLOATING_FOODS.slice(0, 3).map((food, idx) => (
            <motion.span
              key={food}
              className="text-lg select-none"
              animate={{ y: [0, -6, 0], rotate: [-5, 5, -5] }}
              transition={{
                repeat: Infinity,
                duration: 1.4,
                delay: idx * 0.25,
                ease: "easeInOut",
              }}
            >
              {food}
            </motion.span>
          ))}
        </div>
      </div>

      {/* 재치 있는 실시간 평가 코멘트 말풍선 */}
      <div className="rounded-2xl bg-white/90 p-4 shadow-sm ring-1 ring-zinc-200/80 dark:bg-black/40 dark:ring-white/10 relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[var(--theme)] to-amber-500" />
        <div className="h-6 overflow-hidden flex items-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={messageIndex}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.3 }}
              className="text-xs sm:text-sm font-black text-zinc-800 dark:text-zinc-100 leading-snug pl-1.5 truncate whitespace-nowrap"
            >
              &ldquo;{currentMessage}&rdquo;
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      {/* 다이내믹 프로그레스 바 & 상태 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-2xs font-bold text-zinc-500 dark:text-zinc-400 gap-2">
          <span className="whitespace-nowrap truncate">영양 균형 & 꿀맛 감별 진행 중...</span>
          <span className="font-mono text-[var(--theme)] font-black animate-pulse whitespace-nowrap shrink-0">EVALUATING</span>
        </div>

        {/* 무한 쉬머 프로그레스 게이지 */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/80 dark:bg-white/10 relative">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[var(--theme)] via-amber-400 to-pink-500 shadow-sm"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.5,
              ease: "easeInOut",
            }}
            style={{ width: "65%" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
