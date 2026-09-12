import type { Metadata } from "next";
import { AccountCenter } from "@/components/account-center";

export const metadata: Metadata = {
  title: "用户中心 · Reii小店",
  description: "查看订单、累计消费与开票记录",
};

export default function AccountPage() {
  return <AccountCenter />;
}
