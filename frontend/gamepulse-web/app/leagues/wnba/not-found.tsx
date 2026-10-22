import Link from "next/link";
export default function Missing() {
  return <main className="mx-auto min-h-[60vh] max-w-6xl px-6 py-16"><h1 className="text-3xl font-bold">WNBA record not found</h1><p className="mt-4 text-slate-400">This team, player, or game is not available in the selected season.</p><Link href="/leagues/wnba" className="mt-6 inline-block text-blue-300">Return to WNBA →</Link></main>;
}
