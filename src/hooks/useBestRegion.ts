import { useState, useEffect } from "react";
import { useQueries } from "@tanstack/react-query";
import { healthUrl } from "./useUrls";
import { Region } from "../types";

interface ServerHealth {
  region: Region;
  latency: number;
  error?: string;
}

const useBestRegion = (regions: Region[]) => {
  const [bestRegion, setBestRegion] = useState<Region | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  const checkServerHealth = async (region: Region): Promise<ServerHealth> => {
    const url = healthUrl(region.value);

    try {
      const start = performance.now();
      const response = await fetch(url, { method: "HEAD" });
      const end = performance.now();

      if (!response.ok) throw new Error("Server not healthy");

      return {
        region,
        latency: end - start,
      };
    } catch (error: any) {
      return {
        region,
        latency: Infinity,
        error: error.message,
      };
    }
  };

  const results = useQueries({
    queries: regions.map((region) => ({
      queryKey: ["serverHealth", region],
      queryFn: () => checkServerHealth(region),
      staleTime: Infinity,
      cacheTime: 0,
    })),
  });

  useEffect(() => {
    if (results.every((result) => result.isSuccess || result.isError)) {
      const successfulResults = results
        .filter((result) => result.isSuccess && result.data)
        .map((result) => result.data as ServerHealth);

      if (successfulResults.length > 0) {
        const sortedByLatency = successfulResults.sort(
          (a, b) => a.latency - b.latency,
        );
        setBestRegion(sortedByLatency[0].region);
      } else {
        setIsError(true);
      }
      setIsLoading(false);
    }
  }, [results]);

  return { bestRegion, isLoading, isError };
};

export default useBestRegion;
