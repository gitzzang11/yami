"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Building2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { searchSchools } from "@/services/neis";
import type { School } from "@/types";

type Props = {
  apiKey?: string;
  onSelect: (school: School) => void;
};

export function SchoolSearch({ apiKey, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const result = await searchSchools(query, apiKey);
      setSchools(result);
      if (result.length === 0) setError("검색 결과가 없습니다. 학교명을 두 글자 이상 입력하세요.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "학교 검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">첫 설정</p>
        <h2 className="text-2xl font-black tracking-tight">학교를 선택하세요</h2>
      </div>
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          placeholder="학교명 검색"
        />
        <Button size="icon" onClick={submit} disabled={loading} aria-label="학교 검색">
          <Search className="h-5 w-5" />
        </Button>
      </div>
      {error ? <p className="text-sm font-medium text-rose-500">{error}</p> : null}
      <AnimatePresence>
        <div className="space-y-2">
          {schools.map((school) => (
            <motion.button
              key={school.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => onSelect(school)}
              className="w-full rounded-3xl bg-white/70 p-4 text-left ring-1 ring-zinc-200 transition hover:bg-white dark:bg-white/10 dark:ring-white/10"
            >
              <span className="flex items-center gap-2 font-bold">
                <Building2 className="h-4 w-4" />
                {school.name}
              </span>
              <span className="mt-2 flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {school.kind} · {school.address || "주소 정보 없음"}
              </span>
            </motion.button>
          ))}
        </div>
      </AnimatePresence>
    </Card>
  );
}
