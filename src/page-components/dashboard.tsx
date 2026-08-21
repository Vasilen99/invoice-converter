"use client";

import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
  SidebarInset,
} from "@/components/animate-ui/components/radix/sidebar";
import { Button } from "@/components/ui/button";
import {
  Building2,
  BarChart3,
  Upload,
  FileText,
  User,
  Clock,
  LogOut,
  FileUser,
  Users,
  ShieldLock,
  ChartPie,
  Building,
  Globe,
  Cable,
  Bell,
  ReceiptText,
  Repeat,
  CircleDollarSign,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { FadeIn } from "@/components/motion";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useEffect, useState } from "react";
import { accountLink } from "../../utility/links";
const NAVIGATION_CONFIG = [
  {
    labelKey: "dashboard.general",
    items: [
      {
        nameKey: "dashboard.overview",
        href: "/dashboard",
        icon: BarChart3,
      },
      {
        nameKey: "dashboard.reports",
        href: "/dashboard/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    labelKey: "dashboard.documents",
    items: [
      {
        nameKey: "dashboard.uploadDocument",
        href: "/dashboard/upload",
        icon: Upload,
      },
      {
        nameKey: "dashboard.invoices",
        href: "/dashboard/invoices",
        icon: FileText,
      },
      {
        nameKey: "dashboard.contragents",
        href: "/dashboard/contragents",
        icon: FileUser,
      },
      {
        nameKey: "dashboard.creditNotes",
        href: "/dashboard/credit-notes",
        icon: ReceiptText,
      },
      {
        nameKey: "dashboard.recurringInvoices",
        href: "/dashboard/reccuring-invoices",
        icon: Repeat,
      },
    ],
  },
  {
    labelKey: "dashboard.team",
    items: [
      {
        nameKey: "dashboard.members",
        href: "/dashboard/members",
        icon: Users,
      },
      {
        nameKey: "dashboard.rolesAndPermissions",
        href: "/dashboard/roles-and-permissions",
        icon: ShieldLock,
      },
    ],
  },
  {
    labelKey: "dashboard.billing",
    items: [
      {
        nameKey: "dashboard.creditsAndPackages",
        href: "/dashboard/credits",
        icon: CircleDollarSign,
      },
      {
        nameKey: "dashboard.orderHistory",
        href: "/billing",
        icon: Clock,
      },
      {
        nameKey: "dashboard.usageByMember",
        href: "/dashboard/usage-by-member",
        icon: ChartPie,
      },
    ],
  },
  {
    labelKey: "dashboard.settings",
    items: [
      {
        nameKey: "dashboard.organizationProfile",
        href: "/dashboard/organization-profile",
        icon: Building,
      },
      {
        nameKey: "dashboard.myAccount",
        href: `/dashboard/${accountLink}`,
        icon: User,
      },
      {
        nameKey: "dashboard.integrations",
        href: "/dashboard/integrations",
        icon: Cable,
      },
      {
        nameKey: "dashboard.notifications",
        href: "/dashboard/notifications",
        icon: Bell,
      },
      {
        nameKey: "dashboard.localizations",
        href: "/dashboard/localizations",
        icon: Globe,
      },
    ],
  },
];

export default function Dashboard() {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState<boolean>(true);

  return (
    <SidebarProvider
      open={open}
      onOpenChange={() => setOpen(!open)}
      defaultOpen={true}
    >
      <Sidebar className="overflow-y-auto border-r border-border bg-sidebar">
        <SidebarHeader className="border-b border-sidebar-border">
          <FadeIn className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-foreground text-sm">
                Servify Invoices
              </span>
              <span className="text-xs text-muted-foreground">
                Sofia Consulting EOOD
              </span>
            </div>
            {open && (
              <FadeIn className="flex items-center gap-3">
                <SidebarTrigger className="size-12 text-foreground hover:text-foreground transition-colors" />
              </FadeIn>
            )}
          </FadeIn>
        </SidebarHeader>
        <SidebarContent className="relative py-6 px-4 no-scrollbar">
          {NAVIGATION_CONFIG.map((section, idx) => (
            <FadeIn key={section.labelKey} delay={idx * 0.05}>
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t(section.labelKey)}
                </SidebarGroupLabel>
                <SidebarMenu className="gap-1">
                  {section.items.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <SidebarMenuItem key={item.nameKey}>
                        <SidebarMenuButton asChild>
                          <Button
                            onClick={() => router.push(item.href)}
                            variant="ghost"
                            className="flex justify-start items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all rounded-lg group"
                          >
                            <IconComponent className="h-5 w-5 group-hover:scale-110 transition-transform" />
                            <span className="text-sm">{t(item.nameKey)}</span>
                          </Button>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </FadeIn>
          ))}
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {t("dashboard.actionButtons")}
            </SidebarGroupLabel>
            <SidebarMenu className="flex-row! gap-1 !justify-between">
              <SidebarMenuItem className="w-fit" key={"language-switcher"}>
                <LanguageSwitcher />
              </SidebarMenuItem>
              <SidebarMenuItem className="w-fit" key={"theme-toggle"}>
                <ThemeToggle />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Button className="flex justify-start items-center gap-3 text-primary-foreground hover:text-primary-foreground/80 hover:bg-destructive/10 transition-all rounded-lg group">
                  <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
                  <span className="text-sm">{t("dashboard.logout")}</span>
                </Button>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      {!open && (
        <SidebarInset className="relative ml-3 lg:top-16 top-10 h-[calc(100vh-4rem)]">
          <FadeIn className="flex items-center gap-3">
            <SidebarTrigger className="size-12 text-foreground hover:text-foreground transition-colors" />
          </FadeIn>
        </SidebarInset>
      )}
    </SidebarProvider>
  );
}
