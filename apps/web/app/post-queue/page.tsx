import Link from "next/link";
import { PostQueue } from "../../components/post-queue";
export const dynamic = "force-dynamic";
export default function PostQueuePage() { return <main className="main"><div className="topbar"><div><div className="eyebrow">Posting control</div><h1>Post queue</h1></div><Link className="link" href="/dashboard">← Back to overview</Link></div><PostQueue /></main>; }
