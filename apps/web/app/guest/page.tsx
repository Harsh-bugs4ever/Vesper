import { redirect } from "next/navigation";

export default async function GuestPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  redirect(`/guest/room${qs ? `?${qs}` : ""}`);
}

