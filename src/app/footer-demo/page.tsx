import type { Metadata } from "next";
import { FooterDemo } from "@/components/footer-demo";

export const metadata: Metadata = {
  title: "ReiiShop — Animated Footer",
  description: "A ReiiShop interactive footer study with ASCII canvas hands.",
};

export default function FooterDemoPage() {
  return <FooterDemo />;
}
