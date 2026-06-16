import { redirect } from "next/navigation";

export default function BillingSuccess() {
  redirect("/dashboard");
}
