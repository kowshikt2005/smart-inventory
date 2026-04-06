"use client";

import useSWR from "swr";
import { useParams } from "next/navigation";
import { Loader2, Layers } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BrandDetail {
  id: string;
  name: string;
  subBrands: { id: string; name: string }[];
}

export default function BrandPage() {
  const params = useParams();
  const brandId = params.brandId as string;

  const { data, isLoading } = useSWR<{ brand: BrandDetail }>(
    brandId ? `/api/portal/brands/${brandId}` : null,
    fetcher
  );

  const brand = data?.brand;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
        <Layers className="h-8 w-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">
        {brand ? brand.name : "Select a Range"}
      </h2>
      <p className="text-gray-400 text-sm max-w-xs">
        Choose a product range from the sidebar to see available items.
      </p>
    </div>
  );
}
