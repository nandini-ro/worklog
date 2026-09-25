"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Category, Project, ProjectRef } from "./types";

/** Loads async data and re-runs when `key` changes. */
export function useAsync<T>(fn: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const d = await fnRef.current();
      if (id === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on key change
    void reload();
  }, [key, reload]);

  return { data, error, loading, reload, setData };
}

export interface RefData {
  projects: Project[];
  categories: Category[];
  recentProjects: ProjectRef[];
  recentCategories: Category[];
}

/** Projects, categories and recently-used lists for entry forms and filters. */
export function useRefData() {
  return useAsync<RefData>(async () => {
    const [projects, categories, recent] = await Promise.all([
      api.get<Project[]>("/api/projects"),
      api.get<Category[]>("/api/categories"),
      api.get<{ projects: ProjectRef[]; categories: Category[] }>("/api/work-entries/recent-meta"),
    ]);
    return { projects, categories, recentProjects: recent.projects, recentCategories: recent.categories };
  }, "refdata");
}
