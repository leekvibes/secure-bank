import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { redirect } from "next/navigation";
import { DocSignNew } from "@/components/docsign-new";

export default async function DocSignNewPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/auth");
  return <DocSignNew />;
}
