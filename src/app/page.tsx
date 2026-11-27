import type { Metadata } from "next";
import Converter from "@/components/converter";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
};

export default function Home() {
  return (
    <>
      <Converter />
    </>
  );
}
