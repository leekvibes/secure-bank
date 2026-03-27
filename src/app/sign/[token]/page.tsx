import { DocSignClient } from "@/components/docsign-client";

export default function SignPage({ params }: { params: { token: string } }) {
  return <DocSignClient token={params.token} />;
}
