import Link from "next/link";
import { getNbaTeams } from "@/lib/api";
import CompareTeamsClient from "./compareClient";

export default async function NbaComparePage() {
  const teams = await getNbaTeams();

  return <CompareTeamsClient teams={teams} />;
}