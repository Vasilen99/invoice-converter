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
  useSidebar,
} from "@/components/animate-ui/components/radix/sidebar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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
import { useRouter, usePathname } from "next/navigation";
import { FadeIn } from "@/components/motion";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useEffect, useState } from "react";
import {
  accountLink,
  dashboardLink,
  organizationsLink,
} from "../../utility/links";
import { useUserStore } from "@/store/user";
import { PLATFORM_NAME } from "../../utility/constants";
import { useIsMobile } from "@/hooks/use-mobile";
const NAVIGATION_CONFIG = [
  {
    labelKey: "dashboard.general",
    items: [
      {
        nameKey: "dashboard.overview",
        href: dashboardLink,
        icon: BarChart3,
      },
      {
        nameKey: "dashboard.reports",
        href: "/dashboard/reports",
        icon: BarChart3,
      },
      {
        nameKey: "dashboard.organizations",
        href: organizationsLink,
        icon: Users,
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
        href: accountLink,
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

function DashboardSidebarContent() {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const { logout, user } = useUserStore();

  const accountName =
    user?.accountName && user.accountName.length > 15
      ? `${user.accountName.slice(0, 15)}...`
      : user?.accountName;

  // const handleNavigation = (href: string) => {
  //   setOpenMobile(false); // Close mobile sidebar
  //   router.push(href);
  // };

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="overflow-y-auto border-r border-border bg-sidebar"
      >
        <SidebarHeader className="border-b border-sidebar-border">
          <FadeIn className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-foreground" />
            </div>
            <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
              <span className="font-bold text-foreground text-sm leading-4">
                {PLATFORM_NAME}
              </span>
              {accountName && (
                <span className="text-xs text-muted-foreground">
                  {accountName}
                </span>
              )}
            </div>
            <div className="flex items-center ml-auto group-data-[collapsible=icon]:ml-0">
              <SidebarTrigger className="size-9 text-foreground hover:text-foreground transition-colors" />
            </div>
          </FadeIn>
        </SidebarHeader>
        <SidebarContent className="relative py-6 px-4 group-data-[collapsible=icon]:px-1.5 no-scrollbar">
          {NAVIGATION_CONFIG.map((section, idx) => (
            <FadeIn key={section.labelKey} delay={idx * 0.05}>
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  {t(section.labelKey)}
                </SidebarGroupLabel>
                <SidebarMenu className="gap-1">
                  {section.items.map((item) => {
                    const IconComponent = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <SidebarMenuItem key={item.nameKey}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={t(item.nameKey)}
                          className="text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-all rounded-lg group/item data-[active=true]:bg-accent data-[active=true]:text-foreground data-[active=true]:font-semibold group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
                        >
                          <Link href={item.href}>
                            <IconComponent className="h-5 w-5 group-hover/item:scale-110 transition-transform" />
                            <span className="text-sm">{t(item.nameKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroup>
            </FadeIn>
          ))}
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {t("dashboard.actionButtons")}
            </SidebarGroupLabel>
            <SidebarMenu className="flex-row! gap-1 justify-between!">
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
              <SidebarMenuButton
                onClick={() => logout()}
                tooltip={t("dashboard.logout")}
                className="text-foreground hover:bg-destructive/10 transition-all rounded-lg group/item group-data-[collapsible=icon]:w-full! group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0!"
              >
                <LogOut className="h-5 w-5 group-hover/item:scale-110 transition-transform" />
                <span className="text-sm">{t("dashboard.logout")}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
    </>
  );
}

export default function Dashboard() {
  const isMobile = useIsMobile(1024);

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <DashboardSidebarContent />
      <SidebarInset>
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
          <SidebarTrigger className="size-9 text-foreground hover:text-foreground transition-colors" />
        </header>
        {/* main dashboard content goes here */}
      </SidebarInset>
    </SidebarProvider>
  );
}
