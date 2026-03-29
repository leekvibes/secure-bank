import { SigningRouter } from "@/components/signing-router";

export default function SignPage({ params }: { params: { token: string } }) {
  return <SigningRouter token={params.token} />;
}
