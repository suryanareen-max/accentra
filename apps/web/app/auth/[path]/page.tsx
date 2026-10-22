import { authViewPaths } from "@neondatabase/auth-ui/server";
import { AuthScreen } from "../../components/auth-screen";

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(authViewPaths).map((path) => ({ path }));
}

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;
  return <AuthScreen path={path} />;
}
