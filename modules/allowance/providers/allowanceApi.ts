"use client";

import useSWR from "swr";
import type { Allowance, AllowanceListParams, User } from "../types";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useUsers(search?: string) {
  const { data, error } = useSWR<User[]>(
    search !== undefined ? `/api/allowance/users?search=${encodeURIComponent(search)}` : "/api/allowance/users",
    fetcher,
    { revalidateOnFocus: false }
  );
  return { users: data ?? [], loading: !data && !error, error };
}

export function useAllowancesQuery(params: AllowanceListParams) {
  const key = [
    "/api/allowance",
    params.page,
    params.pageSize,
    params.searchName || "",
    params.searchDescription || "",
    params.processed || "all",
  ];

  const { data, error, mutate, isLoading } = useSWR(
    key,
    async () => {
      const qs = new URLSearchParams({
        page: String(params.page),
        pageSize: String(params.pageSize),
        searchName: params.searchName || "",
        searchDescription: params.searchDescription || "",
        processed: params.processed || "all",
      }).toString();

      const res = await fetch(`/api/allowance?${qs}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    { keepPreviousData: true, revalidateOnFocus: false }
  );

  return {
    rows: data?.rows ?? [],
    total: data?.total ?? 0,
    loading: isLoading,
    error,
    mutate,
  };
}
