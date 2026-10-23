"use client";
import type { AnalysisResult } from "../lib/deepseek";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AnalysisAnswer({ result }: { result: AnalysisResult }) {
  return <div className="analysis-result"><p className="doc-meta">{result.provider} · {result.model} · Standards search: {result.searchStatus}</p>{result.warnings?.map((warning) => <p className="analysis-warning" key={warning}>{warning}</p>)}<div className="chat-answer"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ table: ({ children }) => <div className="markdown-table-wrap"><table>{children}</table></div> }}>{result.answer}</ReactMarkdown></div>{result.citations?.length > 0 && <div className="analysis-sources"><strong>Retrieved standards references</strong>{result.citations.map((source) => <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer">[{source.id}] {source.title}</a>)}</div>}</div>;
}
