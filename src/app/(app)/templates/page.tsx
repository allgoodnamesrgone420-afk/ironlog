import { redirect } from "next/navigation";

// Templates was replaced by the more useful Stats page.
export default function TemplatesPage() {
  redirect("/stats");
}
