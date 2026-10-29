import {NhlView} from "../Views";
import type {Query} from "@/lib/nhl";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <NhlView view="compare" query={await searchParams}/>;}
