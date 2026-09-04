import { redirect } from "next/navigation";

export default function AccountPage({ searchParams }) {
  const rawRedirect = searchParams?.redirect;
  const safeRedirect =
    typeof rawRedirect === "string" && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/explore";

  redirect(safeRedirect);
}
