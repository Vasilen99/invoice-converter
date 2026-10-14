"use client";
import { HeadingSection } from "@/components/HeadingSection";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Decimal } from "../../generated/prisma/internal/prismaNamespace";

type DashboardAnalyticsProps = {
  creditsData: {
    type: "PURCHASE" | "CONSUMPTION" | "REFUND" | "BONUS" | "ADJUSTMENT";
    amount: number;
    balanceAfter: number;
    createdAt: Date;
  }[];
  organizationsData: {
    name: string;
    bulstat: string | null;
    id: number;
    contragents: {
      _count: {
        id: number;
      };
    }[];
    generatedInvoices: {
      createdAt: Date;
      _count: {
        creditTransaction: number;
        contragent: number;
        organization: number;
        sourceDocument: number;
        lineItems: number;
      };
      totalAmount: Decimal;
    }[];
  }[];
};

type TimeRange = "1m" | "3m" | "6m" | "12m";
type OrganizationSort = "mostAmount" | "latestGenerated" | "generatedCount";

const TIME_RANGE_MONTHS: Record<TimeRange, number> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

export default function DashboardAnalytics({
  creditsData,
  organizationsData,
}: DashboardAnalyticsProps) {
  const t = useTranslations("dashboard");
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>("1m");
  const [selectedOrganizationSort, setSelectedOrganizationSort] =
    useState<OrganizationSort>("mostAmount");

  const creditTransactionsTypeMap = {
    PURCHASE: t("tableTypePurchase"),
    CONSUMPTION: t("tableTypeConsumption"),
    REFUND: t("tableTypeRefund"),
    BONUS: t("tableTypeBonus"),
    ADJUSTMENT: t("tableTypeAdjustment"),
  };

  const chartConfig = {
    invoices: {
      label: t("chartSeriesInvoices"),
      color: "var(--chart-1)",
    },
  } satisfies ChartConfig;

  const chartData = useMemo(() => {
    const monthsToDisplay = TIME_RANGE_MONTHS[selectedTimeRange];
    const now = new Date();
    const startMonth = new Date(
      now.getFullYear(),
      now.getMonth() - (monthsToDisplay - 1),
      1,
    );
    const currentMonthEnd = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const monthBuckets = Array.from({ length: monthsToDisplay }, (_, index) => {
      const date = new Date(
        startMonth.getFullYear(),
        startMonth.getMonth() + index,
        1,
      );
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        month: format(date, "MMM yyyy"),
        monthDate: date,
        invoices: 0,
      };
    });

    const bucketIndexByMonthKey = new Map(
      monthBuckets.map((bucket, index) => [bucket.key, index]),
    );

    organizationsData.forEach((organization) => {
      organization.generatedInvoices.forEach((invoice) => {
        const invoiceDate = new Date(invoice.createdAt);
        if (invoiceDate < startMonth || invoiceDate > currentMonthEnd) {
          return;
        }

        const key = `${invoiceDate.getFullYear()}-${invoiceDate.getMonth()}`;
        const bucketIndex = bucketIndexByMonthKey.get(key);
        if (bucketIndex === undefined) {
          return;
        }

        monthBuckets[bucketIndex].invoices += 1;
      });
    });

    return monthBuckets;
  }, [organizationsData, selectedTimeRange]);

  const displayedChartData = useMemo(() => {
    if (selectedTimeRange !== "1m" || chartData.length !== 1) {
      return chartData;
    }

    const onlyMonthData = chartData[0];
    const previousMonthDate = new Date(
      onlyMonthData.monthDate.getFullYear(),
      onlyMonthData.monthDate.getMonth() - 1,
      1,
    );

    return [
      {
        ...onlyMonthData,
        key: `${previousMonthDate.getFullYear()}-${previousMonthDate.getMonth()}`,
        month: format(previousMonthDate, "MMM yyyy"),
        monthDate: previousMonthDate,
        invoices: 0,
      },
      onlyMonthData,
    ];
  }, [chartData, selectedTimeRange]);

  const chartPeriodLabel = useMemo(() => {
    if (chartData.length === 0) {
      return "-";
    }

    const start = chartData[0].monthDate;
    const end = chartData[chartData.length - 1].monthDate;
    return `${format(start, "MMM yyyy")} - ${format(end, "MMM yyyy")}`;
  }, [chartData]);

  const chartInvoicesTotal = useMemo(
    () => chartData.reduce((total, bucket) => total + bucket.invoices, 0),
    [chartData],
  );

  const organizationsSummaries = useMemo(
    () =>
      organizationsData.map((organization) => {
        const generatedInvoicesCount = organization.generatedInvoices.length;
        const latestGeneratedInvoiceDate =
          generatedInvoicesCount > 0
            ? organization.generatedInvoices.reduce((latest, invoice) =>
                new Date(invoice.createdAt) > new Date(latest.createdAt)
                  ? invoice
                  : latest,
              ).createdAt
            : null;
        const totalAmount = organization.generatedInvoices.reduce(
          (total, invoice) => total + Number(invoice.totalAmount),
          0,
        );

        return {
          ...organization,
          latestGeneratedInvoiceDate,
          generatedInvoicesCount,
          totalAmount,
        };
      }),
    [organizationsData],
  );

  const sortedOrganizations = useMemo(() => {
    const organizations = [...organizationsSummaries];

    organizations.sort((a, b) => {
      if (selectedOrganizationSort === "mostAmount") {
        return b.totalAmount - a.totalAmount;
      }

      if (selectedOrganizationSort === "generatedCount") {
        return b.generatedInvoicesCount - a.generatedInvoicesCount;
      }

      const aTime = a.latestGeneratedInvoiceDate
        ? new Date(a.latestGeneratedInvoiceDate).getTime()
        : 0;
      const bTime = b.latestGeneratedInvoiceDate
        ? new Date(b.latestGeneratedInvoiceDate).getTime()
        : 0;

      return bTime - aTime;
    });

    return organizations;
  }, [organizationsSummaries, selectedOrganizationSort]);

  return (
    <>
      <HeadingSection
        type="inner-page"
        title={t("header")}
        subtitle={t("subheader")}
      />
      <div className="flex flex-col gap-6">
        <div className="grid lg:grid-cols-2 lg:grid-rows-1 grid-cols-1 grid-rows-2 lg:space-x-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{t("areaChartTitle")}</CardTitle>
                  <CardDescription>{t("areaChartDescription")}</CardDescription>
                </div>
                <div className="w-full sm:w-52">
                  <Select
                    value={selectedTimeRange}
                    onValueChange={(value) =>
                      setSelectedTimeRange(value as TimeRange)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("chartRangeLabel")} />
                    </SelectTrigger>
                    <SelectContent className="bg-primary-foreground">
                      <SelectItem value="1m">
                        {t("chartRangeLastMonth")}
                      </SelectItem>
                      <SelectItem value="3m">
                        {t("chartRangeLast3Months")}
                      </SelectItem>
                      <SelectItem value="6m">
                        {t("chartRangeLast6Months")}
                      </SelectItem>
                      <SelectItem value="12m">
                        {t("chartRangeLastYear")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig}>
                <AreaChart
                  accessibilityLayer
                  data={displayedChartData}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <YAxis
                    hide
                    allowDecimals={false}
                    domain={[
                      0,
                      (dataMax: number) => Math.max(1, Math.ceil(dataMax)),
                    ]}
                  />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="invoices"
                    type="monotone"
                    fill="var(--color-invoices)"
                    fillOpacity={0.4}
                    stroke="var(--color-invoices)"
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
            <CardFooter>
              <div className="flex w-full items-start gap-2 text-sm">
                <div className="grid gap-2">
                  <div className="flex items-center gap-2 leading-none font-medium">
                    {t("chartFooterGeneratedCount", {
                      count: chartInvoicesTotal,
                    })}
                  </div>
                  <div className="flex items-center gap-2 leading-none text-muted-foreground">
                    {t("chartFooterPeriod", { period: chartPeriodLabel })}
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
          <div className="flex flex-col gap-6">
            <span className="text-center text-base font-bold">
              {t("recentTransactions")}
            </span>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">
                    {t("tableType")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("tableDate")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("tableBalanceAfter")}
                  </TableHead>
                  <TableHead className="text-center">
                    {t("tableAmount")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {creditsData && creditsData.length ? (
                  creditsData.map((transaction, index) => (
                    <TableRow className="text-center" key={index}>
                      <TableCell>
                        {creditTransactionsTypeMap[transaction.type]}
                      </TableCell>
                      <TableCell>
                        {" "}
                        {format(new Date(transaction.createdAt), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell>{transaction.balanceAfter}</TableCell>
                      <TableCell>{transaction.amount}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      {t("noTransactions")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="flex lg:flex-row flex-col justify-between items-center">
          <span className="text-base font-bold lg:mb-0 mb-6 w-full">
            {t("organizationsList")}
          </span>
          <div className="flex items-center justify-end gap-3 w-full">
            <span className="text-sm text-muted-foreground">
              {t("organizationsSortLabel")}
            </span>
            <div className="w-full max-w-xs">
              <Select
                value={selectedOrganizationSort}
                onValueChange={(value) =>
                  setSelectedOrganizationSort(value as OrganizationSort)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("organizationsSortLabel")} />
                </SelectTrigger>
                <SelectContent className="bg-primary-foreground">
                  <SelectItem value="mostAmount">
                    {t("organizationsSortMostAmount")}
                  </SelectItem>
                  <SelectItem value="latestGenerated">
                    {t("organizationsSortLatestGenerated")}
                  </SelectItem>
                  <SelectItem value="generatedCount">
                    {t("organizationsSortGeneratedCount")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("organizationName")}</TableHead>
              <TableHead>{t("bulstat")}</TableHead>
              <TableHead>{t("lastGeneratedInvoice")}</TableHead>
              <TableHead>{t("contragentsCount")}</TableHead>
              <TableHead>{t("totalInvoices")}</TableHead>
              <TableHead>{t("totalAmount")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedOrganizations && sortedOrganizations.length ? (
              sortedOrganizations.map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell className="font-medium">
                    {organization.name}
                  </TableCell>
                  <TableCell>{organization.bulstat}</TableCell>
                  <TableCell>
                    {organization.latestGeneratedInvoiceDate
                      ? format(
                          new Date(organization.latestGeneratedInvoiceDate),
                          "dd/MM/yyyy",
                        )
                      : "-"}
                  </TableCell>
                  <TableCell>{organization.contragents.length}</TableCell>
                  <TableCell>{organization.generatedInvoicesCount}</TableCell>
                  <TableCell>{organization.totalAmount}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">
                  {t("noOrganizations")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
