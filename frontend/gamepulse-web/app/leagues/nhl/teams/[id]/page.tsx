import {NhlView} from "../../Views";
import type {Query} from "@/lib/nhl";
export const dynamic="force-dynamic";
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Query>}){const {id}=await params;return <NhlView view="team" id={id} query={await searchParams}/>;}
