"use client";

// This page redirects to the home page which contains the dashboard
import { redirect } from "next/navigation";

export default function DashboardPage() {
  redirect("/");
}
