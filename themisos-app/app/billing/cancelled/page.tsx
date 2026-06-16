import { redirect } from "next/navigation";

export default function BillingCancelled() {
  redirect("/dashboard");
}
