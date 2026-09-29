import { Dashboard } from "@/components/dashboard";
import { createDemoReviews } from "@/lib/demo-data";
import { connection } from "next/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  await connection();
  // eslint-disable-next-line react-hooks/purity -- Request-time Server Component; the timestamp is passed unchanged to the client.
  const now = Date.now();
  return (
    <Dashboard
      initialReviews={createDemoReviews(now)}
      now={now}
      demo={!process.env.HF_TOKEN}
    />
  );
}
