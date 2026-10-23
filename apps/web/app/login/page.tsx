import { AuthScreen } from "../components/auth-screen";

export default async function Login({ searchParams }: { searchParams: Promise<{ signout?: string }> }) {
  const query = await searchParams;
  return <AuthScreen path="sign-in" signOutNotice={query.signout === "local"} />;
}
