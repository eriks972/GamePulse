import {NflView,type Query} from "../Views";
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Query>}){return <NflView view="compare" query={await searchParams}/>;}
